import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);
  const rows = await prisma.listing.findMany({
    where: { status: "ACTIVE", title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true },
    take: 8,
  });
  return NextResponse.json(rows);
}
