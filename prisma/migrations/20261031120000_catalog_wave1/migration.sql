-- Wave-1 name catalog. Panini, Union Arena, and Vanguard stay out of this enum.
-- Existing rows keep their game. PostgreSQL 12+ allows ADD VALUE in this transaction.

ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'YUGIOH';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'DIGIMON';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'WEISS_SCHWARZ';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'LORCANA';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'MTG';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'FLESH_AND_BLOOD';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'BANDAI_GUNDAM';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'DRAGON_BALL';
