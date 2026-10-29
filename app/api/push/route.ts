import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";

function subscription(body: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = row.endpoint;
  const p256dh = row.keys?.p256dh;
  const auth = row.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!endpoint.startsWith("https://") || endpoint.length > 2000 || p256dh.length > 200 || auth.length > 200) return null;
  if (p256dh.length < 8 || auth.length < 8) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false }, { status: 401 });
  const parsed = subscription(await request.json().catch(() => null));
  if (!parsed) return Response.json({ ok: false }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: { userId: viewer.id, ...parsed },
    update: { userId: viewer.id, p256dh: parsed.p256dh, auth: parsed.auth },
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  await prisma.pushSubscription.deleteMany({
    where: endpoint ? { userId: viewer.id, endpoint } : { userId: viewer.id },
  });
  return Response.json({ ok: true });
}
