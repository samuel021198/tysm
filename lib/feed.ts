import type { Prisma } from "@prisma/client";

export function activeWhere(hidden: string[]): Prisma.ListingWhereInput {
  const now = new Date();
  return {
    status: "ACTIVE",
    quantityAvailable: { gt: 0 },
    binLockOrderId: null,
    ...(hidden.length ? { sellerId: { notIn: hidden } } : {}),
    OR: [
      { saleType: "BUY_NOW" },
      { saleType: "BOTH", auctionSettled: true },
      { saleType: "BOTH", auctionEndsAt: { gt: now } },
      { saleType: "AUCTION", auctionSettled: false, auctionEndsAt: { gt: now } },
    ],
  };
}

/** Fields a buyer, guest, or card may receive. Reserve is not one of them. */
export const publicCardSelect = {
  id: true,
  title: true,
  saleType: true,
  price: true,
  startPrice: true,
  currentBid: true,
  auctionEndsAt: true,
  auctionSettled: true,
  favoriteCount: true,
  conditionTrack: true,
  rawGrade: true,
  grader: true,
  gradeValue: true,
  sellerId: true,
  cardName: true,
  personName: true,
  game: true,
  photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
  seller: { select: { id: true, nickname: true } },
} satisfies Prisma.ListingSelect;
