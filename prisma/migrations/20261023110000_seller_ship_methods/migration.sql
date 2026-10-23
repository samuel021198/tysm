-- Seller-chosen shipping. Platform fee is HK$0 for 順豐到付, 面交, and 店舖自取.
-- Prepaid SF / locker amounts are not collected anymore.
-- shipMeetFee 0 was the column default, not a chosen meetup, so old rows do not
-- invent a district. They become 順豐到付 so checkout still has a method.
-- Existing orders keep their shippingTotal; this only remaps listings.

ALTER TABLE "User" ADD COLUMN "storeName" TEXT;
ALTER TABLE "User" ADD COLUMN "storeDistrict" TEXT;
ALTER TABLE "User" ADD COLUMN "storeLine1" TEXT;
ALTER TABLE "User" ADD COLUMN "storeHours" TEXT;

ALTER TABLE "Listing" ADD COLUMN "shipSfCod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN "shipMeetup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN "shipPickup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN "meetupDistrict" TEXT;
ALTER TABLE "Listing" ADD COLUMN "meetupWindow" TEXT;
ALTER TABLE "Listing" ADD COLUMN "meetupNotes" TEXT;

UPDATE "Listing"
SET "shipSfCod" = true
WHERE "shipSfCod" = false AND "shipMeetup" = false AND "shipPickup" = false;

UPDATE "Listing"
SET "shippingFee" = 0,
    "shipLockerFee" = 0,
    "shipMeetFee" = 0;

ALTER TABLE "Order" ADD COLUMN "fulfillment" JSONB;
