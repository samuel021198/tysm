import type { SnkrMarket } from "./snkrdunk";

export type DemoCardSeed = {
  id: string;
  setId: string;
  setCode: string;
  number: string;
  nameEn: string;
  nameJa: string;
  rarity: string;
  imageUrl: string;
  /** Sample market anchor, whole JPY. */
  yen: number;
  /** Sample ask, whole HKD. */
  hkd: number;
  /** Existing seed listing to attach when that row is still unlinked. */
  listingId?: string;
};

export type DemoSetSeed = {
  id: string;
  code: string;
  nameEn: string;
  nameJa: string;
  releaseDate: string;
};

export const DEMO_SETS: readonly DemoSetSeed[] = [
  { id: "demo_set_dm01", code: "DM01", nameEn: "Demo Vault", nameJa: "示範珍藏", releaseDate: "2024-01-15" },
  { id: "demo_set_dm02", code: "DM02", nameEn: "Demo Tide", nameJa: "示範航海", releaseDate: "2024-06-01" },
];

export const DEMO_CARDS: readonly DemoCardSeed[] = [
  { id: "demo_card_charizard", setId: "demo_set_dm01", setCode: "DM01", number: "001", nameEn: "Charizard", nameJa: "噴火龍", rarity: "SAR", imageUrl: "/demo/cards/seed_charizard.svg", yen: 48000, hkd: 1280, listingId: "seed_charizard" },
  { id: "demo_card_pikachu", setId: "demo_set_dm01", setCode: "DM01", number: "002", nameEn: "Pikachu", nameJa: "皮卡丘", rarity: "AR", imageUrl: "/demo/cards/seed_pikachu.svg", yen: 8000, hkd: 280, listingId: "seed_pikachu" },
  { id: "demo_card_mewtwo", setId: "demo_set_dm01", setCode: "DM01", number: "003", nameEn: "Mewtwo", nameJa: "超夢", rarity: "SR", imageUrl: "/demo/cards/seed_mewtwo.svg", yen: 22000, hkd: 640, listingId: "seed_mewtwo" },
  { id: "demo_card_gengar", setId: "demo_set_dm01", setCode: "DM01", number: "004", nameEn: "Gengar", nameJa: "耿鬼", rarity: "RR", imageUrl: "/demo/cards/seed_gengar.svg", yen: 6000, hkd: 180, listingId: "seed_gengar" },
  { id: "demo_card_umbreon", setId: "demo_set_dm01", setCode: "DM01", number: "005", nameEn: "Umbreon", nameJa: "月亮伊布", rarity: "SAR", imageUrl: "/demo/cards/seed_umbreon.svg", yen: 35000, hkd: 960, listingId: "seed_umbreon" },
  { id: "demo_card_eevee", setId: "demo_set_dm01", setCode: "DM01", number: "006", nameEn: "Eevee", nameJa: "伊布", rarity: "C", imageUrl: "/demo/cards/seed_eevee.svg", yen: 4000, hkd: 80, listingId: "seed_eevee" },
  { id: "demo_card_lugia", setId: "demo_set_dm02", setCode: "DM02", number: "001", nameEn: "Lugia", nameJa: "洛奇亞", rarity: "SR", imageUrl: "/demo/cards/seed_lugia.svg", yen: 18000, hkd: 520, listingId: "seed_lugia" },
  { id: "demo_card_rayquaza", setId: "demo_set_dm02", setCode: "DM02", number: "002", nameEn: "Rayquaza", nameJa: "烈空坐", rarity: "SAR", imageUrl: "/demo/cards/seed_rayquaza.svg", yen: 27000, hkd: 760, listingId: "seed_rayquaza" },
  { id: "demo_card_luffy", setId: "demo_set_dm02", setCode: "DM02", number: "003", nameEn: "Monkey D. Luffy", nameJa: "路飛", rarity: "SEC", imageUrl: "/demo/cards/seed_luffy.svg", yen: 15000, hkd: 420, listingId: "seed_luffy" },
  { id: "demo_card_zoro", setId: "demo_set_dm02", setCode: "DM02", number: "004", nameEn: "Roronoa Zoro", nameJa: "索隆", rarity: "SR", imageUrl: "/demo/cards/seed_zoro.svg", yen: 12000, hkd: 360, listingId: "seed_zoro" },
];

/** Pokémon series pinned above the other 寶可夢 sets. Art is real TCGdex files; prices are sample only. */
export const POKEMON_DEMO_SET: DemoSetSeed = {
  id: "poke_demo_set",
  code: "DEMO",
  nameEn: "Demo",
  nameJa: "Demo",
  releaseDate: "2024-01-01",
};

export const POKEMON_DEMO_CARDS: readonly DemoCardSeed[] = [
  { id: "poke_demo_001", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "001", nameEn: "Charizard", nameJa: "噴火龍", rarity: "Rare Holo", imageUrl: "https://assets.tcgdex.net/en/base/base1/4/high.webp", yen: 48000, hkd: 1280 },
  { id: "poke_demo_002", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "002", nameEn: "Pikachu", nameJa: "皮卡丘", rarity: "Common", imageUrl: "https://assets.tcgdex.net/en/base/base1/58/high.webp", yen: 8000, hkd: 280 },
  { id: "poke_demo_003", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "003", nameEn: "Mewtwo", nameJa: "超夢", rarity: "Rare", imageUrl: "https://assets.tcgdex.net/en/base/base1/10/high.webp", yen: 22000, hkd: 640 },
  { id: "poke_demo_004", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "004", nameEn: "Gengar", nameJa: "耿鬼", rarity: "Rare", imageUrl: "https://assets.tcgdex.net/ja/SV/SV2a/094/high.webp", yen: 6000, hkd: 180 },
  { id: "poke_demo_005", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "005", nameEn: "Eevee", nameJa: "伊布", rarity: "Common", imageUrl: "https://assets.tcgdex.net/ja/SV/SV2a/133/high.webp", yen: 4000, hkd: 80 },
  { id: "poke_demo_006", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "006", nameEn: "Umbreon ex", nameJa: "月亮伊布ex", rarity: "SAR", imageUrl: "https://assets.tcgdex.net/ja/SV/SV8a/217/high.webp", yen: 35000, hkd: 960 },
  { id: "poke_demo_007", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "007", nameEn: "Lugia", nameJa: "洛奇亞", rarity: "Rare", imageUrl: "https://assets.tcgdex.net/en/neo/neo1/9/high.webp", yen: 18000, hkd: 520 },
  { id: "poke_demo_008", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "008", nameEn: "Rayquaza", nameJa: "烈空坐", rarity: "Rare Holo", imageUrl: "https://assets.tcgdex.net/en/ex/ex8/107/high.webp", yen: 27000, hkd: 760 },
  { id: "poke_demo_009", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "009", nameEn: "Mew ex", nameJa: "夢幻ex", rarity: "Ultra Rare", imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/193/high.webp", yen: 42000, hkd: 1100 },
  { id: "poke_demo_010", setId: POKEMON_DEMO_SET.id, setCode: "DEMO", number: "010", nameEn: "Charizard ex", nameJa: "噴火龍ex", rarity: "Special Illustration Rare", imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/199/high.webp", yen: 56000, hkd: 1480 },
];

/** Game Demo, or the Pokémon set whose code is DEMO. Those cards never call SNKRDUNK. */
export function usesSampleMarket(game: string, setCode: string): boolean {
  return game === "DEMO" || setCode === "DEMO";
}

/** DEMO stays first in the 寶可夢 series list. Other sets keep their release order. */
export function pinDemoSet<T extends { code: string }>(sets: readonly T[]): T[] {
  return [...sets].sort((a, b) => Number(b.code === "DEMO") - Number(a.code === "DEMO"));
}

export type DemoTrade = { seller: string; grade: string; hkd: number };

function hash(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function demoCardSeed(id: string): DemoCardSeed | null {
  return DEMO_CARDS.find((card) => card.id === id) ?? POKEMON_DEMO_CARDS.find((card) => card.id === id) ?? null;
}

/** Stable sample curve so a demo card detail is never an empty price tab. Not a live quote. */
export function demoMarket(id: string): SnkrMarket {
  const base = demoCardSeed(id)?.yen ?? 10000;
  const day = 86_400_000;
  const now = Date.now();
  const points = Array.from({ length: 40 }, (_, index) => {
    const wobble = ((hash(`${id}:${index}`) % 21) - 10) / 100;
    return { t: now - (39 - index) * 3 * day, price: Math.max(500, Math.round(base * (1 + wobble))) };
  });
  const recent = points.slice(-4).reverse().map((point, index) => ({
    price: point.price,
    date: index === 0 ? "1時間前" : index === 1 ? "1日前" : index === 2 ? "3日前" : "2026/09/02",
    condition: index % 2 === 0 ? "PSA10" : "A",
  }));
  const prices = recent.map((sale) => sale.price);
  return {
    status: "ok",
    grade: "PSA10",
    price: recent[0]?.price ?? base,
    recent,
    saleCount: 12,
    saleCountCapped: false,
    rangeLow: Math.min(...prices),
    rangeHigh: Math.max(...prices),
    premium: 1.8,
    points,
  };
}

export function demoTrades(id: string): DemoTrade[] {
  const hkd = demoCardSeed(id)?.hkd ?? 200;
  return [
    { seller: "卡牌阿明", grade: "A 級", hkd },
    { seller: "旺角卡舖", grade: "PSA 10", hkd: Math.round(hkd * 1.8) },
  ];
}
