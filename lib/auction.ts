import { bidIncrementCents } from "./rules";

/** Trader auction lock. Amounts are cents. eBay-lite ladder, clamped to 5–20% of current. */

export const AUCTION_DAY_MIN = 1;
export const AUCTION_DAY_MAX = 14;

/** Chip list for the sell form. Any integer 1–14 is valid. */
export const AUCTION_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type AuctionDays = number;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 新上架 is listings published inside this window. 全部 is every live listing. */
export const NEW_LISTING_MS = 7 * DAY_MS;

export function isAuctionDays(value: number | null | undefined): value is number {
  return Number.isInteger(value) && value! >= AUCTION_DAY_MIN && value! <= AUCTION_DAY_MAX;
}

/** Raise over the current high: eBay ladder, never under 5% or over 20% of current. */
export function publicIncrementCents(currentCents: number): number {
  return bidIncrementCents(currentCents);
}

/** First bid may be the start price. Later bids add one public increment. */
export function publicMinimumBid(startPrice: number, currentBid: number | null, hasBids: boolean): number {
  if (!hasBids || currentBid == null) return startPrice;
  return currentBid + publicIncrementCents(currentBid);
}

/** Won listings become 已保留. Anything else is 流標. */
export function auctionOutcome(args: {
  high: number | null;
  leaderId: string | null;
  reserve: number | null;
  voided: boolean;
}): "won" | "passed" {
  if (args.voided || !args.leaderId || args.high == null) return "passed";
  if (args.reserve != null && args.high < args.reserve) return "passed";
  return "won";
}

/**
 * End clock for a new or edited auction.
 * ponytail: length is N×24h from publish (or from now when the seller changes the length), not an HKT midnight. Upgrade: end at a fixed HKT hour on day N.
 */
export function auctionSchedule(args: {
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  auctionDays: number | null;
  fallbackEnd: Date | null;
  publishAt: Date | null;
  now: Date;
  existing: { auctionDays: number | null; auctionEndsAt: Date | null } | null;
}): { auctionDays: number | null; auctionEndsAt: Date | null } {
  if (args.saleType === "BUY_NOW") return { auctionDays: null, auctionEndsAt: null };
  if (isAuctionDays(args.auctionDays)) {
    const kept = args.existing?.auctionDays === args.auctionDays && args.existing.auctionEndsAt && args.existing.auctionEndsAt > args.now;
    if (kept && args.existing?.auctionEndsAt) return { auctionDays: args.auctionDays, auctionEndsAt: args.existing.auctionEndsAt };
    const start = args.publishAt && args.publishAt > args.now ? args.publishAt : args.now;
    return { auctionDays: args.auctionDays, auctionEndsAt: new Date(start.getTime() + args.auctionDays * DAY_MS) };
  }
  return { auctionDays: args.existing?.auctionDays ?? null, auctionEndsAt: args.fallbackEnd };
}

export type ShopTab = "all" | "new" | "auction" | "shops";

export function shopTab(value: string | undefined): ShopTab {
  if (value === "new" || value === "auction" || value === "shops") return value;
  return "all";
}
