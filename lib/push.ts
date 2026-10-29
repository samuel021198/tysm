import { prisma } from "./db";

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : undefined;
}

async function sendPush(subs: PushRow[], json: string, publicKey: string, privateKey: string) {
  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@tysm.hk", publicKey, privateKey);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
      } catch (error) {
        const status = statusOf(error);
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

/** Email queue is opt-in. Web Push sends only when VAPID keys exist; otherwise the inbox row still stands. */
export async function deliverOutbound(
  user: { id: string; email: string | null; notifyEmail: boolean },
  payload: { title: string; body: string; href?: string },
) {
  const json = JSON.stringify({ title: payload.title, body: payload.body, href: payload.href ?? "/notifications" });
  if (user.notifyEmail && user.email) {
    await prisma.outboundStub.create({ data: { channel: "EMAIL", userId: user.id, payload: json } });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (!subs.length) return;
  try {
    await sendPush(subs, json, publicKey, privateKey);
  } catch {
    /* a bad VAPID key must not roll back the inbox row */
  }
}
