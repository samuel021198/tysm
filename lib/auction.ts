import { bidIncrementCents } from "./rules";

/** Trader auction lock. Amounts are cents. Raise is max(HK$10, 5%). */

export const AUCTION_DAY_MIN = 1;
export const AUCTION_DAY_MAX = 7;

/** Chip list for the sell form. Only these lengths. */
export const AUCTION_DAYS = [1, 3, 5, 7] as const;

export type AuctionDays = (typeof AUCTION_DAYS)[number];

const AUCTION_DAY_SET = new Set<number>(AUCTION_DAYS);

const DAY_MS = 24 * 60 * 60 * 1000;

/** 新上架 is listings published inside this window. 全部 is every live listing. */
export const NEW_LISTING_MS = 7 * DAY_MS;

export function isAuctionDays(value: number | null | undefined): value is AuctionDays {
  return typeof value === "number" && AUCTION_DAY_SET.has(value);
}

/** Raise over the current high: HK$10 or 5%, whichever is higher. */
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
