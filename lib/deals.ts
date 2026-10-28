import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { readDealMeta, type DealMeta } from "./deal-phase";
import { Fail, asFail } from "./fail";
import { isAllowedMediaUrl } from "./format";
import { insertOrder, releaseReservedStock } from "./orders";
import { PhotoStoreError, storeUploadedImage } from "./r2";
import { conditionLabel } from "./rules";
import { notify, isBlocked } from "./social";
import { displayCaption } from "./tags";
import { buildFulfillment, readFulfillment } from "./shipping";

const OPEN_DEAL = ["PENDING_PAYMENT", "IN_ESCROW", "AWAITING_SHIP", "SHIPPED"] as const;

export type ShareCard = {
  href: string;
  title: string;
  caption: string;
  priceCents: number | null;
  cover: string | null;
};

function withDeal(existing: unknown, patch: Partial<DealMeta>, extra?: Record<string, unknown>): Prisma.InputJsonValue {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  const prev = readDealMeta(existing);
  const deal = {
    private: true,
    meetupAgreed: patch.meetupAgreed ?? prev.meetupAgreed ?? false,
    proofs: patch.proofs ?? prev.proofs,
  };
  return { ...base, ...(extra ?? {}), deal };
}

async function shareTargetFor(listingId: string, sellerId: string, postId: string | null, cover: string | null) {
  let path = `/listing/${listingId}`;
  let image = cover;
  const post = postId
    ? await prisma.post.findUnique({
        where: { id: postId },
        include: { photos: { orderBy: { position: "asc" }, take: 1 }, collectionItem: { select: { listingId: true } } },
      })
    : await prisma.post.findFirst({
        where: { authorId: sellerId, collectionItem: { listingId } },
        include: { photos: { orderBy: { position: "asc" }, take: 1 }, collectionItem: { select: { listingId: true } } },
      });
  if (post && post.authorId === sellerId && (!post.collectionItem?.listingId || post.collectionItem.listingId === listingId)) {
    path = `/post/${post.id}`;
    image = post.photos[0]?.url ?? image;
  }
  return { path, image };
}

export async function openHandover(
  userId: string,
  input: { listingId: string; postId?: string | null; intent: "deal" | "bargain"; ack: boolean },
) {
  if (!input.ack) return { ok: false as const, error: "terms" };
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!listing) return { ok: false as const, error: "unavailable" };
  if (listing.sellerId === userId) return { ok: false as const, error: "own" };
  if (await isBlocked(userId, listing.sellerId)) return { ok: false as const, error: "blocked" };

  const thread =
    (await prisma.messageThread.findFirst({
      where: { listingId: listing.id, buyerId: userId, sellerId: listing.sellerId },
    })) ??
    (await prisma.messageThread.create({
      data: { listingId: listing.id, buyerId: userId, sellerId: listing.sellerId },
    }));

  const share = await shareTargetFor(listing.id, listing.sellerId, input.postId ?? null, listing.photos[0]?.url ?? null);
  const sent = await prisma.message.findFirst({ where: { threadId: thread.id, body: share.path } });
  if (!sent) {
    const imageUrl = share.image && isAllowedMediaUrl(share.image) ? share.image : null;
    await prisma.message.create({ data: { threadId: thread.id, senderId: userId, body: share.path, imageUrl } });
    await prisma.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    await notify(listing.sellerId, "message", input.intent === "bargain" ? "想議價" : "想傾交收", listing.title, `/messages/${thread.id}`);
  }

  if (listing.status === "ACTIVE") {
    const amount = listing.price ?? listing.currentBid ?? listing.startPrice ?? 0;
    await prisma.$transaction(async (tx) => {
      const open = await tx.order.findFirst({
        where: {
          buyerId: userId,
          sellerId: listing.sellerId,
          status: { in: [...OPEN_DEAL] },
          items: { some: { listingId: listing.id } },
        },
      });
      if (open) return;
      await insertOrder(tx, {
        buyerId: userId,
        sellerId: listing.sellerId,
        source: "BUY_NOW",
        shipDays: listing.shippingDays,
        address: null,
        deal: true,
        lines: [
          {
            listingId: listing.id,
            title: listing.title,
            unitPrice: amount,
            quantity: 1,
            shippingFee: 0,
            imageUrl: listing.photos[0]?.url ?? null,
            conditionLabel: conditionLabel(listing),
            cardName: listing.cardName,
            personName: listing.personName,
          },
        ],
      });
    });
  }

  return { ok: true as const, threadId: thread.id, compose: input.intent === "bargain" };
}

export async function attachDealThread(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { listing: { include: { photos: { take: 1, orderBy: { position: "asc" } } } } }, take: 1 } },
  });
  const item = order?.items[0];
  if (!order || !item) return null;
  const thread =
    (await prisma.messageThread.findFirst({
      where: { listingId: item.listingId, buyerId: order.buyerId, sellerId: order.sellerId },
    })) ??
    (await prisma.messageThread.create({
      data: { listingId: item.listingId, buyerId: order.buyerId, sellerId: order.sellerId },
    }));
  const share = await shareTargetFor(item.listingId, order.sellerId, null, item.listing.photos[0]?.url ?? item.imageUrl);
  const sent = await prisma.message.findFirst({ where: { threadId: thread.id, body: share.path } });
  if (!sent) {
    const imageUrl = share.image && isAllowedMediaUrl(share.image) ? share.image : null;
    await prisma.message.create({ data: { threadId: thread.id, senderId: order.buyerId, body: share.path, imageUrl } });
    await prisma.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  }
  return thread.id;
}

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { listing: true } } },
  });
}

export async function arrangeMeetup(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  if (order.status !== "PENDING_PAYMENT" || readDealMeta(order.fulfillment).meetupAgreed) return { ok: false as const, error: "state" };
  const listing = order.items[0]?.listing;
  const snap = listing
    ? buildFulfillment(
        "MEET",
        [
          {
            id: listing.id,
            title: listing.title,
            meetupDistrict: listing.meetupDistrict,
            meetupWindow: listing.meetupWindow,
            meetupNotes: listing.meetupNotes,
          },
        ],
        null,
      )
    : null;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      shippingMethod: snap ? "MEET" : order.shippingMethod,
      fulfillment: withDeal(order.fulfillment, { meetupAgreed: true }, snap ?? undefined),
    },
  });
  return { ok: true as const };
}

export async function uploadProof(userId: string, orderId: string, imageUrl: string) {
  const raw = imageUrl.trim();
  if (!raw || !isAllowedMediaUrl(raw)) return { ok: false as const, error: "photo_url" };
  let stored = raw;
  try {
    stored = await storeUploadedImage(raw, "uploads/messages");
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return { ok: false as const, error: "photo_url" };
  }
  try {
    const sellerId = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.buyerId !== userId) throw new Fail("forbidden");
      if (!["PENDING_PAYMENT", "AWAITING_SHIP", "IN_ESCROW"].includes(order.status)) throw new Fail("state");
      const prev = readDealMeta(order.fulfillment);
      if (prev.proofs.length > 0) throw new Fail("state");
      const proofs = [...prev.proofs, { url: stored }];
      await tx.order.update({
        where: { id: orderId },
        data: { status: "IN_ESCROW", paymentOutcome: "NONE", fulfillment: withDeal(order.fulfillment, { proofs }) },
      });
      const listingId = order.items[0]?.listingId;
      if (listingId) {
        const thread = await tx.messageThread.findFirst({
          where: { listingId, buyerId: order.buyerId, sellerId: order.sellerId },
        });
        if (thread) {
          await tx.message.create({ data: { threadId: thread.id, senderId: userId, body: "付款證明", imageUrl: stored } });
          await tx.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
        }
      }
      return order.sellerId;
    });
    await notify(sellerId, "order", "買家上傳了付款證明", "請確認是咪收到錢，再按已收款。", `/orders/${orderId}`);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function confirmSellerPaid(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || order.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  if (order.status !== "IN_ESCROW" || readDealMeta(order.fulfillment).proofs.length < 1) return { ok: false as const, error: "state" };
  const changed = await prisma.order.updateMany({
    where: { id: orderId, status: "IN_ESCROW" },
    data: { status: "SHIPPED", shippedAt: new Date(), autoReleaseAt: null },
  });
  if (changed.count !== 1) return { ok: false as const, error: "state" };
  await notify(order.buyerId, "order", "賣家已確認收款", "請收貨後按已收貨。", `/orders/${orderId}`);
  return { ok: true as const };
}

export async function confirmReceived(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== userId) return { ok: false as const, error: "forbidden" };
  if (order.status !== "SHIPPED") return { ok: false as const, error: "state" };
  const changed = await prisma.order.updateMany({
    where: { id: orderId, status: "SHIPPED" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (changed.count !== 1) return { ok: false as const, error: "state" };
  await notify(order.sellerId, "order", "買家已確認收貨", "交收已完成，可以評價。", `/orders/${orderId}`);
  await notify(userId, "order", "交收已完成", "你可以評價對方。", `/orders/${orderId}`);
  return { ok: true as const };
}

export async function markDealSold(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || order.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  const phaseOk = order.status === "SHIPPED" || order.status === "COMPLETED" || (order.status === "IN_ESCROW" && readDealMeta(order.fulfillment).proofs.length > 0);
  if (!phaseOk) return { ok: false as const, error: "state" };
  const ids = order.items.map((item) => item.listingId);
  await prisma.listing.updateMany({
    where: { id: { in: ids }, sellerId: userId, status: { not: "SOLD" } },
    data: { status: "SOLD", quantityAvailable: 0, binLockOrderId: null },
  });
  await notify(order.buyerId, "order", "賣家標記已出售", order.items[0]?.title ?? "", `/orders/${orderId}`);
  return { ok: true as const };
}

export async function cancelDeal(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  if (order.status === "COMPLETED" || order.status === "CANCELLED" || order.status === "REFUNDED") return { ok: false as const, error: "state" };
  if (order.items.some((item) => item.listing.status === "SOLD")) return { ok: false as const, error: "state" };
  const changed = await prisma.order.updateMany({
    where: { id: orderId, status: { in: [...OPEN_DEAL, "DISPUTED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: order.buyerId === userId ? "buyer" : "seller" },
  });
  if (changed.count !== 1) return { ok: false as const, error: "state" };
  if (!readDealMeta(order.fulfillment).private) await releaseReservedStock(orderId);
  const other = order.buyerId === userId ? order.sellerId : order.buyerId;
  await notify(other, "order", "交收已取消", order.items[0]?.title ?? "", `/orders/${orderId}`);
  return { ok: true as const };
}

export function meetupNote(fulfillment: unknown, listing: { meetupDistrict: string | null; meetupWindow: string | null; meetupNotes: string | null } | null): string {
  const snap = readFulfillment(fulfillment);
  const fromSnap = snap?.meetups
    .map((row) => [row.district, row.window, row.notes].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("；");
  if (fromSnap) return fromSnap;
  if (!listing) return "";
  return [listing.meetupDistrict, listing.meetupWindow, listing.meetupNotes].filter(Boolean).join(" · ");
}

export async function loadShareCards(paths: string[]): Promise<Map<string, ShareCard>> {
  const postIds = paths.filter((path) => path.startsWith("/post/")).map((path) => path.slice("/post/".length));
  const listingIds = paths.filter((path) => path.startsWith("/listing/")).map((path) => path.slice("/listing/".length));
  const [posts, listings] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          include: {
            photos: { orderBy: { position: "asc" }, take: 1 },
            collectionItem: { include: { listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } }, photos: { orderBy: { position: "asc" }, take: 1 } } },
          },
        })
      : Promise.resolve([]),
    listingIds.length
      ? prisma.listing.findMany({ where: { id: { in: listingIds } }, include: { photos: { orderBy: { position: "asc" }, take: 1 } } })
      : Promise.resolve([]),
  ]);
  const cards = new Map<string, ShareCard>();
  for (const post of posts) {
    const listing = post.collectionItem?.listing ?? null;
    cards.set(`/post/${post.id}`, {
      href: `/post/${post.id}`,
      title: post.collectionItem?.title || listing?.title || "貼文",
      caption: displayCaption(post.body),
      priceCents: listing?.price ?? listing?.currentBid ?? listing?.startPrice ?? null,
      cover: post.photos[0]?.url ?? post.collectionItem?.photos[0]?.url ?? listing?.photos[0]?.url ?? null,
    });
  }
  for (const listing of listings) {
    cards.set(`/listing/${listing.id}`, {
      href: `/listing/${listing.id}`,
      title: listing.title,
      caption: "",
      priceCents: listing.price ?? listing.currentBid ?? listing.startPrice ?? null,
      cover: listing.photos[0]?.url ?? null,
    });
  }
  return cards;
}
