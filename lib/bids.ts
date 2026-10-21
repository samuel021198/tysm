import { prisma } from "./db";
import { Fail, asFail } from "./fail";
import { notify } from "./social";
import { extendedEnd, resolveAuction, validateMaxBid } from "./rules";

export async function placeBid(userId: string, listingId: string, maxAmount: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, error: "login" };
  if (user.bidBanned) return { ok: false as const, error: "banned" };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const listing = await tx.listing.findUnique({ where: { id: listingId } });
        if (!listing || listing.status !== "ACTIVE") throw new Fail("unavailable");
        if (listing.sellerId === userId) throw new Fail("own");
        if (listing.saleType === "BUY_NOW" || listing.auctionSettled || listing.bidsVoided) throw new Fail("unavailable");
        if (!listing.startPrice || !listing.auctionEndsAt) throw new Fail("unavailable");
        if (listing.auctionEndsAt <= new Date()) throw new Fail("ended");
        if (listing.binLockOrderId) throw new Fail("locked");
        const block = await tx.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: listing.sellerId },
              { blockerId: listing.sellerId, blockedId: userId },
            ],
          },
        });
        if (block) throw new Fail("blocked");

        const proxies = await tx.proxyBid.findMany({ where: { listingId } });
        const mine = proxies.find((row) => row.bidderId === userId);
        const before = resolveAuction(listing.startPrice, proxies);
        const verdict = validateMaxBid({
          startPrice: listing.startPrice,
          currentPrice: proxies.length ? before.price : null,
          hasBids: proxies.length > 0,
          leaderId: before.leaderId,
          bidderId: userId,
          maxAmount,
          existingMax: mine?.maxAmount ?? null,
        });
        if (!verdict.ok) throw new Fail(verdict.reason);

        if (mine) await tx.proxyBid.update({ where: { id: mine.id }, data: { maxAmount } });
        else await tx.proxyBid.create({ data: { listingId, bidderId: userId, maxAmount } });

        const next = await tx.proxyBid.findMany({ where: { listingId } });
        const resolved = resolveAuction(listing.startPrice, next);
        const end = extendedEnd(listing.auctionEndsAt, new Date());
        const previousPrice = listing.currentBid;
        const updated = await tx.listing.updateMany({
          where: { id: listingId, bidVersion: listing.bidVersion, status: "ACTIVE", binLockOrderId: null },
          data: {
            currentBid: resolved.price,
            leaderId: resolved.leaderId,
            auctionEndsAt: end,
            bidVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new Fail("retry");
        if (
          resolved.leaderId &&
          (proxies.length === 0 || resolved.price !== previousPrice || resolved.leaderId !== listing.leaderId)
        ) {
          await tx.bidEvent.create({
            data: { listingId, bidderId: resolved.leaderId, publicAmount: resolved.price },
          });
        }
        return {
          previousLeader: listing.leaderId,
          previousPrice,
          leaderId: resolved.leaderId,
          price: resolved.price,
          extended: end.getTime() !== listing.auctionEndsAt.getTime(),
          sellerId: listing.sellerId,
          title: listing.title,
        };
      });

      if (outcome.price !== outcome.previousPrice) {
        await notify(outcome.sellerId, "bid", "拍賣有新出價", outcome.title, `/listing/${listingId}`);
      }
      if (outcome.leaderId !== userId) {
        await notify(userId, "bid", "你的出價未領先", outcome.title, `/listing/${listingId}`);
      }
      if (outcome.previousLeader && outcome.previousLeader !== outcome.leaderId) {
        await notify(outcome.previousLeader, "bid", "你已被超價", outcome.title, `/listing/${listingId}`);
      }
      return { ok: true as const, price: outcome.price, leading: outcome.leaderId === userId, extended: outcome.extended };
    } catch (error) {
      const code = asFail(error);
      if (code === "retry") continue;
      if (code) return { ok: false as const, error: code };
      throw error;
    }
  }
  return { ok: false as const, error: "unavailable" };
}
