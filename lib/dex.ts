import type { Prisma } from "@prisma/client";
import type { Locale } from "./i18n";
import { foldSearch } from "./search";

export type DexPrintRegion = "JP" | "WEST";

export type DexGame =
  | "POKEMON"
  | "ONE_PIECE"
  | "RIFTBOUND"
  | "DEMO"
  | "TOPPS_BASKETBALL"
  | "TOPPS_SOCCER"
  | "YUGIOH"
  | "DIGIMON"
  | "WEISS_SCHWARZ"
  | "LORCANA"
  | "MTG"
  | "FLESH_AND_BLOOD"
  | "BANDAI_GUNDAM"
  | "DRAGON_BALL";

const PARSE_GAME: Record<string, DexGame> = {
  pokemon: "POKEMON",
  "pokémon": "POKEMON",
  "one-piece": "ONE_PIECE",
  onepiece: "ONE_PIECE",
  op: "ONE_PIECE",
  riftbound: "RIFTBOUND",
  rift: "RIFTBOUND",
  demo: "DEMO",
  "topps-basketball": "TOPPS_BASKETBALL",
  "topps-basket": "TOPPS_BASKETBALL",
  "topps-soccer": "TOPPS_SOCCER",
  "topps-football": "TOPPS_SOCCER",
  yugioh: "YUGIOH",
  "yu-gi-oh": "YUGIOH",
  ygo: "YUGIOH",
  digimon: "DIGIMON",
  "weiss-schwarz": "WEISS_SCHWARZ",
  weiss: "WEISS_SCHWARZ",
  ws: "WEISS_SCHWARZ",
  lorcana: "LORCANA",
  mtg: "MTG",
  magic: "MTG",
  "flesh-and-blood": "FLESH_AND_BLOOD",
  fab: "FLESH_AND_BLOOD",
  gundam: "BANDAI_GUNDAM",
  "bandai-gundam": "BANDAI_GUNDAM",
  "dragon-ball": "DRAGON_BALL",
  dragonball: "DRAGON_BALL",
  dbs: "DRAGON_BALL",
};

const GAME_PARAM: Record<DexGame, string> = {
  POKEMON: "pokemon",
  ONE_PIECE: "one-piece",
  RIFTBOUND: "riftbound",
  DEMO: "demo",
  TOPPS_BASKETBALL: "topps-basketball",
  TOPPS_SOCCER: "topps-soccer",
  YUGIOH: "yugioh",
  DIGIMON: "digimon",
  WEISS_SCHWARZ: "weiss-schwarz",
  LORCANA: "lorcana",
  MTG: "mtg",
  FLESH_AND_BLOOD: "flesh-and-blood",
  BANDAI_GUNDAM: "gundam",
  DRAGON_BALL: "dragon-ball",
};

export function parseGame(value: string | null | undefined): DexGame | null {
  const text = (value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  return PARSE_GAME[text] ?? null;
}

export function gameParam(game: DexGame): string {
  return GAME_PARAM[game];
}

/** Sell-form / listing category slug for a dex game. */
export function categorySlugForGame(game: DexGame): string {
  return gameParam(game);
}

/** Buyer-facing dex URL. Empty ids are omitted so the UI does not invent a card. */
export function dexPath(id: string | null | undefined): string | null {
  const clean = id?.trim();
  return clean ? `/dex/${clean}` : null;
}

/** Listing-level link, then each card row. The same catalog id is only offered once. */
export function listingDexLinks(input: {
  catalogCardId?: string | null;
  cardName?: string | null;
  items?: { catalogCardId?: string | null; catalogTitle?: string | null; cardName?: string | null }[];
}): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined, label: string | null | undefined) => {
    const clean = id?.trim() || "";
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({ id: clean, label: (label || "").trim() });
  };
  add(input.catalogCardId, input.cardName);
  for (const item of input.items ?? []) add(item.catalogCardId, item.catalogTitle || item.cardName);
  return out;
}

export function gameHasRegion(game: DexGame): boolean {
  return game === "POKEMON" || game === "ONE_PIECE";
}

export const DEX_PLACEHOLDER = "/demo/back.svg";

/** Demo seed listings without a real collector number use `NNN/185`. */
const PLACEHOLDER_NUMBER = /\/185$/;

const STOP = new Set(["vmax", "vstar", "ex", "gx", "sr", "sar", "ar", "ur", "hr", "promo", "psa", "bgs", "cgc", "raw", "holo", "japanese", "english"]);

// ponytail: hand-kept zh/ja/en aliases for search. English dex titles use lib/card-title.ts.
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
  ["路飛", "ルフィ", "luffy"],
  ["索隆", "ゾロ", "zoro"],
  ["娜美", "ナミ", "nami"],
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
  // Stored JP set names keep the accent ("Pokémon Card 151"). ILIKE does not fold it; fieldHas does.
  if (foldSearch(q) === "pokemon") {
    out.add("Pokemon");
    out.add("Pokémon");
  }
  for (const token of tokens(q)) {
    for (const group of ALIASES) {
      const terms = group.map((term) => foldSearch(term));
      if (!terms.includes(token)) continue;
      for (const term of terms) out.add(term);
    }
  }
  return [...out].slice(0, 12);
}

/** Words that appear in every generated title and should not be required on their own. */
const TITLE_STOP = new Set(["pokemon", "card", "cards", "tcg", "one", "piece", "riftbound", "topps", "basketball", "soccer"]);

/** Rarity / finish words. On a pasted title they must not wipe a name or set hit. */
const SOFT_TOKEN = new Set([
  "holo",
  "foil",
  "reverse",
  "rare",
  "super",
  "double",
  "ultra",
  "illustration",
  "special",
  "hyper",
  "mega",
  "common",
  "uncommon",
  "shiny",
  "radiant",
  "promo",
  "first",
  "edition",
]);

export type CatalogSearchCard = {
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  numberKey: string;
  printRegion: DexPrintRegion;
  rarity?: string | null;
  finish?: string | null;
  setNameEn: string;
  setNameJa: string;
  setCode: string;
  series?: string | null;
  releaseDate?: string | null;
};

/** Tokens of an old-style or new-style title. `Pokemon` / `Card` drop out when anything else is left. Hyphenated codes stay whole (`OP-01`, `OP01-001`). */
export function catalogQueryTokens(query: string): string[] {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const raw = q.match(/[0-9A-Za-z\u3040-\u30ff\u3400-\u9fff]+(?:[.-][0-9A-Za-z\u3040-\u30ff\u3400-\u9fff]+)*/g) || [];
  const usable = raw.filter((token) => token.length >= 2 || /^\d$/.test(token) || /[\u3040-\u30ff\u3400-\u9fff]/.test(token));
  const kept = usable.filter((token) => !TITLE_STOP.has(foldSearch(token)));
  return (kept.length ? kept : usable).slice(0, 12);
}

/** `OP-01` / `OP01` name a set. A longer code (`OP01-001`, `FIN-1`) names a printing. */
function setCodeToken(token: string): boolean {
  return /^[A-Za-z]{1,8}-?\d{2}$/.test(token);
}

function printedCodeToken(token: string): boolean {
  return /[A-Za-z]/.test(token) && /\d/.test(token) && token.includes("-") && !setCodeToken(token);
}

function codeForms(token: string): string[] {
  const stripped = token.replace(/-/g, "");
  const forms = new Set([token, stripped]);
  const hyphenated = stripped.match(/^([A-Za-z]{1,8})(\d{2})$/);
  if (hyphenated) forms.add(`${hyphenated[1]}-${hyphenated[2]}`);
  return [...forms];
}

function sameCode(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  return foldSearch(left).replace(/-/g, "") === foldSearch(right).replace(/-/g, "");
}

/** Digits in `Pokemon Card 151` name the set. A bare `151` or `#151` stays a collector number. */
function setPhraseKeys(query: string): Set<string> {
  const keys = new Set<string>();
  for (const match of foldSearch(query).matchAll(/pokemon cards?\s+(\d+)/g)) keys.add(String(Number(match[1])));
  return keys;
}

function softToken(token: string): boolean {
  if (tokenRegion(token)) return true;
  if (/^(19|20)\d{2}$/.test(token)) return true;
  return SOFT_TOKEN.has(foldSearch(token));
}

/** Pasted listing titles carry a year, set code, `#number`, or a long token list. */
function queryHasTitleShape(query: string, tokens: string[]): boolean {
  if (tokens.length >= 4) return true;
  if (/#\s*\d/.test(query)) return true;
  if (tokens.some((token) => /^(19|20)\d{2}$/.test(token))) return true;
  return tokens.some((token) => /[a-z]/i.test(token) && /\d/.test(token));
}

/** Tokens a suggestion lookup must hit. Title noise (year, JP/EN, rarity, finish) stays optional. */
function strongTokens(query: string): string[] {
  const tokens = catalogQueryTokens(query);
  if (!queryHasTitleShape(query, tokens)) return tokens;
  const strong = tokens.filter((token) => !softToken(token));
  return strong.length ? strong : tokens;
}

function tokenRegion(token: string): DexPrintRegion | null {
  const folded = foldSearch(token);
  if (folded === "jp" || folded === "ja" || folded === "japanese" || token === "日文") return "JP";
  if (folded === "en" || folded === "english" || folded === "west" || token === "英文") return "WEST";
  return null;
}

function fieldHas(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false;
  return foldSearch(hay).includes(foldSearch(needle));
}

function tokenHitsCard(card: CatalogSearchCard, token: string, setKeys: ReadonlySet<string>): boolean {
  const region = tokenRegion(token);
  if (region) return card.printRegion === region;
  if (setCodeToken(token)) return codeForms(token).some((form) => sameCode(card.setCode, form));
  if (printedCodeToken(token)) {
    return codeForms(token).some((form) => sameCode(card.setCode, form) || sameCode(card.collectorNumber, form));
  }
  if (/^(19|20)\d{2}$/.test(token)) {
    return (card.releaseDate || "").startsWith(token) || card.numberKey === token || fieldHas(card.collectorNumber, token);
  }
  if (/^\d+$/.test(token)) {
    const key = String(Number(token));
    const onSet = fieldHas(card.setNameEn, token) || fieldHas(card.setNameJa, token) || fieldHas(card.setCode, token);
    if (setKeys.has(key)) return onSet;
    return card.numberKey === key || fieldHas(card.collectorNumber, token) || onSet;
  }
  const fields = [card.nameEn, card.nameJa, card.setNameEn, card.setNameJa, card.series || "", card.setCode, card.rarity || "", card.finish || ""];
  return catalogNeedles(token).some((needle) => fields.some((field) => fieldHas(field, needle)));
}

function tokensMatch(card: CatalogSearchCard, query: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const setKeys = setPhraseKeys(query);
  return tokens.every((token) => tokenHitsCard(card, token, setKeys));
}

/** True when every meaningful token hits a stored field. Display title text is not required. */
export function catalogCardMatches(card: CatalogSearchCard, query: string): boolean {
  return tokensMatch(card, query, catalogQueryTokens(query));
}

/** Name / set / number still match when a pasted title's year, language, or rarity does not. */
export function catalogAnchorMatches(card: CatalogSearchCard, query: string): boolean {
  return tokensMatch(card, query, strongTokens(query));
}

function contains(needle: string): Prisma.StringFilter {
  return { contains: needle, mode: "insensitive" };
}

function codeEquals(form: string): Prisma.StringFilter {
  return { equals: form, mode: "insensitive" };
}

function tokenWhere(token: string, setKeys: ReadonlySet<string>): Prisma.CatalogCardWhereInput {
  const region = tokenRegion(token);
  if (region) return { printRegion: region };
  if (setCodeToken(token)) {
    return { OR: codeForms(token).map((form) => ({ set: { code: codeEquals(form) } })) };
  }
  if (printedCodeToken(token)) {
    const or: Prisma.CatalogCardWhereInput[] = [];
    for (const form of codeForms(token)) {
      or.push({ set: { code: codeEquals(form) } }, { collectorNumber: codeEquals(form) });
    }
    return { OR: or };
  }
  if (/^(19|20)\d{2}$/.test(token)) {
    return {
      OR: [{ set: { releaseDate: { startsWith: token } } }, { numberKey: token }, { collectorNumber: contains(token) }],
    };
  }
  if (/^\d+$/.test(token)) {
    const key = String(Number(token));
    const onSet: Prisma.CatalogCardWhereInput[] = [
      { set: { nameEn: contains(token) } },
      { set: { nameJa: contains(token) } },
      { set: { code: contains(token) } },
    ];
    if (setKeys.has(key)) return { OR: onSet };
    return {
      OR: [{ numberKey: key }, { collectorNumber: contains(token) }, ...onSet],
    };
  }
  const or: Prisma.CatalogCardWhereInput[] = [];
  for (const needle of catalogNeedles(token)) {
    const has = contains(needle);
    or.push({ nameEn: has }, { nameJa: has }, { rarity: has }, { finish: has });
    or.push({ set: { nameEn: has } }, { set: { nameJa: has } }, { set: { series: has } }, { set: { code: has } });
    if (/[a-z]/i.test(needle) && /\d/.test(needle)) or.push({ externalId: has });
  }
  return { OR: or };
}

function whereForTokens(tokens: string[], setKeys: ReadonlySet<string>, region: DexPrintRegion | null): Prisma.CatalogCardWhereInput {
  const parts: Prisma.CatalogCardWhereInput[] = [];
  if (region) parts.push({ printRegion: region });
  if (!tokens.length) return parts[0] || {};
  parts.push(...tokens.map((token) => tokenWhere(token, setKeys)));
  return parts.length === 1 ? parts[0]! : { AND: parts };
}

export function catalogWhere(query: string, region: DexPrintRegion | null, game?: DexGame | null): Prisma.CatalogCardWhereInput {
  const where = whereForTokens(catalogQueryTokens(query), setPhraseKeys(query), region);
  if (!game) return where;
  if (!Object.keys(where).length) return { game };
  return { AND: [where, { game }] };
}

/** Suggestion fetch. A pasted title still returns the card when rarity or the year is off. */
export function catalogSuggestWhere(query: string, region: DexPrintRegion | null = null): Prisma.CatalogCardWhereInput {
  return whereForTokens(strongTokens(query), setPhraseKeys(query), region);
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

/** Drop tags left in a set label. Settled ingest rows are not rewritten. */
export function plainCatalogLabel(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function setDisplayName(
  set: { nameEn: string; nameJa: string },
  region: DexPrintRegion,
  locale: Locale,
): string {
  const nameEn = plainCatalogLabel(set.nameEn);
  const nameJa = plainCatalogLabel(set.nameJa);
  if (locale === "en") return nameEn || nameJa;
  return region === "JP" ? nameJa || nameEn : nameEn || nameJa;
}

export function regionLabel(region: DexPrintRegion, locale: Locale): string {
  if (region === "JP") return locale === "en" ? "Japanese" : "日文";
  return locale === "en" ? "English" : "英文";
}

/** Leave this much soft-deadline budget so ingest can return JSON after post-steps. */
export const INGEST_POST_RESERVE_MS = 15_000;

/** Clock only. The first set of a call pauses too; written cards are not required. */
export function ingestPastSoftDeadline(now: number, deadline: number, reserveMs: number): boolean {
  return now > deadline - reserveMs;
}

/** Absolute time post-steps must stop. Null means do not start them (mid-walk, or reserve already gone). */
export function ingestPostDeadline(done: boolean, now: number, deadline: number, reserveMs = INGEST_POST_RESERVE_MS): number | null {
  if (!done) return null;
  const until = deadline - reserveMs;
  return now < until ? until : null;
}

/**
 * English-name backfill and catalog linking run only after the set walk finishes,
 * and only when `reserveMs` is still left before the soft deadline.
 * Linking is not started if backfill uses up that reserve.
 */
export async function runIngestPostSteps(args: {
  done: boolean;
  deadline: number;
  reserveMs?: number;
  now?: () => number;
  link: (deadlineMs: number) => Promise<{ listings: number; collectionItems: number }>;
  backfill: (deadlineMs: number) => Promise<void>;
}): Promise<{ listings: number; collectionItems: number }> {
  const now = args.now ?? Date.now;
  const until = ingestPostDeadline(args.done, now(), args.deadline, args.reserveMs);
  if (until == null) return { listings: 0, collectionItems: 0 };
  await args.backfill(until);
  if (ingestPostDeadline(args.done, now(), args.deadline, args.reserveMs) == null) {
    return { listings: 0, collectionItems: 0 };
  }
  return args.link(until);
}
