import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { catalogWhere, categorySlugForGame, pickCatalogCard, type DexGame, type DexPrintRegion } from "./dex";
import { loadLinkCards } from "./dex-link";
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
  set: { select: { code: true, nameEn: true, nameJa: true, releaseDate: true, series: true } },
} satisfies Prisma.CatalogCardSelect;

export type DexCardRow = Prisma.CatalogCardGetPayload<{ select: typeof cardSelect }>;

export async function searchCatalog(input: { q?: string; region: DexPrintRegion | null; game?: DexGame | null; page?: number; take?: number }) {
  const take = input.take ?? 24;
  const page = Math.max(1, Math.min(40, input.page ?? 1));
  const where = catalogWhere(input.q || "", input.region, input.game);
  const [total, cards] = await Promise.all([
    prisma.catalogCard.count({ where }),
    prisma.catalogCard.findMany({
      where,
      select: cardSelect,
      orderBy: [{ set: { releaseDate: "desc" } }, { collectorNumber: "asc" }],
      skip: (page - 1) * take,
      take,
    }),
  ]);
  return { total, cards, page, take };
}

export async function hotCatalog(region: DexPrintRegion | null, take = 8, game?: DexGame | null) {
  return prisma.catalogCard.findMany({
    where: catalogWhere("", region, game),
    select: cardSelect,
    orderBy: [{ listings: { _count: "desc" } }, { set: { releaseDate: "desc" } }],
    take,
  });
}

export async function getDexCard(id: string) {
  return prisma.catalogCard.findUnique({ where: { id }, select: cardSelect });
}

export async function salesForCard(cardId: string, hidden: string[], game: DexGame = "POKEMON") {
  const linked = await prisma.listing.findMany({
    where: { AND: [activeWhere(hidden), { OR: [{ catalogCardId: cardId }, { items: { some: { catalogCardId: cardId } } }] }] },
    include: cardInclude,
    orderBy: { publishedAt: "desc" },
    take: 24,
  });
  const loose = await prisma.listing.findMany({
    where: { AND: [activeWhere(hidden), { catalogCardId: null }, { cardKind: "TCG" }, { category: { slug: categorySlugForGame(game) } }] },
    include: cardInclude,
    take: 80,
  });
  if (!loose.length) return linked;
  const cards = await loadLinkCards(game);
  const extra = loose.filter((listing) => pickCatalogCard(listing, cards)?.id === cardId);
  const seen = new Set(linked.map((listing) => listing.id));
  return [...linked, ...extra.filter((listing) => !seen.has(listing.id))].slice(0, 24);
}
