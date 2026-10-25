-- One Piece and Riftbound join the dex.
-- Existing CatalogSet / CatalogCard rows stay POKEMON: game is NOT NULL and already defaults to POKEMON.
-- PostgreSQL 12+ allows ADD VALUE inside the migration transaction. These values are not used in this file.

ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'ONE_PIECE';
ALTER TYPE "CatalogGame" ADD VALUE IF NOT EXISTS 'RIFTBOUND';

CREATE INDEX "CatalogCard_game_printRegion_idx" ON "CatalogCard"("game", "printRegion");
CREATE INDEX "CatalogSet_game_printRegion_idx" ON "CatalogSet"("game", "printRegion");
