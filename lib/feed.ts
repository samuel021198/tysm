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

export const cardInclude = {
  photos: { orderBy: { position: "asc" as const }, take: 1 },
  seller: { select: { id: true, nickname: true } },
} satisfies Prisma.ListingInclude;
