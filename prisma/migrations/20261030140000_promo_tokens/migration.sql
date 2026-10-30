-- Soft-launch promo tokens. Null balance means the one-time grant has not run.
-- Existing rows stay; nothing is wiped.

ALTER TABLE "User" ADD COLUMN "promoBalance" INTEGER;
ALTER TABLE "User" ADD COLUMN "promoToast" TEXT;

ALTER TABLE "Listing" ADD COLUMN "promoted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN "promoDay" TEXT;

CREATE INDEX "Listing_promoted_promoDay_idx" ON "Listing"("promoted", "promoDay");
