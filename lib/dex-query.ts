import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { DEMO_CARDS, DEMO_SETS, POKEMON_DEMO_CARDS, POKEMON_DEMO_SET, pinDemoSet } from "./demo-dex";
import { prisma } from "./db";
import { catalogWhere, numberKey, type DexGame, type DexPrintRegion } from "./dex";
import { activeWhere, cardInclude } from "./feed";

const cardSelect = {
  id: true,
  externalId: true,
  nameEn: true,
  nameJa: true,
  collectorNumber: true,
  imageUrl: true,
  printRegion: true,
  rarity: true,
  artist: true,
  finish: true,
  game: true,
  numberKey: true,
  set: { select: { id: true, code: true, nameEn: true, nameJa: true, releaseDate: true, series: true } },
} satisfies Prisma.CatalogCardSelect;

export type DexCardRow = Prisma.CatalogCardGetPayload<{ select: typeof cardSelect }>;

/** Fields a browse tile actually paints. */
const gridSelect = {
  id: true,
  nameEn: true,
  nameJa: true,
  collectorNumber: true,
  imageUrl: true,
  printRegion: true,
  set: { select: { code: true, releaseDate: true } },
} satisfies Prisma.CatalogCardSelect;

export type DexGridRow = Prisma.CatalogCardGetPayload<{ select: typeof gridSelect }>;

const setSelect = { id: true, code: true, nameEn: true, nameJa: true, printRegion: true, releaseDate: true } satisfies Prisma.CatalogSetSelect;

export type DexSetRow = Prisma.CatalogSetGetPayload<{ select: typeof setSelect }>;

function withSet(where: Prisma.CatalogCardWhereInput, setId?: string | null): Prisma.CatalogCardWhereInput {
  if (!setId) return where;
  if (!Object.keys(where).length) return { setId };
  return { AND: [where, { setId }] };
}

let demoReady: Promise<void> | null = null;

/** Idempotent. Demo rows are not part of the external ingest. */
export function ensureDemoCatalog(): Promise<void> {
  if (!demoReady) {
    demoReady = writeDemoCatalog().catch((error: unknown) => {
      demoReady = null;
      throw error;
    });
  }
  return demoReady;
}

async function writeDemoCatalog() {
  const count = await prisma.catalogCard.count({ where: { game: "DEMO" } });
  if (count < DEMO_CARDS.length) {
    for (const set of DEMO_SETS) {
      const data = {
        game: "DEMO" as const,
        printRegion: "JP" as const,
        code: set.code,
        nameEn: set.nameEn,
        nameJa: set.nameJa,
        series: "Demo",
        releaseDate: set.releaseDate,
      };
      await prisma.catalogSet.upsert({
        where: { externalId: `demo:${set.code}` },
        update: data,
        create: { id: set.id, externalId: `demo:${set.code}`, ...data },
      });
    }
    for (const card of DEMO_CARDS) {
      const data = {
        setId: card.setId,
        game: "DEMO" as const,
        printRegion: "JP" as const,
        collectorNumber: card.number,
        numberKey: numberKey(card.number),
        nameEn: card.nameEn,
        nameJa: card.nameJa,
        imageUrl: card.imageUrl,
        rarity: card.rarity,
      };
      await prisma.catalogCard.upsert({
        where: { externalId: `demo:${card.id}` },
        update: data,
        create: { id: card.id, externalId: `demo:${card.id}`, ...data },
      });
    }
  }
  // Attach showcase listings only while they are still unlinked, so a real dex match is left alone.
  await Promise.all(
    DEMO_CARDS.flatMap((card) =>
      card.listingId
        ? [
            prisma.listing.updateMany({
              where: { id: card.listingId, catalogCardId: null },
              data: { catalogCardId: card.id },
            }),
          ]
        : [],
    ),
  );
}

let pokeDemoReady: Promise<void> | null = null;

/** Idempotent Pokémon DEMO set. Prices stay in demoMarket; this only writes the ten catalog rows. */
export function ensurePokemonDemo(): Promise<void> {
  if (!pokeDemoReady) {
    pokeDemoReady = writePokemonDemo().catch((error: unknown) => {
      pokeDemoReady = null;
      throw error;
    });
  }
  return pokeDemoReady;
}

async function writePokemonDemo() {
  const count = await prisma.catalogCard.count({ where: { setId: POKEMON_DEMO_SET.id } });
  if (count >= POKEMON_DEMO_CARDS.length) return;
  const set = POKEMON_DEMO_SET;
  const setData = {
    game: "POKEMON" as const,
    printRegion: "JP" as const,
    code: set.code,
    nameEn: set.nameEn,
    nameJa: set.nameJa,
    series: "Demo",
    releaseDate: set.releaseDate,
  };
  await prisma.catalogSet.upsert({
    where: { externalId: "pokemon:DEMO" },
    update: setData,
    create: { id: set.id, externalId: "pokemon:DEMO", ...setData },
  });
  for (const card of POKEMON_DEMO_CARDS) {
    const data = {
      setId: set.id,
      game: "POKEMON" as const,
      printRegion: "JP" as const,
      collectorNumber: card.number,
      numberKey: numberKey(card.number),
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      imageUrl: card.imageUrl,
      rarity: card.rarity,
    };
    await prisma.catalogCard.upsert({
      where: { externalId: `pokemon:DEMO:${card.number}` },
      update: data,
      create: { id: card.id, externalId: `pokemon:DEMO:${card.number}`, ...data },
    });
  }
}

export async function listDexSets(game: DexGame, region: DexPrintRegion | null) {
  const sets = await prisma.catalogSet.findMany({
    where: { game, ...(region ? { printRegion: region } : {}) },
    select: setSelect,
    orderBy: [{ releaseDate: "desc" }, { code: "asc" }],
  });
  return pinDemoSet(sets);
}

export async function searchCatalog(input: {
  q?: string;
  region: DexPrintRegion | null;
  game?: DexGame | null;
  setId?: string | null;
  page?: number;
  take?: number;
  count?: boolean;
}) {
  const take = input.take ?? 24;
  const page = Math.max(1, Math.min(40, input.page ?? 1));
  const where = withSet(catalogWhere(input.q || "", input.region, input.game), input.setId);
  const [total, cards] = await Promise.all([
    input.count === false ? Promise.resolve(0) : prisma.catalogCard.count({ where }),
    prisma.catalogCard.findMany({
      where,
      select: gridSelect,
      orderBy: [{ set: { releaseDate: "desc" } }, { collectorNumber: "asc" }],
      skip: (page - 1) * take,
      take,
    }),
  ]);
  return { total, cards, page, take };
}

/**
 * Newest set only. Ordering every card in a game by release date sorts the whole catalog.
 * ponytail: one set, not a personalised mix. Upgrade path: a small ranked id list.
 */
export async function latestSetCards(game: DexGame, region: DexPrintRegion | null, take: number) {
  const set = await prisma.catalogSet.findFirst({
    where: { game, ...(region ? { printRegion: region } : {}), cards: { some: {} } },
    orderBy: [{ releaseDate: "desc" }, { code: "asc" }],
    select: { id: true },
  });
  if (!set) return [];
  return prisma.catalogCard.findMany({
    where: { setId: set.id },
    select: gridSelect,
    orderBy: { collectorNumber: "asc" },
    take,
  });
}

/** Hot cards from listing counts. Avoids sorting every catalog row by `_count`. */
export async function hotCatalog(region: DexPrintRegion | null, take = 8, game?: DexGame | null) {
  const grouped = await prisma.listing.groupBy({
    by: ["catalogCardId"],
    where: {
      status: "ACTIVE",
      catalogCardId: { not: null },
      catalogCard: {
        ...(game ? { game } : {}),
        ...(region ? { printRegion: region } : {}),
      },
    },
    _count: { _all: true },
    orderBy: { _count: { catalogCardId: "desc" } },
    take,
  });
  const ids = grouped.map((row) => row.catalogCardId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const cards = await prisma.catalogCard.findMany({ where: { id: { in: ids } }, select: gridSelect });
  const order = new Map(ids.map((id, index) => [id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export type DexBrowsePayload = {
  game: DexGame;
  region: string;
  setId: string;
  q: string;
  page: number;
  take: number;
  total: number;
  filtered: boolean;
  prompt: boolean;
  sets: DexSetRow[];
  cards: DexGridRow[];
  hot: DexGridRow[];
};

export async function loadDexBrowse(input: {
  q?: string;
  region: DexPrintRegion | null;
  game: DexGame;
  setId?: string;
  page?: number;
  prompt?: boolean;
}): Promise<DexBrowsePayload> {
  if (input.game === "DEMO") await ensureDemoCatalog();
  if (input.game === "POKEMON") await ensurePokemonDemo();
  const q = (input.q || "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(40, input.page ?? 1));
  const sets = await listDexSets(input.game, input.region);
  const set = sets.find((row) => row.id === (input.setId || "").trim()) ?? null;
  const base = { game: input.game, region: input.region || "", setId: set?.id || "", q, sets, prompt: false };
  if (input.prompt && !q && !set) {
    return { ...base, total: 0, cards: [], page: 1, take: 24, hot: [], filtered: false, prompt: true };
  }
  if (q || set) {
    const result = await searchCatalog({ q, region: input.region, game: input.game, setId: set?.id, page, take: 24 });
    return { ...base, ...result, setId: set?.id || "", hot: [], filtered: true };
  }
  if (input.game === "DEMO") {
    const result = await searchCatalog({ region: input.region, game: "DEMO", page: 1, take: 24 });
    return { ...base, ...result, page: 1, hot: [], filtered: false };
  }
  const [cards, hot] = await Promise.all([latestSetCards(input.game, input.region, 8), hotCatalog(input.region, 8, input.game)]);
  const seen = new Set(cards.map((card) => card.id));
  return {
    ...base,
    total: cards.length,
    cards,
    page: 1,
    take: 8,
    hot: hot.filter((card) => !seen.has(card.id)).slice(0, 8),
    filtered: false,
  };
}

export const getDexCard = cache(async (id: string) => {
  if (id.startsWith("demo_card_")) await ensureDemoCatalog();
  if (id.startsWith("poke_demo_")) await ensurePokemonDemo();
  return prisma.catalogCard.findUnique({ where: { id }, select: cardSelect });
});

export async function salesForCard(cardId: string, hidden: string[]) {
  return prisma.listing.findMany({
    where: { AND: [activeWhere(hidden), { OR: [{ catalogCardId: cardId }, { items: { some: { catalogCardId: cardId } } }] }] },
    include: cardInclude,
    orderBy: { publishedAt: "desc" },
    take: 24,
  });
}
