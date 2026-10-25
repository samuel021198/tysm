-- Topps Basketball and Topps Soccer join the dex as two sports, not one brand per line.
-- Existing rows stay on their current game. These values are not used in this file.
-- PostgreSQL 12+ allows ADD VALUE inside the migration transaction.

ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'TOPPS_BASKETBALL';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'TOPPS_SOCCER';
