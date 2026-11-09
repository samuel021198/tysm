-- Public 買取. Photos, a pay price, and a negotiable flag. Not a listing.

CREATE TABLE "Buyout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "catalogCardId" TEXT,
    "note" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "negotiable" BOOLEAN NOT NULL DEFAULT true,
    "shipSfCod" BOOLEAN NOT NULL DEFAULT false,
    "shipMeetup" BOOLEAN NOT NULL DEFAULT false,
    "meetupDistrict" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buyout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuyoutPhoto" (
    "id" TEXT NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BuyoutPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Buyout_userId_createdAt_idx" ON "Buyout"("userId", "createdAt");
CREATE INDEX "Buyout_catalogCardId_idx" ON "Buyout"("catalogCardId");
CREATE INDEX "BuyoutPhoto_buyoutId_idx" ON "BuyoutPhoto"("buyoutId");

ALTER TABLE "Buyout" ADD CONSTRAINT "Buyout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Buyout" ADD CONSTRAINT "Buyout_catalogCardId_fkey" FOREIGN KEY ("catalogCardId") REFERENCES "CatalogCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuyoutPhoto" ADD CONSTRAINT "BuyoutPhoto_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
