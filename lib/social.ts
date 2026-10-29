import { prisma } from "./db";
import { noticeCopy, noticeHref, type NoticeKind, type NoticeType } from "./notify";
import { deliverOutbound } from "./push";

export async function notify(userId: string, type: NoticeType, title: string, body: string, href?: string) {
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
  try {
    await deliverOutbound(user, { title, body, href });
  } catch {
    /* inbox row already saved */
  }
}

export async function notifyKind(userId: string, kind: NoticeKind, href: string, detail?: string) {
  const copy = noticeCopy(kind, detail);
  await notify(userId, copy.type, copy.title, copy.body, href);
}

export async function dealThreadHref(listingId: string, buyerId: string, sellerId: string) {
  const thread = await prisma.messageThread.findFirst({
    where: { listingId, buyerId, sellerId },
    select: { id: true },
  });
  return noticeHref(thread?.id);
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

export type FollowRailPerson = { id: string; nickname: string; avatarUrl: string | null };

/** Home discovery strip: people and shops you follow, newest follow first. Not stories.
 * ponytail: 24 rows in memory. Upgrade path: keyset on Follow.createdAt.
 */
export async function loadFollowRail(viewerId: string | null, hidden: string[]): Promise<FollowRailPerson[]> {
  if (!viewerId) return [];
  const rows = await prisma.follow.findMany({
    where: {
      followerId: viewerId,
      ...(hidden.length ? { sellerId: { notIn: hidden } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { seller: { select: { id: true, nickname: true, avatarUrl: true, storeName: true } } },
  });
  return rows.map((row) => ({
    id: row.seller.id,
    nickname: row.seller.storeName?.trim() || row.seller.nickname,
    avatarUrl: row.seller.avatarUrl,
  }));
}

export async function hiddenUserIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
  });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}
