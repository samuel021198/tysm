import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBlocked } from "@/lib/social";
import { isStoryActive } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** One active story frame. The home rail does not embed image bytes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await prisma.story.findUnique({
    where: { id },
    select: { imageUrl: true, expiresAt: true, authorId: true },
  });
  if (!story || !isStoryActive(story.expiresAt)) {
    return Response.json({ ok: false }, { status: 404, headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await getViewer();
  if (viewer && viewer.id !== story.authorId && (await isBlocked(viewer.id, story.authorId))) {
    return Response.json({ ok: false }, { status: 404, headers: { "cache-control": "private, no-store" } });
  }
  return Response.json(
    { imageUrl: story.imageUrl },
    { headers: { "cache-control": "private, no-store" } },
  );
}
