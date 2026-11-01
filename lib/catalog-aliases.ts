import { readFileSync } from "node:fs";
import path from "node:path";
import { foldSearch } from "./search";

/** Wave-1 catalog games. Wave-2 (Panini / Union Arena / Vanguard) is rejected at load. */
const ALLOWED = new Set([
  "POKEMON",
  "ONE_PIECE",
  "RIFTBOUND",
  "DEMO",
  "TOPPS_BASKETBALL",
  "TOPPS_SOCCER",
  "YUGIOH",
  "DIGIMON",
  "WEISS_SCHWARZ",
  "LORCANA",
  "MTG",
  "FLESH_AND_BLOOD",
  "BANDAI_GUNDAM",
  "DRAGON_BALL",
]);

export type AliasRow = {
  proposedEnum: string;
  nameEn: string;
  nameJa: string;
  nameZh: string;
  also: string[];
};

type AliasFile = { aliases?: AliasRow[] };

// ponytail: linear scan of ~200 alias rows per query. Upgrade path: a DB synonym column if this file grows past a few thousand.
const FILE = path.join(process.cwd(), "data", "curated", "ja-aliases.json");

let cached: AliasRow[] | null = null;

/** Drop middle dots and spaces so ブラック・マジシャン and ブラックマジシャン match. */
export function foldAlias(value: string): string {
  return foldSearch(value.normalize("NFKC")).replace(/[\s\u3000\u00b7\u30fb\uff65\u2022\u2027\u2219]+/g, "");
}

function clean(row: AliasRow, index: number): AliasRow {
  const proposedEnum = String(row.proposedEnum || "").trim();
  const nameEn = String(row.nameEn || "").trim();
  if (!proposedEnum || !nameEn) throw new Error(`alias row ${index}`);
  if (!ALLOWED.has(proposedEnum)) throw new Error(`alias game ${proposedEnum}`);
  const nameJa = String(row.nameJa || "").trim();
  const nameZh = String(row.nameZh || "").trim();
  const also = (Array.isArray(row.also) ? row.also : []).map((part) => String(part || "").trim()).filter(Boolean);
  const blob = [nameEn, nameJa, nameZh, ...also].join(" ");
  if (/https?:\/\//i.test(blob)) throw new Error(`alias image url ${nameEn}`);
  return { proposedEnum, nameEn, nameJa, nameZh, also };
}

export function loadAliasRows(): AliasRow[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(FILE, "utf8")) as AliasFile;
  const rows = raw.aliases;
  if (!Array.isArray(rows) || !rows.length) throw new Error("ja aliases");
  cached = rows.map(clean);
  return cached;
}

function terms(row: AliasRow): string[] {
  return [row.nameJa, row.nameZh, ...row.also];
}

/** 4 = a full alias, 2 = a CJK prefix or substring. English nameEn is not an alias term. */
export function aliasStrength(row: AliasRow, query: string): 0 | 2 | 4 {
  const key = foldAlias(query);
  if (key.length < 2) return 0;
  const folded = terms(row).map(foldAlias).filter((term) => term.length >= 2);
  if (folded.some((term) => term === key)) return 4;
  if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(key)) return 0;
  if (folded.some((term) => term.startsWith(key) || term.includes(key))) return 2;
  return 0;
}

export function aliasHits(query: string): AliasRow[] {
  return loadAliasRows().filter((row) => aliasStrength(row, query) > 0);
}

/** Rank a catalog row against the alias file. Game narrows the hit when the card knows it. */
export function aliasRank(game: string | null | undefined, nameEn: string, query: string): 0 | 2 | 4 {
  const name = foldSearch(nameEn);
  if (!name) return 0;
  let best: 0 | 2 | 4 = 0;
  for (const row of loadAliasRows()) {
    if (game && row.proposedEnum !== game) continue;
    if (foldSearch(row.nameEn) !== name) continue;
    const strength = aliasStrength(row, query);
    if (strength > best) best = strength;
    if (best === 4) break;
  }
  return best;
}

/** Official Japanese title for a curated English name. Empty when this game has no row. */
export function officialNameJa(game: string, nameEn: string): string {
  const name = foldSearch(nameEn);
  const row = loadAliasRows().find((item) => item.proposedEnum === game && foldSearch(item.nameEn) === name);
  return row?.nameJa || "";
}
