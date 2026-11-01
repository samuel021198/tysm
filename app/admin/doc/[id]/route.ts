import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imageFromDataUrl, r2Config, readPrivateVerificationObject, readPublicVerificationObject } from "@/lib/r2";
import { classifyVerificationDoc, sniffImageType } from "@/lib/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only preview. The stored ref never goes in the page. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN") return new Response(null, { status: 403 });
  const { id } = await context.params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return new Response(null, { status: 404 });
  const row = await prisma.verificationApplication.findUnique({ where: { id }, select: { documentUrl: true } });
  if (!row) return new Response(null, { status: 404 });
  const kind = classifyVerificationDoc(row.documentUrl, r2Config()?.publicBase ?? null);
  const image =
    kind.kind === "legacy-data"
      ? imageFromDataUrl(row.documentUrl)
      : kind.kind === "private"
        ? await readPrivateVerificationObject(kind.key)
        : kind.kind === "legacy-public"
          ? await readPublicVerificationObject(kind.key)
          : null;
  if (!image) return new Response(null, { status: 404 });
  const type = sniffImageType(image.contentType, image.body);
  if (!type) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.body), {
    headers: {
      "content-type": type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
