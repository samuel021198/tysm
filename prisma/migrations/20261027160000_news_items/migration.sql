-- Card news. One row per release or drop. Seeded here so migrate-on-build is not an empty page.

CREATE TYPE "NewsTag" AS ENUM ('RELEASE', 'RESTOCK', 'DATE');

CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "teaser" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#111111',
    "linkUrl" TEXT,
    "tag" "NewsTag" NOT NULL DEFAULT 'RELEASE',
    "eventAt" TIMESTAMP(3),
    "hot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsItem_slug_key" ON "NewsItem"("slug");
CREATE INDEX "NewsItem_hot_eventAt_idx" ON "NewsItem"("hot", "eventAt");

-- eventAt values are Hong Kong midnights stored as UTC (TIMESTAMP without time zone).
INSERT INTO "NewsItem" ("id", "slug", "title", "source", "teaser", "body", "coverUrl", "brandColor", "linkUrl", "tag", "eventAt", "hot", "updatedAt") VALUES
('news_riftbound_radiance', 'riftbound-radiance', 'Radiance', 'Riftbound', '已開賣', 'Riftbound Radiance 已經開賣，官方商店可以購買。', NULL, '#4338ca', 'https://riftbound.leagueoflegends.com/en-us/news/', 'DATE', '2026-10-26 16:00:00.000', true, CURRENT_TIMESTAMP),
('news_topps_five_star', 'topps-five-star-2026', '2026 Topps Five Star Baseball', 'Topps', 'EQL', '2026 Topps Five Star Baseball 於 10/28 開放 EQL。名額以官方頁為準。', NULL, '#0f172a', 'https://www.topps.com/', 'DATE', '2026-10-27 16:00:00.000', true, CURRENT_TIMESTAMP),
('news_topps_chrome_tennis', 'chrome-tennis-sapphire', 'Chrome Tennis Sapphire', 'Topps', 'EQL', 'Chrome Tennis Sapphire 於 10/28 進行 EQL。', NULL, '#0f172a', 'https://www.topps.com/', 'DATE', '2026-10-27 16:00:00.000', true, CURRENT_TIMESTAMP),
('news_riftbound_kda', 'riftbound-kda-couture', 'K/DA Couture', 'Riftbound', '官方抽籤', 'Riftbound × K/DA Couture 以官方抽籤發售，名額有限。', NULL, '#4338ca', 'https://riftbound.leagueoflegends.com/en-us/news/', 'DATE', '2026-10-26 16:00:00.000', true, CURRENT_TIMESTAMP),
('news_pokemon_30th_deck', 'pokemon-30th-battle-deck', '30th Celebration Battle Deck（Espeon／Umbreon ex）', 'Pokémon', '英文', '30 週年 Battle Deck，Espeon 與 Umbreon ex，英文版 10/30。', NULL, '#1d4ed8', 'https://www.pokemon.com/us/pokemon-news', 'RELEASE', '2026-10-29 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_op_eb05', 'op-eb05-heroines', 'EXTRA BOOSTER Heroines Edition vol.2（EB-05）', 'One Piece', 'EB-05', 'EXTRA BOOSTER Heroines Edition vol.2，編號 EB-05，10/31。', NULL, '#111827', 'https://www.onepiece-cardgame.com/en/', 'RELEASE', '2026-10-30 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_op_heroines_box', 'op-heroines-precious-box', 'HEROINES PRECIOUS BOX', 'One Piece', '日本公認店限定', 'HEROINES PRECIOUS BOX 為日本公認店限定，10/31。', NULL, '#111827', 'https://www.onepiece-cardgame.com/en/', 'RELEASE', '2026-10-30 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_pokemon_delta_reign', 'pokemon-delta-reign', 'Mega Evolution—Delta Reign', 'Pokémon', '英文', 'Mega Evolution—Delta Reign 英文版，11/6。', NULL, '#1d4ed8', 'https://www.pokemon.com/us/pokemon-news', 'RELEASE', '2026-11-05 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_pokemon_mega_deck', 'pokemon-mega-special-deck', 'スペシャルデッキセットMEGA', 'Pokémon', '日文', '日文スペシャルデッキセットMEGA，11/13。', NULL, '#1d4ed8', 'https://www.pokemon.com/us/pokemon-news', 'RELEASE', '2026-11-12 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_op18', 'op-18-dominance', 'OP-18 The Dominance of God', 'One Piece', '約 11/20–11/21', 'OP-18 The Dominance of God，預計約 11/20 至 11/21。', NULL, '#111827', 'https://www.onepiece-cardgame.com/en/', 'RELEASE', '2026-11-19 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_riftbound_gift', 'riftbound-gift-of-the-rift', 'Gift of the Rift', 'Riftbound', '12/4', 'Gift of the Rift 預計 12/4。', NULL, '#4338ca', 'https://riftbound.leagueoflegends.com/en-us/news/', 'RELEASE', '2026-12-03 16:00:00.000', false, CURRENT_TIMESTAMP),
('news_panini_prizm_wnba', 'panini-prizm-wnba', 'Prizm WNBA', 'Panini', 'Coming Soon', 'Panini Prizm WNBA 尚未公佈開賣日。', NULL, '#9f1239', 'https://www.panini.com/', 'RELEASE', NULL, false, CURRENT_TIMESTAMP);
