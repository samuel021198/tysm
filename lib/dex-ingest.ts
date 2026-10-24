import { resolveEnglishCardName, resolveEnglishSetName } from "./card-title";
import { prisma } from "./db";
import { DEX_PLACEHOLDER } from "./dex";
import { linkCatalogListings } from "./dex-link";
import { putR2Object, r2Config } from "./r2";
import { fetchDexSubset, type MappedCard, type MappedSet } from "./tcgdex";

const PER_REGION = 250;
const SETS_PER_REGION = 2;

export type IngestCounts = {
  sets: number;
  cards: number;
  imagesUploaded: number;
  listingsLinked: number;
  collectionLinked: number;
  r2: boolean;
};

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

/** Lexicon pass for rows this run did not refetch. Finish still comes from the card payload. */
async function backfillEnglishNames() {
  const sets = await prisma.catalogSet.findMany({
    where: { printRegion: "JP" },
    select: { id: true, code: true, nameEn: true, nameJa: true },
  });
  for (const set of sets) {
    const nameEn = resolveEnglishSetName(set.nameJa || set.nameEn, set.code);
    if (!nameEn || hasJapanese(nameEn) || nameEn === set.nameEn) continue;
    await prisma.catalogSet.update({ where: { id: set.id }, data: { nameEn } });
  }
  const cards = await prisma.catalogCard.findMany({
    where: { printRegion: "JP" },
    select: { id: true, nameEn: true, nameJa: true },
  });
  for (const card of cards) {
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

export async function ingestDex(opts?: { deadlineMs?: number }): Promise<IngestCounts> {
  const deadline = Date.now() + (opts?.deadlineMs ?? 45_000);
  const [ja, en] = await Promise.all([
    fetchDexSubset("ja", SETS_PER_REGION, PER_REGION),
    fetchDexSubset("en", SETS_PER_REGION, PER_REGION),
  ]);
  const sets = [...ja.sets, ...en.sets];
  const cards: MappedCard[] = [...ja.cards, ...en.cards];
  const setIds = await upsertSets(sets);
  const existing = await prisma.catalogCard.findMany({
    where: { externalId: { in: cards.map((card) => card.externalId) } },
    select: { externalId: true, imageUrl: true, sourceImageUrl: true },
  });
  const previous = new Map(existing.map((row) => [row.externalId, row]));
  const r2 = r2Config();
  const pending: { externalId: string; source: string }[] = [];

  for (const card of cards) {
    const setId = setIds.get(card.setExternalId);
    if (!setId) continue;
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

  let imagesUploaded = 0;
  if (r2 && pending.length) {
    await pool(pending, 4, async (item) => {
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
  }

  await backfillEnglishNames();
  const linked = await linkCatalogListings();
  return {
    sets: sets.length,
    cards: cards.length,
    imagesUploaded,
    listingsLinked: linked.listings,
    collectionLinked: linked.collectionItems,
    r2: Boolean(r2),
  };
}
