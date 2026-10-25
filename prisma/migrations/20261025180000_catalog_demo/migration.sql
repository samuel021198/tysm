-- Demo is its own dex game, not a Pokémon set.
-- PostgreSQL 12+ allows ADD VALUE inside the migration transaction. This value is not used in this file.

ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'DEMO';
