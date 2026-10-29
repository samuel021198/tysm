import { revalidatePath } from "next/cache";
import { authorizedBearer } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import {
  copyVerificationToPrivate,
  deletePublicVerificationObject,
  imageFromDataUrl,
  r2Config,
  r2PrivateConfig,
  readPrivateVerificationObject,
} from "@/lib/r2";
import {
  classifyVerificationDoc,
  parseVerificationDecision,
  planVerificationReview,
  privateDocKey,
  publicVerificationKey,
  reviewDocumentAccess,
  sniffImageType,
} from "@/lib/verification";

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

function imageResponse(body: Buffer, contentType: string) {
  const type = sniffImageType(contentType, body);
  if (!type) return fail("verify_document", 404);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

async function relocateRow(id: string, sourceKey: string, publicBase: string): Promise<boolean> {
  let ref: string | null;
  try {
    ref = await copyVerificationToPrivate(sourceKey);
  } catch (error) {
    console.error("verification relocate failed", error instanceof Error ? error.message.slice(0, 160) : "error");
    return false;
  }
  if (!ref || !privateDocKey(ref)) return false;
  const updated = await prisma.verificationApplication.updateMany({
    where: { id, documentUrl: { startsWith: `${publicBase}/` } },
    data: { documentUrl: ref },
  });
  if (updated.count !== 1) return false;
  try {
    const deleted = await deletePublicVerificationObject(sourceKey);
    if (!deleted) console.error("verification public delete failed");
  } catch (error) {
    console.error("verification public delete failed", error instanceof Error ? error.message.slice(0, 160) : "error");
  }
  return true;
}

// ponytail: five public objects per list. Repeat GET until relocated is 0. A failed public delete leaves the old object; remove uploads/verification/ on the public bucket after the queue is caught up.
async function relocatePublicVerificationDocs(): Promise<number> {
  const pub = r2Config();
  if (!pub || !r2PrivateConfig()) return 0;
  const rows = await prisma.verificationApplication.findMany({
    where: { documentUrl: { startsWith: `${pub.publicBase}/` } },
    select: { id: true, documentUrl: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let moved = 0;
  for (const row of rows) {
    if (moved >= 5) break;
    const key = publicVerificationKey(row.documentUrl, pub.publicBase);
    if (!key) continue;
    try {
      if (await relocateRow(row.id, key, pub.publicBase)) moved += 1;
    } catch (error) {
      console.error("verification relocate failed", error instanceof Error ? error.message.slice(0, 160) : "error");
    }
  }
  return moved;
}

async function serveDocument(id: string) {
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return fail("verify_id", 400);
  const row = await prisma.verificationApplication.findUnique({
    where: { id },
    select: { documentUrl: true },
  });
  if (!row) return fail("not_found", 404);
  const base = r2Config()?.publicBase ?? null;
  let documentUrl = row.documentUrl;
  let kind = classifyVerificationDoc(documentUrl, base);
  if (kind.kind === "legacy-public" && base) {
    try {
      await relocateRow(id, kind.key, base);
    } catch (error) {
      console.error("verification relocate failed", error instanceof Error ? error.message.slice(0, 160) : "error");
    }
    const again = await prisma.verificationApplication.findUnique({
      where: { id },
      select: { documentUrl: true },
    });
    if (!again) return fail("not_found", 404);
    documentUrl = again.documentUrl;
    kind = classifyVerificationDoc(documentUrl, base);
  }
  if (kind.kind === "legacy-public") return fail(r2PrivateConfig() ? "verify_document" : "needs_private_bucket", r2PrivateConfig() ? 404 : 409);
  if (kind.kind === "private") {
    try {
      const obj = await readPrivateVerificationObject(kind.key);
      if (!obj) return fail("verify_document", 404);
      return imageResponse(obj.body, obj.contentType);
    } catch (error) {
      console.error("verification document read failed", error instanceof Error ? error.message.slice(0, 160) : "error");
      return fail("verify_document", 404);
    }
  }
  if (kind.kind === "legacy-data") {
    const image = imageFromDataUrl(documentUrl);
    if (!image) return fail("verify_document", 404);
    return imageResponse(image.body, image.contentType);
  }
  return fail("verify_document", 404);
}

export async function GET(request: Request) {
  const denied = authorized(request);
  if (denied) return denied;
  const documentId = new URL(request.url).searchParams.get("document")?.trim() ?? "";
  if (documentId) return serveDocument(documentId);
  const relocated = await relocatePublicVerificationDocs();
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
  const publicBase = r2Config()?.publicBase ?? null;
  const privateReady = Boolean(r2PrivateConfig());
  return Response.json({
    ok: true,
    relocated,
    applications: applications.map((row) => {
      const { documentUrl, ...safe } = row;
      return { ...safe, ...reviewDocumentAccess(row.id, documentUrl, publicBase, privateReady) };
    }),
  });
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
