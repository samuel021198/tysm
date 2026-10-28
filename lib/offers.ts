import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { Fail, asFail } from "./fail";
import { attachDealThread } from "./deals";
import { insertOrder } from "./orders";
import { notify } from "./social";
import { MAX_OFFER_ROUNDS, OFFER_TTL_MS, conditionLabel } from "./rules";

export async function makeOffer(userId: string, listingId: string, amount: number) {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing || listing.status !== "ACTIVE" || !listing.offersEnabled || listing.price == null) throw new Fail("unavailable");
      if (listing.sellerId === userId) throw new Fail("own");
      if (listing.binLockOrderId) throw new Fail("locked");
      if (listing.minOffer == null || amount < listing.minOffer || amount >= listing.price) throw new Fail("offer");
      const active = await tx.offer.findFirst({
        where: { listingId, buyerId: userId, status: { in: ["PENDING", "COUNTERED"] } },
      });
      if (active) throw new Fail("rounds");
      const offer = await tx.offer.create({
        data: {
          listingId,
          buyerId: userId,
          status: "PENDING",
          round: 1,
          amount,
          expiresAt: new Date(Date.now() + OFFER_TTL_MS),
        },
      });
      return { sellerId: listing.sellerId, title: listing.title, id: offer.id };
    });
    await notify(created.sellerId, "offer", "收到新議價", created.title, `/listing/${listingId}`);
    return { ok: true as const, id: created.id };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

async function acceptAmount(tx: Prisma.TransactionClient, offerId: string, amount: number) {
  const offer = await tx.offer.findUnique({ where: { id: offerId }, include: { listing: { include: { photos: { take: 1, orderBy: { position: "asc" } } } } } });
  if (!offer || !["PENDING", "COUNTERED"].includes(offer.status)) throw new Fail("state");
  if (offer.expiresAt <= new Date()) throw new Fail("expired");
  const listing = offer.listing;
  if (listing.status !== "ACTIVE" || listing.quantityAvailable < 1 || listing.binLockOrderId) throw new Fail("stock");
  const order = await insertOrder(tx, {
    buyerId: offer.buyerId,
    sellerId: listing.sellerId,
    source: "OFFER",
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
  await tx.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", orderId: order.id } });
  return order.id;
}

export async function respondOffer(userId: string, offerId: string, action: string, counterRaw: number | null) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId }, include: { listing: true } });
      if (!offer) throw new Fail("unavailable");
      if (offer.expiresAt <= new Date()) throw new Fail("expired");
      const seller = offer.listing.sellerId === userId;
      const buyer = offer.buyerId === userId;
      if (!seller && !buyer) throw new Fail("forbidden");

      if (seller && offer.status === "PENDING") {
        if (action === "decline") {
          await tx.offer.update({ where: { id: offer.id }, data: { status: "DECLINED" } });
          return { kind: "declined" as const, buyerId: offer.buyerId, listingId: offer.listingId, orderId: null };
        }
        if (action === "accept") {
          const orderId = await acceptAmount(tx, offer.id, offer.amount);
          return { kind: "accepted" as const, buyerId: offer.buyerId, listingId: offer.listingId, orderId };
        }
        if (action === "counter") {
          if (counterRaw == null || offer.listing.price == null || counterRaw <= offer.amount || counterRaw >= offer.listing.price) {
            throw new Fail("offer");
          }
          await tx.offer.update({
            where: { id: offer.id },
            data: { status: "COUNTERED", counterAmount: counterRaw, expiresAt: new Date(Date.now() + OFFER_TTL_MS) },
          });
          return { kind: "counter" as const, buyerId: offer.buyerId, listingId: offer.listingId, orderId: null };
        }
      }

      if (buyer && offer.status === "COUNTERED") {
        if (action === "decline") {
          await tx.offer.update({ where: { id: offer.id }, data: { status: "DECLINED" } });
          return { kind: "declined" as const, buyerId: offer.listing.sellerId, listingId: offer.listingId, orderId: null };
        }
        if (action === "accept") {
          if (offer.counterAmount == null) throw new Fail("state");
          const orderId = await acceptAmount(tx, offer.id, offer.counterAmount);
          return { kind: "accepted" as const, buyerId: offer.listing.sellerId, listingId: offer.listingId, orderId };
        }
        if (action === "counter") {
          if (!canRound(offer.round)) throw new Fail("rounds");
          if (counterRaw == null || offer.listing.price == null || offer.listing.minOffer == null) throw new Fail("offer");
          if (counterRaw < offer.listing.minOffer || counterRaw >= offer.listing.price) throw new Fail("offer");
          await tx.offer.update({
            where: { id: offer.id },
            data: {
              status: "PENDING",
              round: offer.round + 1,
              amount: counterRaw,
              counterAmount: null,
              expiresAt: new Date(Date.now() + OFFER_TTL_MS),
            },
          });
          return { kind: "counter" as const, buyerId: offer.listing.sellerId, listingId: offer.listingId, orderId: null };
        }
      }
      throw new Fail("state");
    });
    const threadId = result.orderId ? await attachDealThread(result.orderId) : null;
    const title = result.kind === "accepted" ? "議價已接受" : result.kind === "declined" ? "議價已被拒絕" : "議價有回覆";
    const href = threadId ? `/messages/${threadId}` : result.orderId ? `/orders/${result.orderId}` : `/listing/${result.listingId}`;
    await notify(result.buyerId, "offer", title, result.kind === "accepted" ? "去聊天傾交收。" : "打開貨品頁查看。", href);
    return { ok: true as const, orderId: result.orderId, threadId };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

function canRound(round: number) {
  return round < MAX_OFFER_ROUNDS;
}
