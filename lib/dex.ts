import type { Prisma } from "@prisma/client";
import type { Locale } from "./i18n";
import { foldSearch } from "./search";

export type DexPrintRegion = "JP" | "WEST";

export const DEX_PLACEHOLDER = "/demo/back.svg";

/** Demo seed listings without a real collector number use `NNN/185`. */
const PLACEHOLDER_NUMBER = /\/185$/;

const STOP = new Set(["vmax", "vstar", "ex", "gx", "sr", "sar", "ar", "ur", "hr", "promo", "psa", "bgs", "cgc", "raw", "holo", "japanese", "english"]);

// ponytail: hand-kept zh/ja/en names. TCGdex returns one language per request. Upgrade path: a translation table if a card payload grows a second language.
const ALIASES: readonly (readonly string[])[] = [
  ["噴火龍", "リザードン", "charizard"],
  ["皮卡丘", "ピカチュウ", "pikachu"],
  ["可達鴨", "コダック", "psyduck"],
  ["超夢", "ミュウツー", "mewtwo"],
  ["耿鬼", "ゲンガー", "gengar"],
  ["月亮伊布", "ブラッキー", "umbreon"],
  ["洛奇亞", "ルギア", "lugia"],
  ["烈空坐", "レックウザ", "rayquaza"],
  ["伊布", "イーブイ", "eevee"],
];

const SET_GROUPS: readonly (readonly string[])[] = [
  ["仰天峰", "仰天のボルテッカー", "vivid voltage"],
  ["蒼空烈流", "蒼空ストリーム", "evolving skies"],
  ["傳說交鋒", "反逆クラッシュ", "rebel clash"],
  ["151", "ポケモンカード151"],
  ["neo genesis", "neo1"],
  ["base", "無印", "基本セット"],
];

export type DexSetCandidate = {
  id: string;
  total: number | null;
  releaseDate: string;
};

export type DexLinkCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  numberKey: string;
  printRegion: DexPrintRegion;
  releaseDate: string;
  setNameEn: string;
  setNameJa: string;
  setCode: string;
};

export type DexLinkListing = {
  id: string;
  title: string;
  cardName: string | null;
  setName: string | null;
  cardNumber: string | null;
  language: string | null;
};

export function numberKey(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.normalize("NFKC").match(/\d+/);
  if (!match) return "";
  return match[0].replace(/^0+(?=\d)/, "");
}

export function usableCollectorNumber(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.normalize("NFKC").trim();
  if (PLACEHOLDER_NUMBER.test(text)) return "";
  return numberKey(text);
}

export function normalizeReleaseDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.trim().match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function regionFromCode(code: string | null | undefined, fallback: DexPrintRegion): DexPrintRegion {
  const text = (code || "").toUpperCase();
  if (text === "JA" || text === "JP") return "JP";
  if (text === "EN" || text === "WEST") return "WEST";
  return fallback;
}

export function regionFromLanguage(language: string | null | undefined): DexPrintRegion | null {
  if (!language) return null;
  const text = language.normalize("NFKC").toLowerCase();
  if (text.includes("日") || text === "ja" || text === "jp" || text.includes("japan")) return "JP";
  if (text.includes("英") || text === "en" || text.includes("english") || text.includes("west")) return "WEST";
  return null;
}

export function parseRegion(value: string | undefined | null): DexPrintRegion | null {
  if (value === "JP" || value === "WEST") return value;
  return null;
}

function tokens(value: string): string[] {
  return foldSearch(value)
    .split(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/)
    .filter((token) => token.length >= 2);
}

export function nameKeys(value: string): Set<string> {
  const out = new Set<string>();
  for (const token of tokens(value)) {
    out.add(token);
    for (const group of ALIASES) {
      const terms = group.map((term) => foldSearch(term));
      if (!terms.includes(token)) continue;
      for (const term of terms) out.add(term);
    }
  }
  return out;
}

export function namesMatch(left: Set<string>, right: Set<string>): boolean {
  for (const key of left) {
    if (STOP.has(key)) continue;
    if (right.has(key)) return true;
  }
  return false;
}

function containsTerm(hay: string, term: string): boolean {
  if (!term) return false;
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(term)) return hay.includes(term);
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  const termWords = term.split(/[^a-z0-9]+/).filter(Boolean);
  if (!termWords.length) return false;
  for (let index = 0; index <= words.length - termWords.length; index += 1) {
    if (termWords.every((word, offset) => words[index + offset] === word)) return true;
  }
  return false;
}

export function setMatches(
  listingSet: string | null | undefined,
  set: { nameEn: string; nameJa: string; code: string },
): boolean {
  if (!listingSet?.trim()) return false;
  const query = foldSearch(listingSet.trim());
  if (query.length < 2) return false;
  const blob = foldSearch(`${set.nameEn} ${set.nameJa} ${set.code}`);
  if (containsTerm(blob, query) || foldSearch(set.code) === query) return true;
  for (const group of SET_GROUPS) {
    const terms = group.map((term) => foldSearch(term));
    if (!terms.some((term) => term === query || containsTerm(query, term))) continue;
    if (terms.some((term) => containsTerm(blob, term) || foldSearch(set.code) === term)) return true;
  }
  return false;
}

export function scoreLink(listing: DexLinkListing, card: DexLinkCard): number {
  const listingKeys = nameKeys(`${listing.cardName ?? ""} ${listing.title}`);
  const cardKeys = nameKeys(`${card.nameEn} ${card.nameJa}`);
  if (!namesMatch(listingKeys, cardKeys)) return 0;
  let score = 10;
  const num = usableCollectorNumber(listing.cardNumber);
  if (num && num === card.numberKey) score += 6;
  if (setMatches(listing.setName, { nameEn: card.setNameEn, nameJa: card.setNameJa, code: card.setCode })) score += 4;
  const region = regionFromLanguage(listing.language);
  if (region && region === card.printRegion) score += 2;
  return score;
}

function betterTie(next: DexLinkCard, current: DexLinkCard): boolean {
  if (next.releaseDate !== current.releaseDate) return next.releaseDate > current.releaseDate;
  const left = next.numberKey.padStart(6, "0");
  const right = current.numberKey.padStart(6, "0");
  if (left !== right) return left < right;
  return next.id < current.id;
}

export function pickCatalogCard<T extends DexLinkCard>(listing: DexLinkListing, cards: T[]): T | null {
  let best: { card: T; score: number } | null = null;
  for (const card of cards) {
    const score = scoreLink(listing, card);
    if (score < 10) continue;
    if (!best || score > best.score || (score === best.score && betterTie(card, best.card))) best = { card, score };
  }
  return best?.card ?? null;
}

/** Newest sets that fit the card budget. A trailing set may be partial when at least 40 cards remain. */
export function chooseDexSets(sets: DexSetCandidate[], want: number, budget: number): DexSetCandidate[] {
  const sorted = [...sets].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || "") || a.id.localeCompare(b.id));
  const picked: DexSetCandidate[] = [];
  let left = budget;
  for (const set of sorted) {
    if (picked.length >= want || left <= 0) break;
    const count = set.total && set.total > 0 ? set.total : 60;
    const take = Math.min(count, left);
    if (take < 40 && picked.length > 0) continue;
    if (take <= 0) break;
    picked.push(set);
    left -= take;
  }
  if (!picked.length && sorted[0]) picked.push(sorted[0]);
  return picked;
}

export function catalogNeedles(query: string): string[] {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const out = new Set<string>([q]);
  for (const token of tokens(q)) {
    for (const group of ALIASES) {
      const terms = group.map((term) => foldSearch(term));
      if (!terms.includes(token)) continue;
      for (const term of terms) out.add(term);
    }
  }
  return [...out].slice(0, 12);
}

export function catalogWhere(query: string, region: DexPrintRegion | null): Prisma.CatalogCardWhereInput {
  const q = query.trim().slice(0, 80);
  const regionFilter: Prisma.CatalogCardWhereInput = region ? { printRegion: region } : {};
  if (!q) return regionFilter;
  const or: Prisma.CatalogCardWhereInput[] = [];
  for (const needle of catalogNeedles(q)) {
    or.push({ nameEn: { contains: needle, mode: "insensitive" } });
    or.push({ nameJa: { contains: needle, mode: "insensitive" } });
  }
  or.push({ collectorNumber: { contains: q, mode: "insensitive" } });
  or.push({ set: { nameEn: { contains: q, mode: "insensitive" } } });
  or.push({ set: { nameJa: { contains: q, mode: "insensitive" } } });
  if (/[a-z]/i.test(q)) or.push({ set: { code: { contains: q, mode: "insensitive" } } });
  if (/[a-z]/i.test(q) && /\d/.test(q)) or.push({ externalId: { contains: q, mode: "insensitive" } });
  const key = numberKey(q);
  if (key) or.push({ numberKey: key });
  return { AND: [regionFilter, { OR: or }] };
}

function titleEn(value: string): string {
  return value.replace(/(^|[^a-z])([a-z])/g, (_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}

/** Fill the missing language from the alias list. Otherwise both fields keep the source name. */
export function bilingualName(raw: string, region: DexPrintRegion): { nameEn: string; nameJa: string } {
  const name = raw.trim();
  if (!name) return { nameEn: "", nameJa: "" };
  const folded = foldSearch(name);
  const parts = tokens(name);
  for (const group of ALIASES) {
    const terms = group.map((term) => foldSearch(term));
    const hit = terms.some((term) => folded === term || parts.includes(term) || (term.length >= 3 && (folded.startsWith(term) || folded.endsWith(term))));
    if (!hit) continue;
    const ja = group.find((term) => /[\u3040-\u30ff]/.test(term)) || name;
    const en = group.find((term) => /[a-z]/i.test(term) && !/[\u3040-\u9fff]/.test(term));
    return {
      nameEn: region === "WEST" ? name : titleEn(en || name),
      nameJa: region === "JP" ? name : ja,
    };
  }
  return { nameEn: name, nameJa: name };
}

export function primaryCardName(
  card: { nameEn: string; nameJa: string; printRegion: DexPrintRegion },
  locale: Locale,
): string {
  if (locale === "en") return card.nameEn || card.nameJa;
  return card.printRegion === "JP" ? card.nameJa || card.nameEn : card.nameEn || card.nameJa;
}

export function secondaryCardName(
  card: { nameEn: string; nameJa: string; printRegion: DexPrintRegion },
  locale: Locale,
): string {
  const primary = primaryCardName(card, locale);
  const other = foldSearch(primary) === foldSearch(card.nameJa) ? card.nameEn : card.nameJa;
  if (!other || foldSearch(other) === foldSearch(primary)) return "";
  return other;
}

export function setDisplayName(
  set: { nameEn: string; nameJa: string },
  region: DexPrintRegion,
  locale: Locale,
): string {
  if (locale === "en") return set.nameEn || set.nameJa;
  return region === "JP" ? set.nameJa || set.nameEn : set.nameEn || set.nameJa;
}

export function regionLabel(region: DexPrintRegion, locale: Locale): string {
  if (region === "JP") return locale === "en" ? "Japanese" : "日文";
  return locale === "en" ? "English" : "英文";
}
