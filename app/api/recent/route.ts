import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json([]);
  const rows = await prisma.searchHistory.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const seen = new Set<string>();
  const recent: { query: string }[] = [];
  for (const row of rows) {
    const query = row.query.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    recent.push({ query });
    if (recent.length >= 12) break;
  }
  return NextResponse.json(recent);
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { all?: boolean; query?: string } | null;
  if (body?.all === true) {
    await prisma.searchHistory.deleteMany({ where: { userId: viewer.id } });
  } else if (typeof body?.query === "string" && body.query.trim()) {
    await prisma.searchHistory.deleteMany({ where: { userId: viewer.id, query: body.query.trim().slice(0, 80) } });
  } else {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
