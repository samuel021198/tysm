-- HK shipping choices, card identity, and order tracking for the marketplace skin.
ALTER TABLE "Listing" ADD COLUMN "shipLockerFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "shipMeetFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "cardNumber" TEXT;
ALTER TABLE "Listing" ADD COLUMN "rarity" TEXT;

UPDATE "Listing"
SET "shipLockerFee" = GREATEST(0, "shippingFee" - 800)
WHERE "shipLockerFee" = 0 AND "shippingFee" > 0;

ALTER TABLE "Order" ADD COLUMN "shippingMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "courierName" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentBrand" TEXT;
