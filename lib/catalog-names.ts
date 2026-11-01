import { readFileSync } from "node:fs";
import path from "node:path";
import { officialNameJa } from "./catalog-aliases";
import { numberKey } from "./dex";

/** Wave-1 games that ship a curated name list. Dragon Ball is a sell leaf only. */
export type WaveGame =
  | "YUGIOH"
  | "DIGIMON"
  | "WEISS_SCHWARZ"
  | "LORCANA"
  | "MTG"
  | "FLESH_AND_BLOOD"
  | "BANDAI_GUNDAM";

export const CURATED_DIR = path.join(process.cwd(), "data", "curated");

const FILES: { file: string; game: WaveGame }[] = [
  { file: "yugioh.json", game: "YUGIOH" },
  { file: "weiss-schwarz.json", game: "WEISS_SCHWARZ" },
  { file: "mtg.json", game: "MTG" },
  { file: "digimon.json", game: "DIGIMON" },
  { file: "lorcana.json", game: "LORCANA" },
  { file: "bandai-gundam.json", game: "BANDAI_GUNDAM" },
  { file: "flesh-and-blood.json", game: "FLESH_AND_BLOOD" },
];

export const CURATED_COUNTS: Record<WaveGame, number> = {
  YUGIOH: 4000,
  WEISS_SCHWARZ: 4000,
  MTG: 4000,
  DIGIMON: 1947,
  LORCANA: 1370,
  BANDAI_GUNDAM: 967,
  FLESH_AND_BLOOD: 3169,
};

type RawFile = {
  brand: string;
  proposedEnum: string;
  imageUrl: string | null;
  series: { name: string; cards: { nameEn?: string; nameJa?: string | null }[] }[];
};

export type NameSet = {
  externalId: string;
  game: WaveGame;
  code: string;
  nameEn: string;
  nameJa: string;
  series: string;
  total: number;
};

export type NameCard = {
  externalId: string;
  setExternalId: string;
  game: WaveGame;
  collectorNumber: string;
  numberKey: string;
  nameEn: string;
  nameJa: string;
};

export type SoftListingPlan = {
  id: string;
  title: string;
  proposedEnum: WaveGame;
  brand: string;
  series: string;
  cardNameEn: string;
  cardNameJa: string | null;
  priceHKD: number;
  listingType: "auction" | "bin";
  sellerPersona: string;
  imageUrl: null;
};

/** Names only. Throws if a curated file carries an image URL. */
export function loadCuratedCatalog(dir = CURATED_DIR): { sets: NameSet[]; cards: NameCard[] } {
  const sets: NameSet[] = [];
  const cards: NameCard[] = [];
  for (const spec of FILES) {
    const raw = JSON.parse(readFileSync(path.join(dir, spec.file), "utf8")) as RawFile;
    if (raw.proposedEnum !== spec.game) throw new Error(`${spec.file} enum`);
    if (raw.imageUrl) throw new Error(`${spec.file} image`);
    raw.series.forEach((series, seriesIndex) => {
      const code = `S${String(seriesIndex + 1).padStart(3, "0")}`;
      const setExternalId = `nmset:${spec.game}:${code}`;
      const name = series.name.trim();
      sets.push({
        externalId: setExternalId,
        game: spec.game,
        code,
        nameEn: name,
        nameJa: name,
        series: raw.brand,
        total: series.cards.length,
      });
      series.cards.forEach((card, cardIndex) => {
        const nameEn = (card.nameEn || "").trim();
        if (!nameEn) throw new Error(`${spec.file} blank name`);
        const nameJa = officialNameJa(spec.game, nameEn) || (card.nameJa || "").trim();
        if (/https?:\/\//i.test(nameEn) || /https?:\/\//i.test(nameJa)) throw new Error(`${spec.file} image url`);
        const n = String(cardIndex + 1);
        cards.push({
          externalId: `nm:${spec.game}:${code}:${n.padStart(4, "0")}`,
          setExternalId,
          game: spec.game,
          collectorNumber: n,
          numberKey: numberKey(n),
          nameEn,
          nameJa,
        });
      });
    });
  }
  return { sets, cards };
}

export function curatedCounts(cards: NameCard[]): Record<WaveGame, number> {
  const counts = {
    YUGIOH: 0,
    WEISS_SCHWARZ: 0,
    MTG: 0,
    DIGIMON: 0,
    LORCANA: 0,
    BANDAI_GUNDAM: 0,
    FLESH_AND_BLOOD: 0,
  };
  for (const card of cards) counts[card.game] += 1;
  return counts;
}

function readSoftFile(dir: string, file: string, expected: number): SoftListingPlan[] {
  const rows = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as SoftListingPlan[];
  if (rows.length !== expected) throw new Error(`${file} ${rows.length}`);
  return rows;
}

/** `demo-01` → `soft_demo_01`. Night2 ids are already `soft_demo_51` and stay that way. */
export function softListingId(raw: string): string {
  const slug = raw.trim().replace(/-/g, "_");
  if (!slug) throw new Error("soft listing id");
  return slug.startsWith("soft_") ? slug : `soft_${slug}`;
}

/** Keeps wave-1 posts at `soft_post_demo_01`. Night2 `soft_demo_51` becomes `soft_post_demo_51`. */
export function softPostId(raw: string): string {
  const slug = raw.trim().replace(/-/g, "_").replace(/^soft_/, "");
  if (!slug) throw new Error("soft post id");
  return `soft_post_${slug}`;
}

/** Wave-1 soft listings plus the night2 51–100 batch. Ids and English names must not overlap. */
export function loadSoftListings(dir = CURATED_DIR): SoftListingPlan[] {
  const first = readSoftFile(dir, "50-demo-listings.json", 50);
  const more = readSoftFile(dir, "50-more-demo-listings.json", 50);
  const rows = [...first, ...more];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const row of rows) {
    if (row.imageUrl) throw new Error(`${row.id} image`);
    if (!row.cardNameEn.trim()) throw new Error(`${row.id} name`);
    if (ids.has(row.id)) throw new Error(`soft listing id overlap ${row.id}`);
    ids.add(row.id);
    const key = `${row.proposedEnum}\0${row.cardNameEn}`;
    if (names.has(key)) throw new Error(`soft name overlap ${row.cardNameEn}`);
    names.add(key);
  }
  for (let n = 51; n <= 100; n += 1) {
    if (!ids.has(`soft_demo_${n}`)) throw new Error(`missing soft_demo_${n}`);
  }
  return rows;
}
