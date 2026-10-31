-- Wave-1 sell leaves so the picker and 更多 can show labels before catalog cards land.
-- Skipped when the TCG group is not seeded yet. Existing slugs are left alone.
-- CatalogGame enums stay on the catalog PR. No demo listings.

INSERT INTO "Category" ("id", "parentId", "slug", "nameZh", "nameEn", "level", "groupKey", "sort")
SELECT v.id, v."parentId", v.slug, v."nameZh", v."nameEn", 'LEAF'::"CategoryLevel", v."groupKey", v.sort
FROM (
  VALUES
    ('cat_yugioh'::text, 'cat_tcg'::text, 'yugioh'::text, 'Yu-Gi-Oh'::text, 'Yu-Gi-Oh'::text, 'tcg'::text, 9),
    ('cat_weiss_schwarz'::text, 'cat_tcg'::text, 'weiss-schwarz'::text, 'Weiss Schwarz'::text, 'Weiss Schwarz'::text, 'tcg'::text, 10),
    ('cat_digimon'::text, 'cat_tcg'::text, 'digimon'::text, 'Digimon'::text, 'Digimon'::text, 'tcg'::text, 11),
    ('cat_lorcana'::text, 'cat_tcg'::text, 'lorcana'::text, 'Lorcana'::text, 'Lorcana'::text, 'tcg'::text, 12),
    ('cat_mtg'::text, 'cat_tcg'::text, 'mtg'::text, 'MTG'::text, 'MTG'::text, 'tcg'::text, 13),
    ('cat_flesh_and_blood'::text, 'cat_tcg'::text, 'flesh-and-blood'::text, 'Flesh and Blood'::text, 'Flesh and Blood'::text, 'tcg'::text, 14),
    ('cat_gundam'::text, 'cat_tcg'::text, 'gundam'::text, 'Gundam'::text, 'Gundam'::text, 'tcg'::text, 15),
    ('cat_dragon_ball'::text, 'cat_tcg'::text, 'dragon-ball'::text, 'Dragon Ball'::text, 'Dragon Ball'::text, 'tcg'::text, 16),
    ('cat_other'::text, 'cat_tcg'::text, 'other'::text, '其他'::text, 'Other'::text, 'tcg'::text, 17)
) AS v(id, "parentId", slug, "nameZh", "nameEn", "groupKey", sort)
WHERE EXISTS (SELECT 1 FROM "Category" parent WHERE parent.id = v."parentId")
ON CONFLICT ("slug") DO NOTHING;
