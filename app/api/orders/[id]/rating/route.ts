import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateDeal, readRatingStars } from "@/lib/ratings";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return json({ error: "login" }, 401);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "stars" }, 400);
  }
  const raw = payload && typeof payload === "object" ? (payload as { stars?: unknown; comment?: unknown }) : {};
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      buyerId: true,
      sellerId: true,
      ratings: { select: { authorId: true } },
    },
  });
  if (!order) return json({ error: "not_done" }, 404);
  const gate = rateDeal({
    status: order.status,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    authorId: viewer.id,
    alreadyRatedBy: order.ratings.map((row) => row.authorId),
    stars: readRatingStars(raw.stars),
    comment: typeof raw.comment === "string" ? raw.comment : "",
  });
  if (!gate.ok) {
    const status = gate.error === "once" ? 409 : gate.error === "party" ? 403 : 400;
    return json({ error: gate.error }, status);
  }
  try {
    await prisma.dealRating.create({
      data: {
        orderId: id,
        authorId: viewer.id,
        subjectId: gate.subjectId,
        stars: gate.stars,
        comment: gate.comment,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "once" }, 409);
    }
    throw error;
  }
  revalidatePath(`/shop/${gate.subjectId}`);
  revalidatePath("/me");
  revalidatePath(`/orders/${id}`);
  return json({ ok: true, stars: gate.stars }, 201);
}
