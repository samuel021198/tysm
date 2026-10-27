import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { cleanComment } from "@/lib/comments";
import { prisma } from "@/lib/db";
import { isBlocked } from "@/lib/social";

export const dynamic = "force-dynamic";

const authorSelect = { id: true, nickname: true, avatarUrl: true } as const;

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: authorSelect },
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

async function readable(postId: string, viewerId: string | null) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, collectionItem: { select: { visibility: true, ownerId: true } } },
  });
  if (!post) return null;
  if (post.collectionItem?.visibility === "PRIVATE" && post.collectionItem.ownerId !== viewerId) return null;
  if (viewerId && post.authorId !== viewerId && (await isBlocked(viewerId, post.authorId))) return null;
  return post;
}

function present(comment: { id: string; body: string; createdAt: Date; author: { id: string; nickname: string; avatarUrl: string | null } }) {
  return { id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString(), author: comment.author };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const post = await readable(id, viewer?.id ?? null);
  if (!post) return json({ error: "forbidden" }, 404);
  const comments = await prisma.postComment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: commentSelect,
  });
  return json({
    comments: comments.map(present),
    viewer: viewer ? { id: viewer.id, nickname: viewer.nickname, avatarUrl: viewer.avatarUrl } : null,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return json({ error: "login" }, 401);
  const post = await readable(id, viewer.id);
  if (!post) return json({ error: "forbidden" }, 404);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "comment" }, 400);
  }
  const raw = payload && typeof payload === "object" && "body" in payload ? (payload as { body?: unknown }).body : "";
  const body = cleanComment(String(raw ?? "").slice(0, 400));
  if (!body) return json({ error: "comment" }, 400);
  const comment = await prisma.postComment.create({
    data: { postId: id, authorId: viewer.id, body },
    select: commentSelect,
  });
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/me/favorites");
  return json({ comment: present(comment) }, 201);
}
