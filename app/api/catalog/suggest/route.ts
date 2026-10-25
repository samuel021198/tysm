import { NextResponse } from "next/server";
import { catalogImageSrc } from "@/lib/catalog-image";
import { catalogSuggestion, rankCatalogSuggestions, type CatalogSuggestCard } from "@/lib/catalog-suggest";
import { prisma } from "@/lib/db";
import { catalogSuggestWhere, gameHasRegion, parseGame, parseRegion } from "@/lib/dex";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const game = parseGame(url.searchParams.get("game"));
  if (q.length < 2) return NextResponse.json({ cards: [] });
  const region = game && !gameHasRegion(game) ? null : parseRegion(url.searchParams.get("region"));
  const matched = catalogSuggestWhere(q, region);
  const where = game ? { AND: [matched, { game }] } : matched;
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
  } as const;
  // Release date uses the set index. Ordering matches by listing count sorts the whole hit set.
  const named = await prisma.catalogCard.findMany({
    where,
    select,
    orderBy: [{ set: { releaseDate: "desc" } }, { collectorNumber: "asc" }],
    take: 40,
  });
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
    listingCount: 0,
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
      imageUrl: catalogImageSrc(row.imageUrl),
    })),
  });
}
