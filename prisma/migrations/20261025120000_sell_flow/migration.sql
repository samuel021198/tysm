-- Multi-card rows, in-stock vs preorder, and the existing SCHEDULED/publishAt clock.
-- Old listings stay IN_STOCK. shipWithinDays is filled only when shippingDays was already 3, 7, or 30.
-- publishAt is unchanged: browse/feed read ACTIVE only, and sweep() promotes due SCHEDULED rows.

CREATE TYPE "StockType" AS ENUM ('IN_STOCK', 'PREORDER');

ALTER TABLE "Listing" ADD COLUMN "stockType" "StockType" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "Listing" ADD COLUMN "shipWithinDays" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "preorderShipDate" TIMESTAMP(3);

UPDATE "Listing"
SET "shipWithinDays" = "shippingDays"
WHERE "shippingDays" IN (3, 7, 30);

CREATE TABLE "ListingItem" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "price" INTEGER,
    "cardName" TEXT,
    "catalogCardId" TEXT,
    "catalogTitle" TEXT,
    "year" TEXT,
    "setName" TEXT,
    "setCode" TEXT,
    "collectorNumber" TEXT,
    "rarity" TEXT,
    "language" TEXT,
    "game" TEXT,
    "conditionTrack" "ConditionTrack" NOT NULL DEFAULT 'RAW',
    "rawGrade" "RawGrade",
    "grader" "Grader",
    "gradeValue" INTEGER,
    "certNumber" TEXT,

    CONSTRAINT "ListingItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingItem_listingId_position_idx" ON "ListingItem"("listingId", "position");
CREATE INDEX "ListingItem_catalogCardId_idx" ON "ListingItem"("catalogCardId");

ALTER TABLE "ListingItem" ADD CONSTRAINT "ListingItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingItem" ADD CONSTRAINT "ListingItem_catalogCardId_fkey" FOREIGN KEY ("catalogCardId") REFERENCES "CatalogCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Card lines for the sell step. Skipped when the parent group is not seeded yet.
INSERT INTO "Category" ("id", "parentId", "slug", "nameZh", "nameEn", "level", "groupKey", "sort")
SELECT v.id, v."parentId", v.slug, v."nameZh", v."nameEn", 'LEAF'::"CategoryLevel", v."groupKey", v.sort
FROM (
  VALUES
    ('cat_topps_soccer'::text, 'cat_athletes'::text, 'topps-soccer'::text, 'Topps 足球'::text, 'Topps Soccer'::text, 'athlete'::text, 4),
    ('cat_topps_basketball'::text, 'cat_athletes'::text, 'topps-basketball'::text, 'Topps 籃球'::text, 'Topps Basketball'::text, 'athlete'::text, 5),
    ('cat_topps_baseball'::text, 'cat_athletes'::text, 'topps-baseball'::text, 'Topps 棒球'::text, 'Topps Baseball'::text, 'athlete'::text, 6),
    ('cat_panini_soccer'::text, 'cat_athletes'::text, 'panini-soccer'::text, 'Panini 足球'::text, 'Panini Soccer'::text, 'athlete'::text, 7)
) AS v(id, "parentId", slug, "nameZh", "nameEn", "groupKey", sort)
WHERE EXISTS (SELECT 1 FROM "Category" parent WHERE parent.id = v."parentId")
ON CONFLICT ("slug") DO NOTHING;
