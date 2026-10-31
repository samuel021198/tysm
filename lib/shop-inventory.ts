import type { MallSort } from "./auction";
import type { Locale } from "./i18n";
import { textHits } from "./search";

/** Cards on 熱門／已關注／拍賣. Nearby shops use the same cap. */
export const MALL_FEED_CAP = 16;

/** Chips beside 精選. Topps covers every Topps leaf. Yu-Gi-Oh is one leaf; other Wave-1 brands stay under 更多. */
export const MALL_CHIPS = [
  { id: "pokemon", zh: "Pokémon", en: "Pokémon" },
  { id: "topps", zh: "Topps", en: "Topps" },
  { id: "one-piece", zh: "One Piece", en: "One Piece" },
  { id: "riftbound", zh: "Riftbound", en: "Riftbound" },
  { id: "yugioh", zh: "Yu-Gi-Oh", en: "Yu-Gi-Oh" },
] as const;

const MALL_CHIP_SLUGS: Record<(typeof MALL_CHIPS)[number]["id"], readonly string[]> = {
  pokemon: ["pokemon"],
  topps: ["topps-soccer", "topps-basketball", "topps-baseball"],
  "one-piece": ["one-piece"],
  riftbound: ["riftbound"],
  yugioh: ["yugioh"],
};

export function mallPinnedSlug(slug: string): boolean {
  for (const list of Object.values(MALL_CHIP_SLUGS)) {
    for (const item of list) {
      if (item === slug) return true;
    }
  }
  return false;
}

type MallRow = Parameters<typeof shopDisplayCents>[0] & {
  auctionEndsAt: Date | string | null;
  sellerId: string;
  title: string;
  game: string | null;
  cardName: string | null;
  categorySlug: string;
  categoryZh: string;
  categoryEn: string;
};

function stamp(value: Date | string | null): number | null {
  if (value == null || value === "") return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Shop-tab pills. RESERVED is not a ListingStatus — a hold is binLockOrderId on an ACTIVE row. */
export type ShopPill = "ACTIVE" | "RESERVED" | "SOLD" | "UNLISTED" | "ENDED";

export const SHOP_INVENTORY_STATUSES = ["ACTIVE", "UNLISTED", "SOLD", "ENDED"] as const;

const PILL_ZH: Record<ShopPill, string> = {
  ACTIVE: "在售",
  RESERVED: "已保留",
  SOLD: "已售",
  UNLISTED: "已下架",
  ENDED: "已結束",
};

const PILL_EN: Record<ShopPill, string> = {
  ACTIVE: "For sale",
  RESERVED: "Reserved",
  SOLD: "Sold",
  UNLISTED: "Unlisted",
  ENDED: "Ended",
};

export function shopPill(listing: { status: string; binLockOrderId?: string | null; reserved?: boolean }): ShopPill | null {
  if (listing.status === "SOLD") return "SOLD";
  if (listing.status === "UNLISTED") return "UNLISTED";
  if (listing.status === "ENDED") return "ENDED";
  if (listing.status !== "ACTIVE") return null;
  if (listing.binLockOrderId || listing.reserved) return "RESERVED";
  return "ACTIVE";
}

export function shopPillLabel(locale: Locale, pill: ShopPill): string {
  return (locale === "en" ? PILL_EN : PILL_ZH)[pill];
}

/** Inline price is the buy-now amount. Auctions and multi-card totals stay on the listing form. */
export function shopPriceEditable(pill: ShopPill | null, listing: { saleType: string; itemCount: number }): boolean {
  if (pill !== "ACTIVE" && pill !== "RESERVED") return false;
  if (listing.saleType === "AUCTION") return false;
  if (listing.itemCount >= 2) return false;
  return true;
}

export function shopMenu(pill: ShopPill | null): { edit: boolean; unlist: boolean; sold: boolean } {
  const live = pill === "ACTIVE" || pill === "RESERVED";
  return { edit: pill != null, unlist: live, sold: live };
}

/** Newest, price, or ending. A promo pill does not move the row. */
export function orderMallListings<T extends Parameters<typeof shopDisplayCents>[0] & { auctionEndsAt: Date | string | null }>(rows: T[], sort: MallSort): T[] {
  if (sort === "new") return rows;
  const next = [...rows];
  if (sort === "price_asc" || sort === "price_desc") {
    next.sort((a, b) => {
      const delta = (shopDisplayCents(a) ?? 0) - (shopDisplayCents(b) ?? 0);
      return sort === "price_asc" ? delta : -delta;
    });
    return next;
  }
  next.sort((a, b) => mallEnd(a) - mallEnd(b));
  return next;
}

function mallEnd(listing: { saleType: "BUY_NOW" | "AUCTION" | "BOTH"; auctionSettled: boolean; auctionEndsAt: Date | string | null }): number {
  if (listing.saleType === "BUY_NOW" || listing.auctionSettled) return Number.POSITIVE_INFINITY;
  return stamp(listing.auctionEndsAt) ?? Number.POSITIVE_INFINITY;
}

export function mallCategoryHit(cat: string, row: { categorySlug: string; game: string | null }): boolean {
  const slugs = MALL_CHIP_SLUGS[cat as keyof typeof MALL_CHIP_SLUGS];
  const game = (row.game ?? "").toLowerCase();
  if (slugs) {
    if (slugs.some((item) => item === row.categorySlug)) return true;
    if (cat === "topps") return game.includes("topps") || row.categorySlug.startsWith("topps");
    if (cat === "pokemon") return game.includes("pokemon") || game.includes("pokémon") || game.includes("寶可夢");
    if (cat === "one-piece") return game.includes("one piece") || game.includes("海賊") || row.categorySlug === "one-piece";
    if (cat === "riftbound") return game.includes("riftbound");
    if (cat === "yugioh") return game.includes("yu-gi-oh") || game.includes("yugioh") || game.includes("遊戲王");
    return false;
  }
  return row.categorySlug === cat;
}

/** 精選. No tags keeps the lane (a guest is not an empty mall). */
export function interestHit(
  tags: readonly string[],
  row: { title: string; game: string | null; cardName: string | null; categorySlug: string; categoryZh: string; categoryEn: string },
): boolean {
  if (!tags.length) return true;
  return tags.some((tag) => {
    const needle = tag.trim();
    if (!needle) return false;
    return (
      textHits(needle, row.title) ||
      textHits(needle, row.game ?? "") ||
      textHits(needle, row.cardName ?? "") ||
      textHits(needle, row.categorySlug) ||
      textHits(needle, row.categoryZh) ||
      textHits(needle, row.categoryEn)
    );
  });
}

export function liveMallAuction(row: { saleType: "BUY_NOW" | "AUCTION" | "BOTH"; auctionSettled: boolean; auctionEndsAt: Date | string | null }, now: number): boolean {
  if (row.saleType === "BUY_NOW" || row.auctionSettled) return false;
  const end = stamp(row.auctionEndsAt);
  return end != null && end > now;
}

/** Category, then lane, then sort. Promo is not a sort key. Cap is 16. */
export function pickMallListings<T extends MallRow>(
  rows: readonly T[],
  opts: { lane: "hot" | "follow" | "auction"; cat: string; interests: readonly string[]; sort: MallSort; followedIds: readonly string[]; now?: number },
): T[] {
  const now = opts.now ?? Date.now();
  let next = rows.filter((row) => (opts.cat === "picks" ? interestHit(opts.interests, row) : mallCategoryHit(opts.cat, row)));
  if (opts.lane === "follow") {
    const followed = new Set(opts.followedIds);
    next = next.filter((row) => followed.has(row.sellerId));
  } else if (opts.lane === "auction") {
    next = next.filter((row) => liveMallAuction(row, now));
  }
  return orderMallListings(next, opts.sort).slice(0, MALL_FEED_CAP);
}

export function shopDisplayCents(listing: {
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionSettled: boolean;
}): number | null {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  if (auction) return listing.currentBid ?? listing.startPrice ?? listing.price;
  return listing.price ?? listing.currentBid ?? listing.startPrice;
}
