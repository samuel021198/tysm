import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categoryMatches, listingQueryWhere, searchScore } from "@/lib/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!q) return NextResponse.json({ listings: [], categories: [] });
  const [rows, categories] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "ACTIVE", quantityAvailable: { gt: 0 }, ...listingQueryWhere(q) },
      select: {
        id: true,
        title: true,
        cardName: true,
        personName: true,
        game: true,
        category: { select: { slug: true, nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } },
      },
      take: 24,
    }),
    prisma.category.findMany({
      where: { level: { in: ["GROUP", "LEAF"] } },
      select: { slug: true, nameZh: true, nameEn: true },
      orderBy: { sort: "asc" },
    }),
  ]);
  rows.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  return NextResponse.json({
    listings: rows.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.title,
      categorySlug: row.category.slug,
      categoryZh: row.category.nameZh,
      categoryEn: row.category.nameEn,
    })),
    categories: categories.filter((cat) => categoryMatches(q, cat.nameZh, cat.nameEn)).slice(0, 4),
  });
}
