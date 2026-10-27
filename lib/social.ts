import { prisma } from "./db";

export async function notify(
  userId: string,
  type: "bid" | "offer" | "order" | "message" | "review",
  title: string,
  body: string,
  href?: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const allowed =
    type === "bid"
      ? user.notifyBids
      : type === "offer"
        ? user.notifyOffers
        : type === "message"
          ? user.notifyMessages
          : user.notifyOrders;
  if (!allowed) return;
  await prisma.notification.create({ data: { userId, type, title, body, href } });
  const payload = JSON.stringify({ title, body, href });
  await prisma.outboundStub.createMany({
    data: [
      { channel: "EMAIL", userId, payload },
      { channel: "PUSH", userId, payload },
    ],
  });
}

export async function isBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return Boolean(row);
}

/** Posts and listings this viewer has hidden. Empty for guests. */
export async function feedHideIds(userId: string | null): Promise<{ postIds: string[]; listingIds: string[] }> {
  if (!userId) return { postIds: [], listingIds: [] };
  const rows = await prisma.feedHide.findMany({
    where: { userId },
    select: { targetType: true, targetId: true },
  });
  const postIds: string[] = [];
  const listingIds: string[] = [];
  for (const row of rows) {
    if (row.targetType === "POST") postIds.push(row.targetId);
    else if (row.targetType === "LISTING") listingIds.push(row.targetId);
  }
  return { postIds, listingIds };
}

export async function followedSellerIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.follow.findMany({ where: { followerId: userId }, select: { sellerId: true } });
  return new Set(rows.map((row) => row.sellerId));
}

export async function hiddenUserIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
  });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}
