-- Auction lite: hidden reserve, fixed durations, and a passed (流標) flag.
-- Public bids stay on BidEvent. ProxyBid is unused by the new bid path.

ALTER TABLE "Listing" ADD COLUMN "reservePrice" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "auctionDays" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "auctionPassed" BOOLEAN NOT NULL DEFAULT false;
