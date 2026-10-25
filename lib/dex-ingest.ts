import { catalogTitleRewrite, resolveEnglishCardName, resolveEnglishSetName } from "./card-title";
import { prisma } from "./db";
import { DEX_PLACEHOLDER, INGEST_POST_RESERVE_MS, ingestPastSoftDeadline, runIngestPostSteps } from "./dex";
import { linkCatalogListings } from "./dex-link";
import { putR2Object, r2Config } from "./r2";
import {
  dexSetSettled,
  dexUnsettledRemaining,
  fetchMappedSet,
  formatDexCursor,
  hydrateDexCards,
  listDexSetQueue,
  planDexBatch,
  type DexQueueItem,
  type MappedCard,
  type MappedSet,
} from "./tcgdex";

const DEFAULT_MAX_SETS = 4;
const CARD_CHUNK = 24;
const SET_START_RESERVE_MS = 12_000;
const CHUNK_RESERVE_MS = 6_000;
const TITLE_PAGE = 100;
const TITLE_BACKFILL_RESERVE_MS = 2_000;

export type IngestCounts = {
  sets: number;
  cards: number;
  imagesUploaded: number;
  listingsLinked: number;
  collectionLinked: number;
  r2: boolean;
  skippedSettled: number;
  imagesPending: number;
};

export type IngestDexResult = {
  done: boolean;
  /** Pass back as `cursor`. Null when the usable-set walk is finished. */
  cursor: string | null;
  remainingSets: number;
  processedSetIds: string[];
  counts: IngestCounts;
};

export type IngestDexOptions = {
  deadlineMs?: number;
  /** Last response `cursor`. Omit to skip sets that are already stored and continue at the first gap. */
  cursor?: string | null;
  /** Max sets to open this call. Default 4. The deadline can stop earlier, mid-set. */
  maxSets?: number;
  /** Default both, Japanese series and English series, newest series first. */
  langs?: readonly ("en" | "ja")[];
};

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

/** Lexicon pass for rows this run did not refetch. Finish still comes from the card payload. Stops at `deadlineMs`. */
async function backfillEnglishNames(deadlineMs: number) {
  if (Date.now() >= deadlineMs) return;
  const sets = await prisma.catalogSet.findMany({
    where: { printRegion: "JP" },
    select: { id: true, code: true, nameEn: true, nameJa: true },
  });
  for (const set of sets) {
    if (Date.now() >= deadlineMs) return;
    const nameEn = resolveEnglishSetName(set.nameJa || set.nameEn, set.code);
    if (!nameEn || hasJapanese(nameEn) || nameEn === set.nameEn) continue;
    await prisma.catalogSet.update({ where: { id: set.id }, data: { nameEn } });
  }
  if (Date.now() >= deadlineMs) return;
  const cards = await prisma.catalogCard.findMany({
    where: { printRegion: "JP" },
    select: { id: true, nameEn: true, nameJa: true },
  });
  for (const card of cards) {
    if (Date.now() >= deadlineMs) return;
    const source = card.nameJa || card.nameEn;
    if (!hasJapanese(source) && !hasJapanese(card.nameEn)) continue;
    const nameEn = resolveEnglishCardName(source);
    if (!nameEn || hasJapanese(nameEn) || nameEn === card.nameEn) continue;
    await prisma.catalogCard.update({ where: { id: card.id }, data: { nameEn } });
  }
}

function displayImage(source: string): string {
  return source || DEX_PLACEHOLDER;
}

async function mirrorToR2(externalId: string, source: string): Promise<string | null> {
  if (!source.startsWith("https://") || !r2Config()) return null;
  const res = await fetch(source, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > 8_000_000) return null;
  const header = (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
  const sniffed = sniffImage(buf);
  const contentType = header.startsWith("image/") ? header : sniffed;
  if (!contentType) return null;
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : contentType.includes("gif") ? "gif" : "webp";
  const safe = externalId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return putR2Object(`dex/pokemon/${safe}.${ext}`, buf, contentType);
}

function sniffImage(buf: Buffer): string | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function upsertSets(sets: MappedSet[]) {
  const ids = new Map<string, string>();
  for (const set of sets) {
    const data = {
      game: "POKEMON" as const,
      printRegion: set.printRegion,
      code: set.code,
      nameEn: set.nameEn,
      nameJa: set.nameJa,
      series: set.series,
      releaseDate: set.releaseDate || null,
      total: set.total,
      logoUrl: set.logoUrl,
    };
    const row = await prisma.catalogSet.upsert({
      where: { externalId: set.externalId },
      update: data,
      create: { externalId: set.externalId, ...data },
    });
    ids.set(set.externalId, row.id);
  }
  return ids;
}

function markerSet(item: DexQueueItem, total: number, mapped: MappedSet | null): MappedSet {
  if (mapped) return { ...mapped, total };
  const printRegion = item.lang === "ja" ? "JP" : "WEST";
  return {
    externalId: item.externalId,
    printRegion,
    code: item.id,
    nameEn: item.name,
    nameJa: item.name,
    series: item.serieId,
    serieId: item.serieId,
    releaseDate: item.releaseDate,
    total,
    official: item.official,
    logoUrl: null,
    onlineOnly: false,
  };
}

async function loadProgress(queue: DexQueueItem[]) {
  if (!queue.length) return new Map<string, { count: number; total: number | null }>();
  const rows = await prisma.catalogSet.findMany({
    where: { externalId: { in: queue.map((item) => item.externalId) } },
    select: { externalId: true, total: true, _count: { select: { cards: true } } },
  });
  return new Map(rows.map((row) => [row.externalId, { count: row._count.cards, total: row.total }]));
}

async function mirrorImages(items: { externalId: string; source: string }[], deadline: number): Promise<number> {
  if (!items.length || !r2Config()) return 0;
  let imagesUploaded = 0;
  await pool(items, 4, async (item) => {
    if (Date.now() > deadline) return;
    try {
      const url = await mirrorToR2(item.externalId, item.source);
      if (!url) return;
      await prisma.catalogCard.update({ where: { externalId: item.externalId }, data: { imageUrl: url } });
      imagesUploaded += 1;
    } catch (error) {
      console.error("dex image skipped", item.externalId, error instanceof Error ? error.message.slice(0, 160) : "error");
    }
  });
  return imagesUploaded;
}

async function listUnmirrored(take: number): Promise<{ externalId: string; source: string }[]> {
  const r2 = r2Config();
  if (!r2 || take <= 0) return [];
  const rows = await prisma.catalogCard.findMany({
    where: {
      sourceImageUrl: { startsWith: "https://" },
      NOT: { imageUrl: { startsWith: `${r2.publicBase}/` } },
    },
    select: { externalId: true, sourceImageUrl: true },
    take,
  });
  return rows.flatMap((row) => (row.sourceImageUrl ? [{ externalId: row.externalId, source: row.sourceImageUrl }] : []));
}

async function countUnmirrored(): Promise<number> {
  const r2 = r2Config();
  if (!r2) return 0;
  return prisma.catalogCard.count({
    where: {
      sourceImageUrl: { startsWith: "https://" },
      NOT: { imageUrl: { startsWith: `${r2.publicBase}/` } },
    },
  });
}

async function upsertHydratedCards(
  cards: MappedCard[],
  setId: string,
  previous: Map<string, { externalId: string; imageUrl: string; sourceImageUrl: string | null }>,
  pending: { externalId: string; source: string }[],
) {
  const r2 = r2Config();
  for (const card of cards) {
    const prior = previous.get(card.externalId);
    const mirrored = Boolean(r2 && prior?.sourceImageUrl === card.sourceImageUrl && prior.imageUrl.startsWith(`${r2.publicBase}/`));
    const imageUrl = mirrored ? prior!.imageUrl : displayImage(card.sourceImageUrl);
    const data = {
      setId,
      game: "POKEMON" as const,
      printRegion: card.printRegion,
      collectorNumber: card.collectorNumber,
      numberKey: card.numberKey,
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      imageUrl,
      sourceImageUrl: card.sourceImageUrl || null,
      rarity: card.rarity,
      artist: card.artist,
      finish: card.finish,
    };
    await prisma.catalogCard.upsert({
      where: { externalId: card.externalId },
      update: data,
      create: { externalId: card.externalId, ...data },
    });
    if (!mirrored && card.sourceImageUrl && r2) pending.push({ externalId: card.externalId, source: card.sourceImageUrl });
  }
}

export type BackfillTitlesResult = {
  done: boolean;
  /** Last catalog card id written. Pass it back as `cursor`. Null when the walk is finished. */
  cursor: string | null;
  scanned: number;
  listings: number;
  collectionItems: number;
};

/**
 * Recompute listing and collection titles from stored card + set fields.
 * Does not call TCGdex. Only replaces a title that still equals the previous generated string.
 * Stops before `deadlineMs` so the route can return JSON. Call again with `cursor` until `done`.
 */
export async function backfillCatalogTitles(opts?: { deadlineMs?: number; cursor?: string | null }): Promise<BackfillTitlesResult> {
  const deadline = Date.now() + (opts?.deadlineMs ?? 45_000);
  let cursor = opts?.cursor?.trim() || null;
  let scanned = 0;
  let listings = 0;
  let collectionItems = 0;
  while (Date.now() < deadline - TITLE_BACKFILL_RESERVE_MS) {
    const cards = await prisma.catalogCard.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: "asc" },
      take: TITLE_PAGE,
      select: {
        id: true,
        nameEn: true,
        collectorNumber: true,
        numberKey: true,
        printRegion: true,
        rarity: true,
        finish: true,
        game: true,
        set: { select: { code: true, nameEn: true, releaseDate: true } },
      },
    });
    if (!cards.length) return { done: true, cursor: null, scanned, listings, collectionItems };
    for (const card of cards) {
      if (Date.now() >= deadline - TITLE_BACKFILL_RESERVE_MS) {
        return { done: false, cursor, scanned, listings, collectionItems };
      }
      const plan = catalogTitleRewrite({
        releaseDate: card.set.releaseDate,
        setName: card.set.nameEn,
        setCode: card.set.code,
        printRegion: card.printRegion,
        collectorNumber: card.collectorNumber,
        numberKey: card.numberKey,
        cardName: card.nameEn,
        finish: card.finish,
        rarity: card.rarity,
        game: card.game,
      });
      if (plan.previousListingTitles.length) {
        const result = await prisma.listing.updateMany({
          where: { catalogCardId: card.id, title: { in: plan.previousListingTitles } },
          data: { title: plan.listingTitle },
        });
        listings += result.count;
      }
      if (plan.previousCollectionTitles.length) {
        const result = await prisma.collectionItem.updateMany({
          where: { catalogCardId: card.id, title: { in: plan.previousCollectionTitles } },
          data: { title: plan.collectionTitle },
        });
        collectionItems += result.count;
      }
      cursor = card.id;
      scanned += 1;
    }
    if (cards.length < TITLE_PAGE) return { done: true, cursor: null, scanned, listings, collectionItems };
  }
  return { done: false, cursor, scanned, listings, collectionItems };
}

/**
 * Walk usable TCGdex EN + JA sets until the deadline or `maxSets`.
 * Call again with the returned cursor (or with no cursor) until `done`.
 */
export async function ingestDex(opts?: IngestDexOptions): Promise<IngestDexResult> {
  const deadline = Date.now() + (opts?.deadlineMs ?? 45_000);
  const maxSets = opts?.maxSets ?? DEFAULT_MAX_SETS;
  const langs = opts?.langs?.length ? opts.langs : (["ja", "en"] as const);
  const queue = await listDexSetQueue(langs);
  const progress = await loadProgress(queue);
  const settled = new Set(queue.filter((item) => dexSetSettled(item, progress.get(item.externalId))).map((item) => item.externalId));
  const plan = planDexBatch(queue, { cursor: opts?.cursor ?? null, settled, maxSets });

  let sets = 0;
  let cardsWritten = 0;
  const processedSetIds: string[] = [];
  const pending: { externalId: string; source: string }[] = [];
  let pause: { externalId: string; cardOffset: number } | null = null;

  for (const step of plan.steps) {
    if (pause) break;
    if (ingestPastSoftDeadline(Date.now(), deadline, SET_START_RESERVE_MS)) {
      pause = { externalId: step.item.externalId, cardOffset: step.cardOffset };
      break;
    }

    let mapped: (MappedSet & { cards: MappedCard[] }) | null;
    try {
      mapped = await fetchMappedSet(step.item.lang, step.item.id);
    } catch (error) {
      console.error("tcgdex set retry", step.item.externalId, error instanceof Error ? error.message.slice(0, 160) : "error");
      pause = { externalId: step.item.externalId, cardOffset: step.cardOffset };
      break;
    }

    if (!mapped || mapped.cards.length === 0) {
      await upsertSets([markerSet(step.item, 0, mapped)]);
      settled.add(step.item.externalId);
      processedSetIds.push(step.item.externalId);
      sets += 1;
      continue;
    }

    const { cards, ...meta } = mapped;
    const priors = await prisma.catalogCard.findMany({
      where: { externalId: { in: cards.map((card) => card.externalId) } },
      select: { externalId: true, imageUrl: true, sourceImageUrl: true },
    });
    const previous = new Map(priors.map((row) => [row.externalId, row]));
    let index = 0;
    while (index < cards.length && previous.has(cards[index]!.externalId)) index += 1;

    if (index >= cards.length) {
      if (cards.length < step.item.total) await upsertSets([{ ...meta, total: cards.length }]);
      else if (!progress.has(meta.externalId)) await upsertSets([meta]);
      settled.add(step.item.externalId);
      processedSetIds.push(step.item.externalId);
      sets += 1;
      continue;
    }

    const setIds = await upsertSets([meta]);
    const setId = setIds.get(meta.externalId);
    if (!setId) {
      pause = { externalId: step.item.externalId, cardOffset: index };
      break;
    }

    while (index < cards.length) {
      if (ingestPastSoftDeadline(Date.now(), deadline, CHUNK_RESERVE_MS)) {
        pause = { externalId: step.item.externalId, cardOffset: index };
        break;
      }
      const chunk: MappedCard[] = [];
      while (index < cards.length && chunk.length < CARD_CHUNK) {
        const card = cards[index]!;
        index += 1;
        if (!previous.has(card.externalId)) chunk.push(card);
      }
      if (!chunk.length) continue;
      const hydrated = await hydrateDexCards(step.item.lang, chunk);
      await upsertHydratedCards(hydrated, setId, previous, pending);
      for (const card of hydrated) previous.set(card.externalId, { externalId: card.externalId, imageUrl: card.sourceImageUrl, sourceImageUrl: card.sourceImageUrl });
      cardsWritten += hydrated.length;
    }

    if (pause) break;
    if (cards.length < step.item.total) await upsertSets([{ ...meta, total: cards.length }]);
    settled.add(step.item.externalId);
    processedSetIds.push(step.item.externalId);
    sets += 1;
  }

  let cursor: string | null = null;
  if (pause) cursor = formatDexCursor(pause.externalId, pause.cardOffset);
  else if (processedSetIds.length) cursor = formatDexCursor(processedSetIds[processedSetIds.length - 1]!, null);
  let remainingSets = dexUnsettledRemaining(queue, settled, cursor);
  const done = !pause && remainingSets === 0;
  if (done) {
    cursor = null;
    remainingSets = 0;
  }

  const linked = await runIngestPostSteps({
    done,
    deadline,
    reserveMs: INGEST_POST_RESERVE_MS,
    backfill: (until) => backfillEnglishNames(until),
    link: (until) => linkCatalogListings({ deadlineMs: until }),
  });

  let imagesUploaded = 0;
  if (r2Config() && Date.now() < deadline) {
    imagesUploaded += await mirrorImages(pending, deadline);
    if (Date.now() < deadline - 2_000) {
      const backlog = await listUnmirrored(40);
      const seen = new Set(pending.map((item) => item.externalId));
      imagesUploaded += await mirrorImages(
        backlog.filter((item) => !seen.has(item.externalId)),
        deadline,
      );
    }
  }
  const imagesPending = await countUnmirrored();

  return {
    done,
    cursor,
    remainingSets,
    processedSetIds,
    counts: {
      sets,
      cards: cardsWritten,
      imagesUploaded,
      listingsLinked: linked.listings,
      collectionLinked: linked.collectionItems,
      r2: Boolean(r2Config()),
      skippedSettled: plan.skippedSettled,
      imagesPending,
    },
  };
}
