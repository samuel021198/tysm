import { catalogCursor, catalogRemaining, catalogSetSettled, planCatalogSteps } from "./catalog-batch";
import { drainCatalogImages } from "./catalog-r2";
import type { CatalogPrinting, CatalogPrintingSet } from "./catalog-source";
import { prisma } from "./db";
import { DEX_PLACEHOLDER, INGEST_POST_RESERVE_MS, ingestPastSoftDeadline, runIngestPostSteps, type DexGame } from "./dex";
import { linkCatalogListings } from "./dex-link";
import { keptMirroredUrl, r2Config } from "./r2";
import { fetchOfficialSet, listOfficialQueue, type OfficialQueueItem } from "./op-official";
import { fetchOptcgSet, listOptcgQueue, type OptcgQueueItem } from "./optcg";
import { loadRiftBulk, riftSet, type RiftQueueItem } from "./riftbound";
import { toppsPrintingSet, toppsQueue, type ToppsGame } from "./topps";

const CARD_CHUNK = 40;
const SET_START_RESERVE_MS = 12_000;
const CHUNK_RESERVE_MS = 6_000;
const NAME_PAGE = 80;

type WalkItem = {
  externalId: string;
  lang: "en" | "ja";
  kind: OptcgQueueItem["kind"] | OfficialQueueItem["kind"] | RiftQueueItem["kind"] | "topps";
  id: string;
  name: string;
  code: string;
  releaseDate?: string;
};

export type GameIngestResult = {
  done: boolean;
  cursor: string | null;
  remainingSets: number;
  processedSetIds: string[];
  counts: {
    sets: number;
    cards: number;
    imagesUploaded: number;
    listingsLinked: number;
    collectionLinked: number;
    r2: boolean;
    skippedSettled: number;
    imagesPending: number;
  };
};

function storedSetId(item: WalkItem): string {
  if (item.kind === "official") return `op-jp:${item.id}`;
  if (item.kind === "rift") return `rb:${item.id}`;
  if (item.kind === "topps") return `tb:${item.id}`;
  return `op-en:${item.code}`;
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

async function loadProgress(queue: WalkItem[]) {
  const ids = queue.map(storedSetId);
  if (!ids.length) return new Map<string, { count: number; total: number | null }>();
  const rows = await prisma.catalogSet.findMany({
    where: { externalId: { in: ids } },
    select: { externalId: true, total: true, _count: { select: { cards: true } } },
  });
  const byStored = new Map(rows.map((row) => [row.externalId, { count: row._count.cards, total: row.total }]));
  return new Map(queue.map((item) => [item.externalId, byStored.get(storedSetId(item)) || { count: 0, total: null }]));
}

async function upsertPrintingSet(game: DexGame, set: CatalogPrintingSet, total: number | null) {
  const data = {
    game,
    printRegion: set.printRegion,
    code: set.code,
    nameEn: set.nameEn,
    nameJa: set.nameJa,
    series: set.series,
    releaseDate: set.releaseDate,
    total,
    logoUrl: null as string | null,
  };
  const row = await prisma.catalogSet.upsert({
    where: { externalId: set.externalId },
    update: data,
    create: { externalId: set.externalId, ...data },
  });
  return row.id;
}

async function enrichJapaneseNames(cards: CatalogPrinting[]): Promise<CatalogPrinting[]> {
  const codes = [...new Set(cards.flatMap((card) => [card.collectorNumber, card.collectorNumber.split("_")[0] || ""]).filter(Boolean))];
  if (!codes.length) return cards;
  const rows = await prisma.catalogCard.findMany({
    where: { game: "ONE_PIECE", printRegion: "WEST", collectorNumber: { in: codes } },
    select: { collectorNumber: true, nameEn: true },
  });
  const byCode = new Map(rows.map((row) => [row.collectorNumber, row.nameEn]));
  return cards.map((card) => {
    const nameEn = byCode.get(card.collectorNumber) || byCode.get(card.collectorNumber.split("_")[0] || "");
    if (!nameEn || hasJapanese(nameEn)) return card;
    return { ...card, nameEn };
  });
}

async function upsertPrintings(
  game: DexGame,
  setId: string,
  printRegion: CatalogPrintingSet["printRegion"],
  cards: CatalogPrinting[],
): Promise<{ externalId: string; source: string }[]> {
  const prepared = game === "ONE_PIECE" && printRegion === "JP" ? await enrichJapaneseNames(cards) : cards;
  const r2 = r2Config();
  const previous = new Map<string, { imageUrl: string; sourceImageUrl: string | null }>();
  if (r2 && prepared.some((card) => card.sourceImageUrl.startsWith("https://"))) {
    const rows = await prisma.catalogCard.findMany({
      where: { externalId: { in: prepared.map((card) => card.externalId) } },
      select: { externalId: true, imageUrl: true, sourceImageUrl: true },
    });
    for (const row of rows) previous.set(row.externalId, row);
  }
  const pending: { externalId: string; source: string }[] = [];
  for (const card of prepared) {
    const source = card.sourceImageUrl;
    const kept = keptMirroredUrl(previous.get(card.externalId), source);
    const imageUrl = kept ?? (source.startsWith("https://") ? source : DEX_PLACEHOLDER);
    const data = {
      setId,
      game,
      printRegion,
      collectorNumber: card.collectorNumber,
      numberKey: card.numberKey,
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      imageUrl,
      sourceImageUrl: source || null,
      rarity: card.rarity,
      artist: card.artist,
      finish: card.finish ?? null,
    };
    await prisma.catalogCard.upsert({
      where: { externalId: card.externalId },
      update: data,
      create: { externalId: card.externalId, ...data },
    });
    if (!kept && r2 && source.startsWith("https://")) pending.push({ externalId: card.externalId, source });
  }
  return pending;
}

async function fetchItem(item: WalkItem, riftCards: Map<string, CatalogPrinting[]> | null): Promise<CatalogPrintingSet | null> {
  if (item.kind === "topps") return toppsPrintingSet(item.id);
  if (item.kind === "rift") {
    const queueItem: RiftQueueItem = { ...item, lang: "en", kind: "rift", releaseDate: item.releaseDate || "" };
    return riftSet(queueItem, riftCards?.get(item.id) || []);
  }
  if (item.kind === "official") return fetchOfficialSet(item as OfficialQueueItem);
  return fetchOptcgSet(item as OptcgQueueItem);
}

/**
 * Copy English names onto Japanese One Piece rows that still show the Japanese string.
 * One read of the English catalog, then paged updates. Not a listing×card scan.
 */
export async function backfillOnePieceEnglish(deadlineMs: number) {
  if (Date.now() >= deadlineMs) return;
  const [englishCards, englishSets] = await Promise.all([
    prisma.catalogCard.findMany({
      where: { game: "ONE_PIECE", printRegion: "WEST" },
      select: { collectorNumber: true, nameEn: true },
    }),
    prisma.catalogSet.findMany({
      where: { game: "ONE_PIECE", printRegion: "WEST" },
      select: { code: true, nameEn: true },
    }),
  ]);
  const byCode = new Map<string, string>();
  for (const row of englishCards) {
    if (!row.nameEn || hasJapanese(row.nameEn)) continue;
    if (!byCode.has(row.collectorNumber)) byCode.set(row.collectorNumber, row.nameEn);
    const base = row.collectorNumber.split("_")[0] || "";
    if (base && !byCode.has(base)) byCode.set(base, row.nameEn);
  }
  const setName = new Map(englishSets.filter((row) => row.nameEn && row.nameEn !== row.code).map((row) => [row.code, row.nameEn]));
  const jpSets = await prisma.catalogSet.findMany({
    where: { game: "ONE_PIECE", printRegion: "JP" },
    select: { id: true, code: true, nameEn: true },
  });
  for (const set of jpSets) {
    if (Date.now() >= deadlineMs) return;
    const nameEn = setName.get(set.code);
    if (!nameEn || nameEn === set.nameEn) continue;
    if (set.nameEn && set.nameEn !== set.code && !hasJapanese(set.nameEn)) continue;
    await prisma.catalogSet.update({ where: { id: set.id }, data: { nameEn } });
  }
  let cursor = "";
  while (Date.now() < deadlineMs) {
    const cards = await prisma.catalogCard.findMany({
      where: { game: "ONE_PIECE", printRegion: "JP", ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: NAME_PAGE,
      select: { id: true, nameEn: true, nameJa: true, collectorNumber: true },
    });
    if (!cards.length) return;
    for (const card of cards) {
      if (Date.now() >= deadlineMs) return;
      cursor = card.id;
      const base = card.collectorNumber.split("_")[0] || card.collectorNumber;
      const nameEn = byCode.get(card.collectorNumber) || byCode.get(base);
      if (!nameEn || nameEn === card.nameEn) continue;
      if (card.nameEn && card.nameEn !== card.nameJa && !hasJapanese(card.nameEn)) continue;
      await prisma.catalogCard.update({ where: { id: card.id }, data: { nameEn } });
    }
    if (cards.length < NAME_PAGE) return;
  }
}

async function ingestWalk(args: {
  game: Extract<DexGame, "ONE_PIECE" | "RIFTBOUND" | ToppsGame>;
  queue: WalkItem[];
  deadline: number;
  cursor: string | null;
  maxSets: number;
  gapMs: number;
  backfill: (deadlineMs: number) => Promise<void>;
  riftCards?: Map<string, CatalogPrinting[]> | null;
}): Promise<GameIngestResult> {
  const progress = await loadProgress(args.queue);
  const settled = new Set(
    args.queue.filter((item) => catalogSetSettled(progress.get(item.externalId))).map((item) => item.externalId),
  );
  const plan = planCatalogSteps(args.queue, { cursor: args.cursor, settled, maxSets: args.maxSets });
  const riftCards = args.riftCards ?? (args.game === "RIFTBOUND" ? (await loadRiftBulk()).cardsBySet : null);
  let sets = 0;
  let cardsWritten = 0;
  const processedSetIds: string[] = [];
  const pending: { externalId: string; source: string }[] = [];
  let pause: { externalId: string; cardOffset: number } | null = null;
  let fetched = false;

  for (const step of plan.steps) {
    if (pause) break;
    if (ingestPastSoftDeadline(Date.now(), args.deadline, SET_START_RESERVE_MS)) {
      pause = { externalId: step.item.externalId, cardOffset: step.cardOffset };
      break;
    }
    if (fetched && args.gapMs > 0) await new Promise((resolve) => setTimeout(resolve, args.gapMs));
    let mapped: CatalogPrintingSet | null;
    try {
      mapped = await fetchItem(step.item, riftCards);
      fetched = args.gapMs > 0;
    } catch (error) {
      console.error("catalog set retry", step.item.externalId, error instanceof Error ? error.message.slice(0, 160) : "error");
      pause = { externalId: step.item.externalId, cardOffset: step.cardOffset };
      break;
    }
    if (!mapped || mapped.cards.length === 0) {
      await upsertPrintingSet(args.game, mapped || emptySet(step.item), 0);
      settled.add(step.item.externalId);
      processedSetIds.push(step.item.externalId);
      sets += 1;
      continue;
    }
    let index = Math.min(step.cardOffset, mapped.cards.length);
    const setId = await upsertPrintingSet(args.game, mapped, null);
    while (index < mapped.cards.length) {
      if (ingestPastSoftDeadline(Date.now(), args.deadline, CHUNK_RESERVE_MS)) {
        pause = { externalId: step.item.externalId, cardOffset: index };
        break;
      }
      const chunk = mapped.cards.slice(index, index + CARD_CHUNK);
      index += chunk.length;
      pending.push(...(await upsertPrintings(args.game, setId, mapped.printRegion, chunk)));
      cardsWritten += chunk.length;
    }
    if (pause) break;
    await upsertPrintingSet(args.game, mapped, mapped.cards.length);
    settled.add(step.item.externalId);
    processedSetIds.push(step.item.externalId);
    sets += 1;
  }

  let cursor: string | null = null;
  if (pause) cursor = catalogCursor(pause.externalId, pause.cardOffset);
  else if (processedSetIds.length) cursor = catalogCursor(processedSetIds[processedSetIds.length - 1]!, null);
  let remainingSets = catalogRemaining(args.queue, settled, cursor);
  const done = !pause && remainingSets === 0;
  if (done) {
    cursor = null;
    remainingSets = 0;
  }
  const linked = await runIngestPostSteps({
    done,
    deadline: args.deadline,
    reserveMs: INGEST_POST_RESERVE_MS,
    backfill: args.backfill,
    link: (until) => linkCatalogListings({ deadlineMs: until, game: args.game }),
  });
  const images = await drainCatalogImages(args.game, pending, args.deadline);
  return {
    done,
    cursor,
    remainingSets,
    processedSetIds,
    counts: {
      sets,
      cards: cardsWritten,
      imagesUploaded: images.uploaded,
      listingsLinked: linked.listings,
      collectionLinked: linked.collectionItems,
      r2: images.configured,
      skippedSettled: plan.skippedSettled,
      imagesPending: images.pending,
    },
  };
}

function emptySet(item: WalkItem): CatalogPrintingSet {
  return {
    externalId: storedSetId(item),
    printRegion: item.lang === "ja" ? "JP" : "WEST",
    code: item.code,
    nameEn: item.name,
    nameJa: item.name,
    series: null,
    releaseDate: item.releaseDate || null,
    cards: [],
  };
}

async function onePieceQueue(langs: readonly ("en" | "ja")[]): Promise<WalkItem[]> {
  const items: WalkItem[] = [];
  if (langs.includes("en")) items.push(...(await listOptcgQueue()));
  if (langs.includes("ja")) items.push(...(await listOfficialQueue()));
  return items;
}

export async function ingestOnePiece(opts?: {
  deadlineMs?: number;
  cursor?: string | null;
  maxSets?: number;
  langs?: readonly ("en" | "ja")[];
}): Promise<GameIngestResult> {
  const langs = opts?.langs?.length ? opts.langs : (["en", "ja"] as const);
  const queue = await onePieceQueue(langs);
  const gapMs = langs.length === 1 && langs[0] === "ja" ? 600 : langs.includes("ja") ? 450 : 300;
  return ingestWalk({
    game: "ONE_PIECE",
    queue,
    deadline: Date.now() + (opts?.deadlineMs ?? 45_000),
    cursor: opts?.cursor ?? null,
    maxSets: opts?.maxSets ?? 3,
    gapMs,
    backfill: (until) => backfillOnePieceEnglish(until),
  });
}

export async function ingestRiftbound(opts?: {
  deadlineMs?: number;
  cursor?: string | null;
  maxSets?: number;
}): Promise<GameIngestResult> {
  const bulk = await loadRiftBulk();
  return ingestWalk({
    game: "RIFTBOUND",
    queue: bulk.sets,
    deadline: Date.now() + (opts?.deadlineMs ?? 45_000),
    cursor: opts?.cursor ?? null,
    maxSets: opts?.maxSets ?? 4,
    gapMs: 0,
    riftCards: bulk.cardsBySet,
    backfill: async () => {},
  });
}

/** Names from committed `data/topps` JSON. No images and no third-party fetch. */
export async function ingestTopps(
  game: ToppsGame,
  opts?: { deadlineMs?: number; cursor?: string | null; maxSets?: number },
): Promise<GameIngestResult> {
  return ingestWalk({
    game,
    queue: toppsQueue(game),
    deadline: Date.now() + (opts?.deadlineMs ?? 45_000),
    cursor: opts?.cursor ?? null,
    maxSets: opts?.maxSets ?? 3,
    gapMs: 0,
    backfill: async () => {},
  });
}
