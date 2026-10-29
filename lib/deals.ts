import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cleanOfferNote, dealEventBody, dealPhase, latestOpenOfferMessage, readDealMeta, supersededOfferBody, type DealOffer } from "./deal-phase";
import { Fail, asFail } from "./fail";
import { isAllowedMediaUrl } from "./format";
import { insertOrder, releaseReservedStock } from "./orders";
import { PhotoStoreError, storeUploadedImage } from "./r2";
import { conditionLabel } from "./rules";
import { noticeHref } from "./notify";
import { notify, notifyKind, dealThreadHref, isBlocked } from "./social";
import { displayCaption } from "./tags";
import { buildFulfillment, readFulfillment } from "./shipping";

const OPEN_DEAL = ["PENDING_PAYMENT", "IN_ESCROW", "AWAITING_SHIP", "SHIPPED"] as const;

async function lockRows(tx: Prisma.TransactionClient, table: "Order" | "Listing", ids: string[]) {
  if (!ids.length) return;
  const rows = table === "Order"
    ? Prisma.sql`SELECT id FROM "Order" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`
    : Prisma.sql`SELECT id FROM "Listing" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
  await tx.$queryRaw(rows);
}

export type ShareCard = {
  href: string;
  title: string;
  caption: string;
  priceCents: number | null;
  cover: string | null;
};

function withDeal(
  existing: unknown,
  patch: { meetupAgreed?: boolean; confirmed?: boolean; proofs?: { url: string }[]; offer?: DealOffer | null },
  extra?: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  const prev = readDealMeta(existing);
  const offer = patch.offer === undefined ? prev.offer : patch.offer;
  const deal = {
    private: true,
    meetupAgreed: patch.meetupAgreed ?? prev.meetupAgreed ?? false,
    confirmed: patch.confirmed ?? prev.confirmed ?? false,
    proofs: patch.proofs ?? prev.proofs,
    ...(offer ? { offer: { by: offer.by, name: offer.name, amount: offer.amount, note: offer.note, status: offer.status } } : {}),
  };
  return { ...base, ...(extra ?? {}), deal };
}

async function markLiveOfferSuperseded(tx: Prisma.TransactionClient, threadId: string) {
  // ponytail: one scan for the newest live offer bubble. An offer id on the message is the upgrade if bubbles stop being appended in order.
  const messages = await tx.message.findMany({
    where: { threadId },
    select: { id: true, body: true },
    orderBy: { createdAt: "asc" },
  });
  const live = latestOpenOfferMessage(messages);
  if (!live) return;
  const next = supersededOfferBody(live.body);
  if (!next) return;
  await tx.message.update({ where: { id: live.id }, data: { body: next } });
}

async function postDealNote(
  tx: Prisma.TransactionClient,
  order: { buyerId: string; sellerId: string; items: { listingId: string }[] },
  senderId: string,
  body: string,
) {
  const listingId = order.items[0]?.listingId;
  if (!listingId) return null;
  const thread = await tx.messageThread.findFirst({
    where: { listingId, buyerId: order.buyerId, sellerId: order.sellerId },
  });
  if (!thread) return null;
  await tx.message.create({ data: { threadId: thread.id, senderId, body } });
  await tx.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  return thread.id;
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
  input: { listingId: string; postId?: string | null },
) {
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
    await notifyKind(listing.sellerId, "message", `/messages/${thread.id}`, listing.title);
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

  return { ok: true as const, threadId: thread.id };
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

async function orderChatHref(order: { id: string; buyerId: string; sellerId: string; items: { listingId: string }[] }) {
  const listingId = order.items[0]?.listingId;
  if (!listingId) return `/orders/${order.id}`;
  return dealThreadHref(listingId, order.buyerId, order.sellerId);
}

export async function arrangeMeetup(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  const meta = readDealMeta(order.fulfillment);
  if (order.status !== "PENDING_PAYMENT" || meta.meetupAgreed || meta.confirmed) return { ok: false as const, error: "state" };
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
  const other = order.buyerId === userId ? order.sellerId : order.buyerId;
  const listingId = order.items[0]?.listingId;
  const href = listingId ? await dealThreadHref(listingId, order.buyerId, order.sellerId) : "/me/footprint";
  await notifyKind(other, "handover", href, order.items[0]?.title ?? "");
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
    const order = await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.buyerId !== userId) throw new Fail("forbidden");
      if (!["PENDING_PAYMENT", "AWAITING_SHIP"].includes(order.status)) throw new Fail("state");
      const prev = readDealMeta(order.fulfillment);
      if (!prev.confirmed || prev.proofs.length > 0) throw new Fail("state");
      const listingIds = [...new Set(order.items.map((item) => item.listingId))].sort();
      await lockRows(tx, "Listing", listingIds);
      const listings = listingIds.length ? await tx.listing.findMany({ where: { id: { in: listingIds } } }) : [];
      if (listings.length !== listingIds.length || listings.some((listing) => listing.binLockOrderId !== order.id || listing.status === "SOLD")) {
        throw new Fail("reserved");
      }
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
          await tx.message.create({ data: { threadId: thread.id, senderId: userId, body: "已上載付款證明。", imageUrl: stored } });
          await tx.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
        }
      }
      return order;
    });
    const href = await orderChatHref(order);
    await notify(order.sellerId, "order", "買家已上載付款證明", "請確認已交收。", href);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

const OPEN_TALK = ["PENDING_PAYMENT", "AWAITING_SHIP"] as const;

function askCents(listing: { price: number | null; currentBid: number | null; startPrice: number | null }) {
  return listing.price ?? listing.currentBid ?? listing.startPrice ?? null;
}

async function softLock(tx: Prisma.TransactionClient, orderId: string, listingIds: string[]) {
  await lockRows(tx, "Listing", listingIds);
  const listings = await tx.listing.findMany({ where: { id: { in: listingIds } } });
  if (listings.length !== listingIds.length) throw new Fail("state");
  for (const listing of listings) {
    if (listing.status !== "ACTIVE") throw new Fail("state");
    if (listing.binLockOrderId === orderId) continue;
    if (listing.binLockOrderId) throw new Fail("reserved");
  }
  // ponytail: one reserve per listing reuses binLockOrderId. Feed and bids already skip a locked row; a dedicated column is the upgrade if reserved cards should stay browsable.
  const need = listings.filter((row) => row.binLockOrderId !== orderId).map((row) => row.id);
  if (need.length) {
    const locked = await tx.listing.updateMany({
      where: { id: { in: need }, status: "ACTIVE", binLockOrderId: null },
      data: { binLockOrderId: orderId },
    });
    if (locked.count !== need.length) throw new Fail("reserved");
  }
  return listings;
}

export async function proposeDealOffer(userId: string, threadId: string, listingId: string, amount: number, note: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false as const, error: "deal_price" };
  const cleaned = cleanOfferNote(note);
  if (!cleaned.ok) return { ok: false as const, error: "offer_note" };
  const peeked = await prisma.messageThread.findUnique({ where: { id: threadId } });
  if (!peeked || (peeked.buyerId !== userId && peeked.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  const otherId = peeked.buyerId === userId ? peeked.sellerId : peeked.buyerId;
  if (await isBlocked(userId, otherId)) return { ok: false as const, error: "blocked" };
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const thread = await tx.messageThread.findUnique({ where: { id: threadId } });
      if (!thread || (thread.buyerId !== userId && thread.sellerId !== userId)) throw new Fail("forbidden");
      const other = thread.buyerId === userId ? thread.sellerId : thread.buyerId;
      const useId = thread.listingId || listingId;
      if (!useId) throw new Fail("unavailable");
      const sellerId = thread.listingId ? thread.sellerId : other;
      const buyerId = thread.listingId ? thread.buyerId : userId;
      const orderWhere = {
        buyerId,
        sellerId,
        status: { in: [...OPEN_DEAL] },
        items: { some: { listingId: useId } },
      };
      let order = await tx.order.findFirst({ where: orderWhere, include: { items: true }, orderBy: { createdAt: "desc" } });
      if (order) {
        await lockRows(tx, "Order", [order.id]);
        await lockRows(tx, "Listing", [useId]);
        order = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
      } else {
        await lockRows(tx, "Listing", [useId]);
        order = await tx.order.findFirst({ where: orderWhere, include: { items: true }, orderBy: { createdAt: "desc" } });
        if (order) throw new Fail("state");
      }
      const listing = await tx.listing.findUnique({
        where: { id: useId },
        include: { photos: { orderBy: { position: "asc" }, take: 1 } },
      });
      if (!listing || listing.status !== "ACTIVE" || listing.quantityAvailable < 1) throw new Fail("unavailable");
      if (listing.binLockOrderId) throw new Fail("reserved");
      if (thread.listingId) {
        if (listing.id !== thread.listingId) throw new Fail("state");
      } else if (listing.sellerId !== other) {
        throw new Fail("forbidden");
      }
      if (!thread.listingId) {
        const bound = await tx.messageThread.updateMany({
          where: { id: thread.id, listingId: null },
          data: { listingId: listing.id, sellerId, buyerId },
        });
        if (bound.count !== 1) {
          const again = await tx.messageThread.findUnique({ where: { id: thread.id } });
          if (!again || again.listingId !== listing.id) throw new Fail("state");
        }
      }
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      const name = actor?.nickname?.trim() || "會員";
      if (!order) {
        const created = await insertOrder(tx, {
          buyerId,
          sellerId,
          source: "BUY_NOW",
          shipDays: listing.shippingDays,
          address: null,
          deal: true,
          lines: [
            {
              listingId: listing.id,
              title: listing.title,
              unitPrice: askCents(listing) ?? 0,
              quantity: 1,
              shippingFee: 0,
              imageUrl: listing.photos[0]?.url ?? null,
              conditionLabel: conditionLabel(listing),
              cardName: listing.cardName,
              personName: listing.personName,
            },
          ],
        });
        order = await tx.order.findUnique({ where: { id: created.id }, include: { items: true } });
      }
      if (!order) throw new Fail("state");
      const meta = readDealMeta(order.fulfillment);
      const phase = dealPhase(order);
      if (phase !== "CHATTING" && phase !== "ARRANGED") throw new Fail("state");
      if (meta.offer?.status === "ACCEPTED") throw new Fail("state");
      const superseded = meta.offer?.status === "PENDING";
      if (superseded) await markLiveOfferSuperseded(tx, thread.id);
      const offer: DealOffer = { by: userId, name, amount, note: cleaned.note, status: "PENDING" };
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...OPEN_TALK] } },
        data: { fulfillment: withDeal(order.fulfillment, { offer }) },
      });
      if (changed.count !== 1) throw new Fail("state");
      await tx.message.create({
        data: { threadId: thread.id, senderId: userId, body: dealEventBody({ kind: "offer", name, amount, note: cleaned.note }) },
      });
      await tx.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
      return { superseded, title: listing.title };
    });
    await notifyKind(otherId, outcome.superseded ? "offer-supersede" : "offer-new", `/messages/${threadId}`, outcome.title);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function withdrawDealOffer(userId: string, orderId: string) {
  return answerOffer(userId, orderId, "withdraw");
}

export async function declineDealOffer(userId: string, orderId: string) {
  return answerOffer(userId, orderId, "decline");
}

async function answerOffer(userId: string, orderId: string, mode: "withdraw" | "decline") {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw new Fail("forbidden");
      const offer = readDealMeta(order.fulfillment).offer;
      if (!offer || offer.status !== "PENDING") throw new Fail("state");
      if (mode === "withdraw" ? offer.by !== userId : offer.by === userId) throw new Fail("forbidden");
      if (!OPEN_TALK.includes(order.status as (typeof OPEN_TALK)[number])) throw new Fail("state");
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...OPEN_TALK] } },
        data: { fulfillment: withDeal(order.fulfillment, { offer: null }) },
      });
      if (changed.count !== 1) throw new Fail("state");
      const threadId = await postDealNote(tx, order, userId, dealEventBody({ kind: mode }));
      const other = order.buyerId === userId ? order.sellerId : order.buyerId;
      return { notifyId: mode === "decline" ? offer.by : other, threadId, title: order.items[0]?.title ?? "" };
    });
    const href = noticeHref(result.threadId);
    await notifyKind(result.notifyId, mode === "withdraw" ? "offer-withdraw" : "offer-decline", href, result.title);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

type ReserveOrder = {
  id: string;
  buyerId: string;
  sellerId: string;
  fulfillment: unknown;
  items: { id: string; quantity: number; listingId: string }[];
};

/** Accept the live offer and hold the listing. Same binLockOrderId + confirmed path as 確認交易. */
async function acceptAndReserve(tx: Prisma.TransactionClient, order: ReserveOrder, userId: string, offer: DealOffer) {
  const listingIds = [...new Set(order.items.map((item) => item.listingId))].sort();
  if (!listingIds.length) throw new Fail("state");
  await softLock(tx, order.id, listingIds);
  const accepted: DealOffer = { ...offer, status: "ACCEPTED" };
  // ponytail: a handover is one card. A multi-qty line keeps its quantity; the order total becomes the offer.
  if (order.items.length === 1 && order.items[0].quantity === 1) {
    await tx.orderItem.update({ where: { id: order.items[0].id }, data: { unitPrice: offer.amount } });
  }
  const changed = await tx.order.updateMany({
    where: { id: order.id, status: { in: [...OPEN_TALK] } },
    data: {
      subtotal: offer.amount,
      total: offer.amount,
      sellerProceeds: offer.amount,
      commissionAmount: 0,
      fulfillment: withDeal(order.fulfillment, { confirmed: true, offer: accepted }),
    },
  });
  if (changed.count !== 1) throw new Fail("state");
  await postDealNote(tx, order, userId, dealEventBody({ kind: "accept" }));
  return postDealNote(tx, order, userId, dealEventBody({ kind: "lock" }));
}

/** Counterparty accepts. Seller「接受要約」is the hold; a buyer accepting the seller's price holds too, so there is no second 確認交易. */
export async function acceptDealOffer(userId: string, orderId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw new Fail("forbidden");
      const meta = readDealMeta(order.fulfillment);
      if (meta.confirmed || meta.proofs.length > 0) throw new Fail("state");
      const offer = meta.offer;
      if (!offer || offer.status !== "PENDING") throw new Fail("state");
      if (offer.by === userId) throw new Fail("forbidden");
      const phase = dealPhase(order);
      if (phase !== "CHATTING" && phase !== "ARRANGED") throw new Fail("state");
      if (!OPEN_TALK.includes(order.status as (typeof OPEN_TALK)[number])) throw new Fail("state");
      const threadId = await acceptAndReserve(tx, order, userId, offer);
      return { notifyId: offer.by, threadId, title: order.items[0]?.title ?? "" };
    });
    const href = noticeHref(result.threadId);
    await notifyKind(result.notifyId, "offer-accept", href, result.title);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

/** Seller soft-lock. A pending buyer offer is accepted in the same step. */
export async function confirmDeal(userId: string, orderId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.sellerId !== userId) throw new Fail("forbidden");
      const meta = readDealMeta(order.fulfillment);
      if (meta.confirmed || meta.proofs.length > 0) throw new Fail("state");
      const phase = dealPhase(order);
      if (phase !== "CHATTING" && phase !== "ARRANGED") throw new Fail("state");
      if (!OPEN_TALK.includes(order.status as (typeof OPEN_TALK)[number])) throw new Fail("state");
      const offer = meta.offer;
      if (offer?.status === "PENDING") {
        if (offer.by === userId) throw new Fail("forbidden");
        const threadId = await acceptAndReserve(tx, order, userId, offer);
        return { notifyId: offer.by, threadId, accepted: true as const, title: order.items[0]?.title ?? "" };
      }
      const listingIds = [...new Set(order.items.map((item) => item.listingId))].sort();
      if (!listingIds.length) throw new Fail("state");
      await softLock(tx, order.id, listingIds);
      const accepted: DealOffer | null = offer?.status === "ACCEPTED" ? offer : null;
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...OPEN_TALK] } },
        data: { fulfillment: withDeal(order.fulfillment, accepted ? { confirmed: true, offer: accepted } : { confirmed: true }) },
      });
      if (changed.count !== 1) throw new Fail("state");
      const threadId = await postDealNote(tx, order, userId, dealEventBody({ kind: "lock" }));
      return { notifyId: order.buyerId, threadId, accepted: false as const, title: order.items[0]?.title ?? "" };
    });
    const href = noticeHref(result.threadId);
    if (result.accepted) await notifyKind(result.notifyId, "offer-accept", href, result.title);
    else await notify(result.notifyId, "order", "賣家已確認交易", "貨品已鎖定。", href);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function releaseReserve(userId: string, orderId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw new Fail("forbidden");
      const meta = readDealMeta(order.fulfillment);
      if (!meta.confirmed || meta.proofs.length > 0) throw new Fail("state");
      if (!OPEN_TALK.includes(order.status as (typeof OPEN_TALK)[number])) throw new Fail("state");
      const ids = [...new Set(order.items.map((item) => item.listingId))].sort();
      await lockRows(tx, "Listing", ids);
      const listings = ids.length ? await tx.listing.findMany({ where: { id: { in: ids } } }) : [];
      const cleared = await tx.listing.updateMany({
        where: { id: { in: ids }, binLockOrderId: order.id },
        data: { binLockOrderId: null },
      });
      if (cleared.count !== ids.length) throw new Fail("state");
      const line = order.items.length === 1 && order.items[0].quantity === 1 ? order.items[0] : null;
      const ask = line && listings[0] ? askCents(listings[0]) : null;
      if (line && ask != null) await tx.orderItem.update({ where: { id: line.id }, data: { unitPrice: ask } });
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      const name = actor?.nickname?.trim() || "會員";
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...OPEN_TALK] } },
        data: {
          ...(line && ask != null ? { subtotal: ask, total: ask, sellerProceeds: ask, commissionAmount: 0 } : {}),
          fulfillment: withDeal(order.fulfillment, { confirmed: false, offer: null }),
        },
      });
      if (changed.count !== 1) throw new Fail("state");
      const threadId = await postDealNote(tx, order, userId, dealEventBody({ kind: "release", name }));
      const other = order.buyerId === userId ? order.sellerId : order.buyerId;
      return { notifyId: other, threadId, name };
    });
    const href = noticeHref(result.threadId);
    await notify(result.notifyId, "order", `${result.name} 已解除鎖定`, "可以再提出要約。", href);
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
  await notify(order.buyerId, "order", "賣家已確認交收", "請確認收貨。", await orderChatHref(order));
  return { ok: true as const };
}

export async function confirmReceived(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || order.buyerId !== userId) return { ok: false as const, error: "forbidden" };
  if (order.status !== "SHIPPED") return { ok: false as const, error: "state" };
  const changed = await prisma.order.updateMany({
    where: { id: orderId, status: "SHIPPED" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (changed.count !== 1) return { ok: false as const, error: "state" };
  const href = await orderChatHref(order);
  await notify(order.sellerId, "order", "買家已確認收貨", "交易已完成，可以評分。", href);
  await notify(userId, "order", "交易已完成", "可以評分。", href);
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
  await notify(order.buyerId, "order", "賣家已標記出售", order.items[0]?.title ?? "", await orderChatHref(order));
  return { ok: true as const };
}

export async function cancelDeal(userId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  if (order.status === "COMPLETED" || order.status === "CANCELLED" || order.status === "REFUNDED") return { ok: false as const, error: "state" };
  if (order.items.some((item) => item.listing.status === "SOLD")) return { ok: false as const, error: "state" };
  try {
    await prisma.$transaction(async (tx) => {
      await lockRows(tx, "Order", [orderId]);
      const ids = [...new Set(order.items.map((item) => item.listingId))].sort();
      await lockRows(tx, "Listing", ids);
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: { in: [...OPEN_DEAL, "DISPUTED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: order.buyerId === userId ? "buyer" : "seller" },
      });
      if (changed.count !== 1) throw new Fail("state");
      await tx.listing.updateMany({
        where: { id: { in: ids }, binLockOrderId: orderId },
        data: { binLockOrderId: null },
      });
    });
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
  if (!readDealMeta(order.fulfillment).private) await releaseReservedStock(orderId);
  const other = order.buyerId === userId ? order.sellerId : order.buyerId;
  await notify(other, "order", "交收已取消", order.items[0]?.title ?? "", await orderChatHref(order));
  return { ok: true as const };
}

export function sellerPayment(user: { payoutMethod: string | null; payoutAccount: string | null; payoutHolder: string | null } | null): { method: string; account: string; holder: string } | null {
  const account = user?.payoutAccount?.trim();
  if (!account) return null;
  return { method: user?.payoutMethod?.trim() || "", account, holder: user?.payoutHolder?.trim() || "" };
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
