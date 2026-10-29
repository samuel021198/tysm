import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { Fail, asFail } from "./fail";
import { syncListingInventory } from "./inventory";
import { purgeExpiredStories } from "./story-feed";
import { notify } from "./social";
import { auctionOutcome } from "./auction";
import { dealEventBody } from "./deal-phase";
import {
  AUTO_RELEASE_MS,
  PAY_TTL_MS,
  conditionLabel,
  nextUnpaidStrike,
  percentInputToBps,
  quoteSeller,
  resolveAuction,
} from "./rules";
import {
  buildFulfillment,
  courierFor,
  hasStoreAddress,
  intersectOffered,
  mockTracking,
  needsBuyerAddress,
  parseShipMethod,
  shipDays,
  type FulfillmentSnap,
  type ShipMethod,
} from "./shipping";

type Tx = Prisma.TransactionClient;

export type AddressSnap = {
  recipient: string;
  phone: string;
  line1: string;
  district: string;
};

export type OrderLine = {
  listingId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  shippingFee: number;
  imageUrl: string | null;
  conditionLabel: string | null;
  cardName: string | null;
  personName: string | null;
};

async function bpsOf(tx: Tx): Promise<number> {
  const row = await tx.siteSetting.findUnique({ where: { key: "commission_percent" } });
  return row ? (percentInputToBps(row.value) ?? 800) : 800;
}

async function blocked(tx: Tx, a: string, b: string) {
  const row = await tx.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return Boolean(row);
}

export async function insertOrder(
  tx: Tx,
  args: {
    buyerId: string;
    sellerId: string;
    source: "BUY_NOW" | "AUCTION" | "OFFER";
    shipDays: number;
    address: AddressSnap | null;
    lines: OrderLine[];
    shippingMethod?: ShipMethod | null;
    fulfillment?: FulfillmentSnap | null;
    paymentBrand?: string | null;
    /** Private handover. No platform fee, no pay-by clock, no stock lock. */
    deal?: boolean;
  },
) {
  const bps = args.deal ? 0 : await bpsOf(tx);
  const subtotal = args.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // 順豐到付, 面交, and 店舖自取 are HK$0 on the platform.
  // The old rule that summed a prepaid fee per listing is retired.
  const shippingTotal = 0;
  const quote = quoteSeller(subtotal, shippingTotal, bps);
  const fulfillment = args.deal
    ? { ...(args.fulfillment ?? {}), deal: { private: true, meetupAgreed: false, confirmed: false, proofs: [] } }
    : args.fulfillment ?? undefined;
  return tx.order.create({
    data: {
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      status: "PENDING_PAYMENT",
      source: args.source,
      subtotal,
      shippingTotal,
      total: subtotal + shippingTotal,
      commissionBps: bps,
      commissionAmount: quote.commissionAmount,
      sellerProceeds: quote.proceeds,
      shipDays: args.shipDays,
      shippingMethod: args.shippingMethod ?? null,
      fulfillment,
      paymentBrand: args.paymentBrand ?? null,
      payBy: args.deal ? null : new Date(Date.now() + PAY_TTL_MS),
      addressSnapshot: args.address ?? undefined,
      items: { create: args.lines.map((line) => ({ ...line, shippingFee: 0 })) },
    },
  });
}

function liveAuction(listing: {
  saleType: string;
  auctionSettled: boolean;
  auctionEndsAt: Date | null;
  status: string;
}) {
  return (
    listing.status === "ACTIVE" &&
    listing.saleType !== "BUY_NOW" &&
    !listing.auctionSettled &&
    listing.auctionEndsAt != null &&
    listing.auctionEndsAt > new Date()
  );
}

async function reserve(tx: Tx, listingId: string, orderId: string, qty: number, lockAuction: boolean) {
  const updated = await tx.listing.updateMany({
    where: {
      id: listingId,
      status: "ACTIVE",
      binLockOrderId: null,
      quantityAvailable: { gte: qty },
    },
    data: {
      quantityAvailable: { decrement: qty },
      ...(lockAuction ? { binLockOrderId: orderId } : {}),
    },
  });
  if (updated.count !== 1) throw new Fail("stock");
}

export async function checkoutLines(
  userId: string,
  requests: { listingId: string; quantity: number }[],
  addressId: string | null,
  clearCart: boolean,
  choice?: { methods?: Record<string, string | null | undefined>; paymentBrand?: string | null },
) {
  try {
    const ids = await prisma.$transaction(async (tx) => {
      if (!requests.length) throw new Fail("empty");
      let snap: AddressSnap | null = null;
      if (addressId) {
        const address = await tx.address.findFirst({ where: { id: addressId, userId } });
        if (!address) throw new Fail("address");
        snap = {
          recipient: address.recipient,
          phone: address.phone,
          line1: address.line1,
          district: address.district,
        };
      }
      const loaded = [];
      for (const request of requests) {
        if (!Number.isInteger(request.quantity) || request.quantity < 1) throw new Fail("qty");
        const listing = await tx.listing.findUnique({
          where: { id: request.listingId },
          include: { photos: { orderBy: { position: "asc" }, take: 1 }, seller: true },
        });
        if (!listing || listing.status !== "ACTIVE" || listing.sellerId === userId) throw new Fail("unavailable");
        if (listing.saleType === "AUCTION" || listing.price == null) throw new Fail("unavailable");
        if (listing.quantityAvailable < request.quantity) throw new Fail("stock");
        if (await blocked(tx, userId, listing.sellerId)) throw new Fail("blocked");
        loaded.push({ listing, quantity: request.quantity });
      }
      const groups = new Map<string, typeof loaded>();
      for (const row of loaded) {
        const bucket = groups.get(row.listing.sellerId) ?? [];
        bucket.push(row);
        groups.set(row.listing.sellerId, bucket);
      }
      const orderIds: string[] = [];
      for (const [sellerId, rows] of groups) {
        const storeReady = hasStoreAddress(rows[0].listing.seller);
        const allowed = intersectOffered(rows.map((row) => ({ choice: row.listing, storeReady })));
        if (!allowed.length) throw new Fail("ship_mix");
        const method = parseShipMethod(choice?.methods?.[sellerId]);
        if (!method || !allowed.includes(method)) throw new Fail("ship_method");
        const fulfillment = buildFulfillment(
          method,
          rows.map((row) => ({
            id: row.listing.id,
            title: row.listing.title,
            meetupDistrict: row.listing.meetupDistrict,
            meetupWindow: row.listing.meetupWindow,
            meetupNotes: row.listing.meetupNotes,
          })),
          rows[0].listing.seller,
        );
        if (!fulfillment) throw new Fail(method === "PICKUP" ? "store_unavailable" : "shipping");
        if (needsBuyerAddress(method) && !snap) throw new Fail("address");
        const order = await insertOrder(tx, {
          buyerId: userId,
          sellerId,
          source: "BUY_NOW",
          shipDays: Math.max(...rows.map((row) => shipDays(row.listing, method))),
          shippingMethod: method,
          fulfillment,
          paymentBrand: choice?.paymentBrand ?? null,
          address: needsBuyerAddress(method) ? snap : null,
          lines: rows.map((row) => ({
            listingId: row.listing.id,
            title: row.listing.title,
            unitPrice: row.listing.price!,
            quantity: row.quantity,
            shippingFee: 0,
            imageUrl: row.listing.photos[0]?.url ?? null,
            conditionLabel: conditionLabel(row.listing),
            cardName: row.listing.cardName,
            personName: row.listing.personName,
          })),
        });
        for (const row of rows) {
          await reserve(tx, row.listing.id, order.id, row.quantity, liveAuction(row.listing));
        }
        orderIds.push(order.id);
      }
      if (clearCart) {
        await tx.cartItem.deleteMany({
          where: { userId, listingId: { in: requests.map((row) => row.listingId) } },
        });
      }
      return orderIds;
    });
    for (const id of ids) {
      const order = await prisma.order.findUnique({ where: { id } });
      if (order) {
        await notify(order.sellerId, "order", "新交收", "買家已開始傾交收。", `/orders/${order.id}`);
      }
    }
    return { ok: true as const, ids };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function releaseReservedStock(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    await restoreBuyNowStock(tx, orderId, order.source);
  });
}

async function restoreBuyNowStock(tx: Tx, orderId: string, source: string) {
  if (source === "AUCTION") return;
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const listing = await tx.listing.findUnique({ where: { id: item.listingId } });
    if (!listing) continue;
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        quantityAvailable: { increment: item.quantity },
        ...(listing.binLockOrderId === orderId ? { binLockOrderId: null } : {}),
        ...(listing.status === "SOLD" ? { status: "ACTIVE" } : {}),
      },
    });
  }
  await tx.offer.updateMany({ where: { orderId }, data: { status: "CANCELLED" } });
}

export async function cancelUnpaidOrder(orderId: string, reason: "timeout" | "buyer", actorId?: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "PENDING_PAYMENT") return null;
      if (reason === "buyer" && actorId !== order.buyerId) throw new Fail("forbidden");
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
      });
      if (updated.count !== 1) return null;
      await restoreBuyNowStock(tx, orderId, order.source);
      let banned = false;
      if (order.source === "AUCTION") {
        const buyer = await tx.user.findUnique({ where: { id: order.buyerId } });
        const strike = nextUnpaidStrike(buyer?.consecutiveUnpaid ?? 0);
        banned = strike.banned;
        await tx.user.update({
          where: { id: order.buyerId },
          data: {
            consecutiveUnpaid: strike.consecutive,
            ...(strike.banned ? { bidBanned: true } : {}),
          },
        });
      }
      return { buyerId: order.buyerId, sellerId: order.sellerId, banned, source: order.source };
    });
    if (!result) return { ok: false as const, error: "state" };
    await notify(result.sellerId, "order", "交收已取消", "未完成的交收已取消。", `/orders/${orderId}`);
    if (result.source === "AUCTION") {
      await notify(
        result.buyerId,
        "bid",
        result.banned ? "出價功能已停用" : "交收未完成",
        result.banned
          ? "連續 3 次拍賣得標未完成交收，你已被禁止出價，直至管理員解除。"
          : "拍賣得標未有完成交收。",
        `/orders/${orderId}`,
      );
    }
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function attachAddress(userId: string, orderId: string, addressId: string) {
  const [order, address] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.address.findFirst({ where: { id: addressId, userId } }),
  ]);
  if (!order || order.buyerId !== userId || order.status !== "PENDING_PAYMENT" || !address) {
    return { ok: false as const, error: "address" };
  }
  const snap: AddressSnap = {
    recipient: address.recipient,
    phone: address.phone,
    line1: address.line1,
    district: address.district,
  };
  await prisma.order.update({ where: { id: orderId }, data: { addressSnapshot: snap } });
  return { ok: true as const };
}

export async function chooseOrderShip(userId: string, orderId: string, methodRaw: string | null, addressId: string | null) {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { listing: true } }, seller: true },
      });
      if (!order || order.buyerId !== userId || order.status !== "PENDING_PAYMENT") throw new Fail("forbidden");
      if (order.shippingMethod) throw new Fail("state");
      const storeReady = hasStoreAddress(order.seller);
      const allowed = intersectOffered(order.items.map((item) => ({ choice: item.listing, storeReady })));
      if (!allowed.length) throw new Fail("ship_mix");
      const method = parseShipMethod(methodRaw);
      if (!method || !allowed.includes(method)) throw new Fail("ship_method");
      const fulfillment = buildFulfillment(
        method,
        order.items.map((item) => ({
          id: item.listing.id,
          title: item.title,
          meetupDistrict: item.listing.meetupDistrict,
          meetupWindow: item.listing.meetupWindow,
          meetupNotes: item.listing.meetupNotes,
        })),
        order.seller,
      );
      if (!fulfillment) throw new Fail(method === "PICKUP" ? "store_unavailable" : "shipping");
      let address = (order.addressSnapshot as AddressSnap | null) ?? null;
      if (needsBuyerAddress(method)) {
        if (addressId) {
          const row = await tx.address.findFirst({ where: { id: addressId, userId } });
          if (!row) throw new Fail("address");
          address = { recipient: row.recipient, phone: row.phone, line1: row.line1, district: row.district };
        }
        if (!address?.line1) throw new Fail("address");
      }
      const quote = quoteSeller(order.subtotal, 0, order.commissionBps);
      await tx.order.update({
        where: { id: orderId },
        data: {
          shippingMethod: method,
          shippingTotal: 0,
          total: order.subtotal,
          sellerProceeds: quote.proceeds,
          fulfillment,
          addressSnapshot: needsBuyerAddress(method) ? address ?? undefined : undefined,
          shipDays: Math.max(...order.items.map((item) => shipDays(item.listing, method))),
        },
      });
      await tx.orderItem.updateMany({ where: { orderId }, data: { shippingFee: 0 } });
    });
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function payOrder(userId: string, orderId: string, outcome: string) {
  if (outcome !== "success" && outcome !== "fail" && outcome !== "dispute") {
    return { ok: false as const, error: "state" };
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.buyerId !== userId) throw new Fail("forbidden");
      if (order.status !== "PENDING_PAYMENT") throw new Fail("state");
      if (outcome === "fail") {
        await tx.order.update({ where: { id: orderId }, data: { paymentOutcome: "FAIL" } });
        return { kind: "fail" as const, sellerId: order.sellerId };
      }
      const method = order.shippingMethod || "";
      if (!method) throw new Fail("shipping");
      const snap = order.addressSnapshot as AddressSnap | null;
      if (needsBuyerAddress(method) && !snap?.line1) throw new Fail("address");
      if (outcome === "dispute") {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "DISPUTED", paymentOutcome: "DISPUTE", paidAt: new Date() },
        });
        await tx.dispute.create({
          data: { orderId, openerId: userId, reason: "模擬付款爭議", status: "OPEN" },
        });
        return { kind: "dispute" as const, sellerId: order.sellerId };
      }
      const now = new Date();
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: {
          status: "IN_ESCROW",
          paymentOutcome: "SUCCESS",
          paidAt: now,
          shipBy: new Date(now.getTime() + order.shipDays * 24 * 60 * 60 * 1000),
        },
      });
      if (changed.count !== 1) throw new Fail("state");
      if (order.source === "AUCTION") {
        await tx.user.update({ where: { id: userId }, data: { consecutiveUnpaid: 0 } });
      }
      for (const item of order.items) {
        const listing = await tx.listing.findUnique({ where: { id: item.listingId } });
        if (!listing) continue;
        await tx.listing.update({
          where: { id: listing.id },
          data: {
            ...(listing.binLockOrderId === order.id
              ? { binLockOrderId: null, bidsVoided: true, auctionSettled: true }
              : {}),
            ...(listing.quantityAvailable <= 0 || order.source === "AUCTION" ? { status: "SOLD" } : {}),
          },
        });
      }
      return { kind: "success" as const, sellerId: order.sellerId };
    });
    if (result.kind === "success") {
      await notify(result.sellerId, "order", "交收有更新", "請喺聊天睇這張交收。", `/orders/${orderId}`);
    }
    if (result.kind === "dispute") {
      await notify(result.sellerId, "order", "付款標記為爭議", "這張模擬付款被標成爭議，等待管理員處理。", `/orders/${orderId}`);
    }
    return { ok: true as const, kind: result.kind };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function advanceShipment(
  sellerId: string,
  orderId: string,
  step: "pack" | "ship",
  extra?: { courier?: string | null; tracking?: string | null },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.sellerId !== sellerId) return { ok: false as const, error: "forbidden" };
  if (step === "pack") {
    if (order.status !== "IN_ESCROW") return { ok: false as const, error: "state" };
    await prisma.order.update({ where: { id: orderId }, data: { status: "AWAITING_SHIP" } });
  } else {
    if (order.status !== "AWAITING_SHIP") return { ok: false as const, error: "state" };
    const now = new Date();
    const method = order.shippingMethod || "SF";
    const courier = extra?.courier?.trim() || order.courierName || courierFor(method);
    const tracking = extra?.tracking?.trim() || order.trackingNumber || mockTracking(orderId, method);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        shippedAt: now,
        autoReleaseAt: new Date(now.getTime() + AUTO_RELEASE_MS),
        courierName: courier,
        trackingNumber: tracking,
      },
    });
  }
  await notify(
    order.buyerId,
    "order",
    step === "pack" ? "賣家準備寄出" : "賣家已寄出",
    step === "pack" ? "交收狀態有更新。" : "請喺聊天確認收貨。",
    `/orders/${orderId}`,
  );
  return { ok: true as const };
}

export async function completeOrder(orderId: string) {
  const now = new Date();
  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "SHIPPED" },
    data: { status: "COMPLETED", completedAt: now, escrowReleasedAt: now },
  });
  return updated.count === 1;
}

export async function confirmReceipt(buyerId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== buyerId) return { ok: false as const, error: "forbidden" };
  const did = await completeOrder(orderId);
  if (!did) return { ok: false as const, error: "state" };
  await notify(order.sellerId, "order", "買家已確認收貨", "交收已完成，可以評價。", `/orders/${orderId}`);
  await notify(buyerId, "order", "交收已完成", "你可以在 30 日內評價。", `/orders/${orderId}`);
  return { ok: true as const };
}

export async function openDispute(buyerId: string, orderId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 4 || trimmed.length > 1000) return { ok: false as const, error: "dispute" };
  try {
    const sellerId = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.buyerId !== buyerId) throw new Fail("forbidden");
      if (!["IN_ESCROW", "AWAITING_SHIP", "SHIPPED"].includes(order.status)) throw new Fail("dispute");
      const existing = await tx.dispute.findUnique({ where: { orderId } });
      if (existing) throw new Fail("dispute");
      await tx.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } });
      await tx.dispute.create({ data: { orderId, openerId: buyerId, reason: trimmed, status: "OPEN" } });
      return order.sellerId;
    });
    await notify(sellerId, "order", "買家開啟爭議", trimmed.slice(0, 80), `/orders/${orderId}`);
    return { ok: true as const };
  } catch (error) {
    const code = asFail(error);
    if (code) return { ok: false as const, error: code };
    throw error;
  }
}

export async function appealDispute(userId: string, orderId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 4 || trimmed.length > 1000) return { ok: false as const, error: "dispute" };
  const dispute = await prisma.dispute.findUnique({ where: { orderId }, include: { order: true } });
  if (!dispute) return { ok: false as const, error: "dispute" };
  const sellerLost = dispute.status === "BUYER_WINS" && dispute.order.sellerId === userId;
  const buyerLost = dispute.status === "SELLER_WINS" && dispute.order.buyerId === userId;
  if (!sellerLost && !buyerLost) return { ok: false as const, error: "dispute" };
  await prisma.$transaction([
    prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: "APPEALED", appealReason: trimmed, appealById: userId, returnShippingDue: false },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: "DISPUTED", completedAt: null, escrowReleasedAt: null },
    }),
  ]);
  return { ok: true as const };
}

export async function decideDispute(disputeId: string, winner: "buyer" | "seller", note: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute) return { ok: false as const, error: "dispute" };
  if (dispute.status !== "OPEN" && dispute.status !== "APPEALED") return { ok: false as const, error: "state" };
  const buyerWins = winner === "buyer";
  const final = dispute.status === "APPEALED";
  const status = final ? (buyerWins ? "FINAL_BUYER" : "FINAL_SELLER") : buyerWins ? "BUYER_WINS" : "SELLER_WINS";
  const proceeds = dispute.order.subtotal - dispute.order.commissionAmount + dispute.order.shippingTotal;
  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        decisionNote: note.trim().slice(0, 1000) || null,
        returnShippingDue: buyerWins,
      },
    });
    if (buyerWins) {
      await tx.order.update({
        where: { id: dispute.orderId },
        data: { status: "REFUNDED", sellerProceeds: 0, completedAt: null, escrowReleasedAt: null },
      });
      if (!dispute.order.shippedAt) await restoreBuyNowStock(tx, dispute.orderId, dispute.order.source);
    } else {
      const now = new Date();
      await tx.order.update({
        where: { id: dispute.orderId },
        data: {
          status: "COMPLETED",
          sellerProceeds: proceeds,
          completedAt: now,
          escrowReleasedAt: now,
        },
      });
      const items = await tx.orderItem.findMany({ where: { orderId: dispute.orderId } });
      for (const item of items) {
        const listing = await tx.listing.findUnique({ where: { id: item.listingId } });
        if (!listing) continue;
        await tx.listing.update({
          where: { id: listing.id },
          data: {
            ...(listing.binLockOrderId === dispute.orderId
              ? { binLockOrderId: null, bidsVoided: true, auctionSettled: true }
              : {}),
            ...(listing.quantityAvailable <= 0 ? { status: "SOLD" } : {}),
          },
        });
      }
    }
  });
  const href = `/orders/${dispute.orderId}`;
  const summary = buyerWins ? "爭議紀錄已更新。" : "爭議紀錄已更新。";
  await notify(dispute.order.buyerId, "order", "爭議有裁定", summary, href);
  await notify(dispute.order.sellerId, "order", "爭議有裁定", summary, href);
  return { ok: true as const };
}

export async function settleAuction(listingId: string) {
  try {
  const created = await prisma.$transaction(async (tx) => {
    const locked = await tx.listing.updateMany({
      where: { id: listingId, status: "ACTIVE", auctionSettled: false, binLockOrderId: null },
      data: { auctionSettled: true },
    });
    if (locked.count !== 1) return null;
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing?.startPrice || !listing.auctionEndsAt || listing.auctionEndsAt > new Date()) {
      throw new Fail("state");
    }
    const proxies = await tx.proxyBid.findMany({ where: { listingId } });
    let high = listing.currentBid;
    let leader = listing.leaderId;
    if (proxies.length && !listing.bidsVoided) {
      const resolved = resolveAuction(listing.startPrice, proxies);
      high = resolved.price;
      leader = resolved.leaderId;
    }
    const outcome = auctionOutcome({ high, leaderId: leader, reserve: listing.reservePrice, voided: listing.bidsVoided });
    if (outcome === "passed" || high == null || !leader) {
      await tx.listing.update({
        where: { id: listingId },
        data: { status: "ENDED", auctionPassed: true, auctionSettled: true },
      });
      return { passed: true as const, sellerId: listing.sellerId, title: listing.title };
    }
    const address =
      (await tx.address.findFirst({ where: { userId: leader, isDefault: true } })) ??
      (await tx.address.findFirst({ where: { userId: leader } }));
    const photo = await tx.listingPhoto.findFirst({ where: { listingId }, orderBy: { position: "asc" } });
    const order = await insertOrder(tx, {
      buyerId: leader,
      sellerId: listing.sellerId,
      source: "AUCTION",
      shipDays: listing.shippingDays,
      address: address
        ? {
            recipient: address.recipient,
            phone: address.phone,
            line1: address.line1,
            district: address.district,
          }
        : null,
      lines: [
        {
          listingId,
          title: listing.title,
          unitPrice: high,
          quantity: 1,
          shippingFee: 0,
          imageUrl: photo?.url ?? null,
          conditionLabel: conditionLabel(listing),
          cardName: listing.cardName,
          personName: listing.personName,
        },
      ],
      deal: true,
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillment: { deal: { private: true, meetupAgreed: false, confirmed: true, proofs: [] } },
      },
    });
    await tx.listing.update({
      where: { id: listingId },
      data: {
        status: "ACTIVE",
        auctionSettled: true,
        auctionPassed: false,
        binLockOrderId: order.id,
        currentBid: high,
        leaderId: leader,
      },
    });
    return { passed: false as const, orderId: order.id, buyerId: leader, sellerId: listing.sellerId, title: listing.title };
  });
  if (!created) return;
  if (created.passed) {
    await notify(created.sellerId, "order", "流標", created.title, `/listing/${listingId}`);
    return;
  }
  const { attachDealThread } = await import("./deals");
  const threadId = await attachDealThread(created.orderId);
  if (threadId) {
    await prisma.message.create({
      data: { threadId, senderId: created.sellerId, body: dealEventBody({ kind: "lock" }) },
    });
  }
  const href = threadId ? `/messages/${threadId}` : `/orders/${created.orderId}`;
  await notify(created.buyerId, "order", "已保留", "拍賣結束，貨品已保留。請喺聊天傾交收。", href);
  await notify(created.sellerId, "order", "已保留", "拍賣已結束，得標貨品已保留。", href);
  } catch (error) {
    if (asFail(error)) return;
    throw error;
  }
}

export async function sweep() {
  const now = new Date();
  await purgeExpiredStories(now);
  const scheduled = await prisma.listing.findMany({
    where: { status: "SCHEDULED", publishAt: { lte: now } },
    select: { id: true },
  });
  await prisma.listing.updateMany({
    where: { status: "SCHEDULED", publishAt: { lte: now } },
    data: { status: "ACTIVE", publishedAt: now },
  });
  for (const row of scheduled) await syncListingInventory(row.id);
  await prisma.offer.updateMany({
    where: { status: { in: ["PENDING", "COUNTERED"] }, expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  const unpaid = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", payBy: { lt: now } },
    select: { id: true },
  });
  for (const order of unpaid) await cancelUnpaidOrder(order.id, "timeout");
  const auctions = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      auctionSettled: false,
      saleType: { in: ["AUCTION", "BOTH"] },
      auctionEndsAt: { lte: now },
      binLockOrderId: null,
    },
    select: { id: true },
  });
  for (const listing of auctions) await settleAuction(listing.id);
}
