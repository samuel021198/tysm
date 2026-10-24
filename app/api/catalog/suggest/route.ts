import { NextResponse } from "next/server";
import { catalogSuggestion, catalogYear, rankCatalogSuggestions, type CatalogSuggestCard } from "@/lib/catalog-suggest";
import { prisma } from "@/lib/db";
import { catalogWhere } from "@/lib/dex";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ cards: [] });
  const year = catalogYear(q);
  const select = {
    id: true,
    nameEn: true,
    nameJa: true,
    collectorNumber: true,
    numberKey: true,
    printRegion: true,
    rarity: true,
    finish: true,
    imageUrl: true,
    game: true,
    set: { select: { nameEn: true, nameJa: true, series: true, releaseDate: true } },
    _count: { select: { listings: true } },
  } as const;
  const orderBy = [{ listings: { _count: "desc" as const } }, { set: { releaseDate: "desc" as const } }];
  const [named, fromYear] = await Promise.all([
    prisma.catalogCard.findMany({ where: catalogWhere(q, null), select, orderBy, take: 40 }),
    year
      ? prisma.catalogCard.findMany({ where: { set: { releaseDate: { startsWith: year } } }, select, orderBy, take: 40 })
      : Promise.resolve([]),
  ]);
  const rows = [...new Map([...named, ...fromYear].map((row) => [row.id, row])).values()];
  // ponytail: rank at most 80 name-or-year hits in memory. Upgrade path: a search index if the dex outgrows this.
  const cards: (CatalogSuggestCard & { imageUrl: string; game: string })[] = rows.map((row) => ({
    id: row.id,
    nameEn: row.nameEn,
    nameJa: row.nameJa,
    collectorNumber: row.collectorNumber,
    numberKey: row.numberKey,
    printRegion: row.printRegion,
    rarity: row.rarity,
    finish: row.finish,
    listingCount: row._count.listings,
    setNameEn: row.set.nameEn,
    setNameJa: row.set.nameJa,
    series: row.set.series,
    releaseDate: row.set.releaseDate,
    imageUrl: row.imageUrl,
    game: row.game,
  }));
  return NextResponse.json({
    cards: rankCatalogSuggestions(cards, q, 12).map((row) => ({
      ...catalogSuggestion(row, row.game),
      imageUrl: row.imageUrl,
    })),
  });
}
