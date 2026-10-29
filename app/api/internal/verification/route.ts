import { revalidatePath } from "next/cache";
import { authorizedBearer } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { parseVerificationDecision, planVerificationReview } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

function authorized(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return fail("unconfigured", 503);
  if (!authorizedBearer(request.headers.get("authorization"), secret)) return fail("unauthorized", 401);
  return null;
}

export async function GET(request: Request) {
  const denied = authorized(request);
  if (denied) return denied;
  // ponytail: pending queue is the first 50. Add a cursor if the queue outgrows that.
  const applications = await prisma.verificationApplication.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      userId: true,
      track: true,
      reason: true,
      documentUrl: true,
      status: true,
      createdAt: true,
      user: { select: { nickname: true, verificationTier: true } },
    },
  });
  return Response.json({ ok: true, applications });
}

export async function POST(request: Request) {
  const denied = authorized(request);
  if (denied) return denied;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const parsed = parseVerificationDecision(payload);
  if (!parsed.ok) return fail(parsed.error, 400);

  const application = await prisma.verificationApplication.findUnique({
    where: { id: parsed.applicationId },
    select: {
      id: true,
      userId: true,
      track: true,
      status: true,
      user: { select: { verificationTier: true } },
    },
  });
  if (!application) return fail("not_found", 404);

  const plan = planVerificationReview({
    applicationStatus: application.status,
    track: application.track,
    currentTier: application.user.verificationTier,
    decision: parsed.decision,
  });
  if (!plan.ok) return fail(plan.error, 409);

  try {
    const wrote = await prisma.$transaction(async (tx) => {
      const updated = await tx.verificationApplication.updateMany({
        where: { id: application.id, status: "PENDING" },
        data: { status: plan.applicationStatus, decidedAt: new Date() },
      });
      if (updated.count !== 1) return false;
      if (plan.setTier) {
        await tx.user.update({
          where: { id: application.userId },
          data: { verificationTier: plan.tier },
        });
      }
      return true;
    });
    if (!wrote) return fail("verify_state", 409);
  } catch {
    console.error("verification review failed");
    return fail("review_failed", 500);
  }

  revalidatePath("/me");
  revalidatePath(`/shop/${application.userId}`);
  revalidatePath("/me/settings/verify");
  return Response.json({
    ok: true,
    applicationId: application.id,
    status: plan.applicationStatus,
    tier: plan.tier,
  });
}
