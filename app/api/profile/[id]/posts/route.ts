import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profilePostsPage } from "@/lib/profile";
import { isBlocked } from "@/lib/social";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "missing" }, { status: 404 });
  if (viewer && viewer.id !== id && (await isBlocked(viewer.id, id))) {
    return NextResponse.json({ error: "missing" }, { status: 404 });
  }
  const cursor = new URL(request.url).searchParams.get("cursor");
  const page = await profilePostsPage(id, viewer?.id ?? null, cursor);
  return NextResponse.json(page);
}
