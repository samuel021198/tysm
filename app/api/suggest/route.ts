import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listingQueryWhere, searchScore } from "@/lib/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);
  const rows = await prisma.listing.findMany({
    where: { status: "ACTIVE", quantityAvailable: { gt: 0 }, ...listingQueryWhere(q) },
    select: { id: true, title: true, cardName: true, personName: true, game: true, category: { select: { nameZh: true, nameEn: true } } },
    take: 24,
  });
  rows.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  return NextResponse.json(rows.slice(0, 8).map(({ id, title }) => ({ id, title })));
}
