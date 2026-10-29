import { prisma } from "./db";
import { dealPhase, type DealPhase } from "./deal-phase";
import type { Locale } from "./i18n";
import { hiddenUserIds } from "./social";

/** Open-deal groups on 我的足跡. Done deals leave this strip. */
export type OpenGroup = "offering" | "locked" | "handover" | "ended";

export type FootprintKind = "offering" | "locked" | "handover" | "cancelled" | "declined" | "expired" | "withdrawn" | "done";

/** 交易中: 要約中, 已鎖貨, 待交收. Cancelled deals fold into 已結束. */
export function openDealGroup(phase: DealPhase): OpenGroup | null {
  if (phase === "DONE") return null;
  if (phase === "CANCELLED") return "ended";
  if (phase === "CHATTING") return "offering";
  if (phase === "CONFIRMED") return "locked";
  if (phase === "ARRANGED" || phase === "PROOF" || phase === "SELLER_PAID") return "handover";
  return null;
}

/** Seller inbox and the buyer's open offer. Accepted offers are the order, not a second row. */
export function offerGroup(status: string): OpenGroup | null {
  if (status === "PENDING" || status === "COUNTERED") return "offering";
  if (status === "DECLINED" || status === "EXPIRED" || status === "CANCELLED") return "ended";
  return null;
}

export function offerKind(status: string): FootprintKind | null {
  if (status === "PENDING" || status === "COUNTERED") return "offering";
  if (status === "DECLINED") return "declined";
  if (status === "EXPIRED") return "expired";
  if (status === "CANCELLED") return "withdrawn";
  return null;
}

export function dealKind(phase: DealPhase): FootprintKind | null {
  const group = openDealGroup(phase);
  if (group === "ended") return "cancelled";
  if (group) return group;
  if (phase === "DONE") return "done";
  return null;
}

export function footprintStatusLabel(locale: Locale, kind: FootprintKind): string {
  const zh: Record<FootprintKind, string> = {
    offering: "要約中",
    locked: "已鎖貨",
    handover: "待交收",
    cancelled: "已取消",
    declined: "已拒絕",
    expired: "已過期",
    withdrawn: "已撤回",
    done: "已完成",
  };
  const en: Record<FootprintKind, string> = {
    offering: "Offer",
    locked: "Locked",
    handover: "To hand over",
    cancelled: "Cancelled",
    declined: "Declined",
    expired: "Expired",
    withdrawn: "Withdrawn",
    done: "Completed",
  };
  return (locale === "en" ? en : zh)[kind];
}

export type FootprintRow = {
  id: string;
  href: string;
  title: string;
  priceCents: number;
  photo: string | null;
  at: Date;
  kind: FootprintKind;
};

export type FootprintBoard = {
  offering: FootprintRow[];
  locked: FootprintRow[];
  handover: FootprintRow[];
  ended: FootprintRow[];
  sold: FootprintRow[];
  bought: FootprintRow[];
};

const OPEN_ORDER = ["PENDING_PAYMENT", "IN_ESCROW", "AWAITING_SHIP", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"] as const;

function threadKey(listingId: string, buyerId: string, sellerId: string) {
  return `${listingId}\0${buyerId}\0${sellerId}`;
}

/**
 * Owner footprint. Open offers without an order are the seller inbox inside 要約中.
 * ponytail: last 80 orders, 40 offers, 200 threads. Upgrade path: keyset per tab.
 */
export async function loadFootprint(userId: string): Promise<FootprintBoard> {
  const [orders, offers, threads, hiddenIds] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: [...OPEN_ORDER] } },
      include: { items: true },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    prisma.offer.findMany({
      where: {
        OR: [{ buyerId: userId }, { listing: { sellerId: userId } }],
        status: { in: ["PENDING", "COUNTERED", "DECLINED", "EXPIRED", "CANCELLED"] },
      },
      include: { listing: { select: { id: true, title: true, sellerId: true, photos: { take: 1, orderBy: { position: "asc" } } } } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.messageThread.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { id: true, listingId: true, buyerId: true, sellerId: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    hiddenUserIds(userId),
  ]);
  const hidden = new Set(hiddenIds);

  const threadsByDeal = new Map<string, string>();
  for (const thread of threads) {
    if (!thread.listingId) continue;
    const key = threadKey(thread.listingId, thread.buyerId, thread.sellerId);
    if (!threadsByDeal.has(key)) threadsByDeal.set(key, thread.id);
  }

  const board: FootprintBoard = { offering: [], locked: [], handover: [], ended: [], sold: [], bought: [] };
  const openDeals = new Set<string>();

  for (const order of orders) {
    const phase = dealPhase(order);
    const kind = dealKind(phase);
    if (!kind) continue;
    const item = order.items[0];
    const listingId = item?.listingId;
    if (listingId && phase !== "DONE" && phase !== "CANCELLED") openDeals.add(`${order.buyerId}:${listingId}`);
    const otherId = order.buyerId === userId ? order.sellerId : order.buyerId;
    if (hidden.has(otherId) && kind === "offering") continue;
    const href = listingId && !hidden.has(otherId)
      ? threadsByDeal.get(threadKey(listingId, order.buyerId, order.sellerId))
      : undefined;
    const row: FootprintRow = {
      id: `order:${order.id}`,
      href: href ? `/messages/${href}` : `/orders/${order.id}/chat`,
      title: order.items.map((line) => line.title).filter(Boolean).join("、") || "—",
      priceCents: order.total,
      photo: item?.imageUrl ?? null,
      at: order.updatedAt,
      kind,
    };
    if (kind === "done") {
      if (order.sellerId === userId) board.sold.push(row);
      if (order.buyerId === userId) board.bought.push(row);
      continue;
    }
    if (kind === "offering") board.offering.push(row);
    else if (kind === "locked") board.locked.push(row);
    else if (kind === "handover") board.handover.push(row);
    else board.ended.push(row);
  }

  for (const offer of offers) {
    const kind = offerKind(offer.status);
    if (!kind || offer.orderId) continue;
    const otherId = offer.buyerId === userId ? offer.listing.sellerId : offer.buyerId;
    if (hidden.has(otherId)) continue;
    if (openDeals.has(`${offer.buyerId}:${offer.listingId}`)) continue;
    const href = threadsByDeal.get(threadKey(offer.listingId, offer.buyerId, offer.listing.sellerId));
    const row: FootprintRow = {
      id: `offer:${offer.id}`,
      href: href ? `/messages/${href}` : `/listing/${offer.listingId}`,
      title: offer.listing.title,
      priceCents: offer.status === "COUNTERED" && offer.counterAmount != null ? offer.counterAmount : offer.amount,
      photo: offer.listing.photos[0]?.url ?? null,
      at: offer.updatedAt,
      kind,
    };
    if (kind === "offering") board.offering.push(row);
    else board.ended.push(row);
  }

  return board;
}
