-- Pokémon encyclopedia. Image bytes stay on R2 (or a temporary HTTPS URL), not in Postgres.

CREATE TYPE "CatalogGame" AS ENUM ('POKEMON');

CREATE TYPE "PrintRegion" AS ENUM ('JP', 'WEST');

CREATE TABLE "CatalogSet" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "game" "CatalogGame" NOT NULL DEFAULT 'POKEMON',
    "printRegion" "PrintRegion" NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "series" TEXT,
    "releaseDate" TEXT,
    "total" INTEGER,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogCard" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "game" "CatalogGame" NOT NULL DEFAULT 'POKEMON',
    "printRegion" "PrintRegion" NOT NULL,
    "collectorNumber" TEXT NOT NULL,
    "numberKey" TEXT NOT NULL DEFAULT '',
    "nameEn" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sourceImageUrl" TEXT,
    "rarity" TEXT,
    "artist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogSet_externalId_key" ON "CatalogSet"("externalId");
CREATE INDEX "CatalogSet_printRegion_releaseDate_idx" ON "CatalogSet"("printRegion", "releaseDate");
CREATE INDEX "CatalogSet_code_idx" ON "CatalogSet"("code");

CREATE UNIQUE INDEX "CatalogCard_externalId_key" ON "CatalogCard"("externalId");
CREATE INDEX "CatalogCard_nameEn_idx" ON "CatalogCard"("nameEn");
CREATE INDEX "CatalogCard_nameJa_idx" ON "CatalogCard"("nameJa");
CREATE INDEX "CatalogCard_collectorNumber_idx" ON "CatalogCard"("collectorNumber");
CREATE INDEX "CatalogCard_numberKey_idx" ON "CatalogCard"("numberKey");
CREATE INDEX "CatalogCard_printRegion_numberKey_idx" ON "CatalogCard"("printRegion", "numberKey");
CREATE INDEX "CatalogCard_setId_idx" ON "CatalogCard"("setId");

ALTER TABLE "CatalogCard" ADD CONSTRAINT "CatalogCard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CatalogSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Listing" ADD COLUMN "catalogCardId" TEXT;
CREATE INDEX "Listing_catalogCardId_idx" ON "Listing"("catalogCardId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_catalogCardId_fkey" FOREIGN KEY ("catalogCardId") REFERENCES "CatalogCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollectionItem" ADD COLUMN "catalogCardId" TEXT;
CREATE INDEX "CollectionItem_catalogCardId_idx" ON "CollectionItem"("catalogCardId");
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_catalogCardId_fkey" FOREIGN KEY ("catalogCardId") REFERENCES "CatalogCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
