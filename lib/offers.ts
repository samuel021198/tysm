import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { Fail, asFail } from "./fail";
import { attachDealThread } from "./deals";
import { insertOrder } from "./orders";
import { noticeHref } from "./notify";
import { dealThreadHref, notifyKind } from "./social";
import { MAX_OFFER_ROUNDS, OFFER_TTL_MS, conditionLabel } from "./rules";

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

      const buyerId = offer.buyerId;
      const sellerId = offer.listing.sellerId;
      const listingId = offer.listingId;
      const title = offer.listing.title;

      if (seller && offer.status === "PENDING") {
        if (action === "decline") {
          await tx.offer.update({ where: { id: offer.id }, data: { status: "DECLINED" } });
          return { kind: "declined" as const, notifyId: buyerId, buyerId, sellerId, listingId, title, orderId: null as string | null };
        }
        if (action === "accept") {
          const orderId = await acceptAmount(tx, offer.id, offer.amount);
          return { kind: "accepted" as const, notifyId: buyerId, buyerId, sellerId, listingId, title, orderId };
        }
        if (action === "counter") {
          if (counterRaw == null || offer.listing.price == null || counterRaw <= offer.amount || counterRaw >= offer.listing.price) {
            throw new Fail("offer");
          }
          await tx.offer.update({
            where: { id: offer.id },
            data: { status: "COUNTERED", counterAmount: counterRaw, expiresAt: new Date(Date.now() + OFFER_TTL_MS) },
          });
          return { kind: "counter" as const, notifyId: buyerId, buyerId, sellerId, listingId, title, orderId: null as string | null };
        }
      }

      if (buyer && offer.status === "COUNTERED") {
        if (action === "decline") {
          await tx.offer.update({ where: { id: offer.id }, data: { status: "DECLINED" } });
          return { kind: "declined" as const, notifyId: sellerId, buyerId, sellerId, listingId, title, orderId: null as string | null };
        }
        if (action === "accept") {
          if (offer.counterAmount == null) throw new Fail("state");
          const orderId = await acceptAmount(tx, offer.id, offer.counterAmount);
          return { kind: "accepted" as const, notifyId: sellerId, buyerId, sellerId, listingId, title, orderId };
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
          return { kind: "counter" as const, notifyId: sellerId, buyerId, sellerId, listingId, title, orderId: null as string | null };
        }
      }
      throw new Fail("state");
    });
    const threadId = result.orderId ? await attachDealThread(result.orderId) : null;
    const href = threadId ? noticeHref(threadId) : await dealThreadHref(result.listingId, result.buyerId, result.sellerId);
    const kind = result.kind === "accepted" ? "offer-accept" : result.kind === "declined" ? "offer-decline" : "offer-supersede";
    await notifyKind(result.notifyId, kind, href, result.title);
    if (result.kind === "accepted") {
      await notifyKind(result.buyerId, "handover", href, result.title);
      await notifyKind(result.sellerId, "handover", href, result.title);
    }
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
