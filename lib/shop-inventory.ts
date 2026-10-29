import type { Locale } from "./i18n";

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
