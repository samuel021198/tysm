import { NextResponse } from "next/server";
import { catalogSuggestion, rankCatalogSuggestions, type CatalogSuggestCard } from "@/lib/catalog-suggest";
import { prisma } from "@/lib/db";
import { catalogSuggestWhere } from "@/lib/dex";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ cards: [] });
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
    set: { select: { code: true, nameEn: true, nameJa: true, series: true, releaseDate: true } },
    _count: { select: { listings: true } },
  } as const;
  const orderBy = [{ listings: { _count: "desc" as const } }, { set: { releaseDate: "desc" as const } }];
  const named = await prisma.catalogCard.findMany({ where: catalogSuggestWhere(q), select, orderBy, take: 40 });
  // ponytail: rank at most 40 anchor hits in memory. Upgrade path: a search index if the dex outgrows this.
  const cards: (CatalogSuggestCard & { imageUrl: string; game: string })[] = named.map((row) => ({
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
    setCode: row.set.code,
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
