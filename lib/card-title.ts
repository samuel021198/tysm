import lexicon from "./dex-lexicon.json";

const speciesByDex = lexicon.species as Record<string, string>;
const setNames = lexicon.sets as Record<string, string>;
const cardNames = lexicon.cards as Record<string, string>;

const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);

/** Printed mechanic tokens keep their marketplace spelling. */
const SUFFIX: Record<string, string> = {
  ex: "ex",
  gx: "GX",
  vmax: "VMAX",
  vstar: "VSTAR",
  v: "V",
  break: "BREAK",
  "v-union": "V-UNION",
};

const PREFIXES: readonly (readonly [string, string])[] = [
  ["かがやく", "Radiant"],
  ["アローラ", "Alolan"],
  ["パルデア", "Paldean"],
  ["ウォッシュ", "Wash"],
  ["フロスト", "Frost"],
  ["ガラル", "Galarian"],
  ["ヒスイ", "Hisuian"],
  ["ヒート", "Heat"],
  ["スピン", "Fan"],
  ["カット", "Mow"],
  ["メガ", "Mega"],
];

export type VariantFlags = {
  firstEdition?: boolean;
  holo?: boolean;
  normal?: boolean;
  reverse?: boolean;
  wPromo?: boolean;
};

export type CatalogTitleInput = {
  releaseDate?: string | null;
  setName?: string | null;
  collectorNumber?: string | null;
  numberKey?: string | null;
  cardName?: string | null;
  finish?: string | null;
};

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function plainPokemon(value: string): string {
  return value.replace(/pokémon/gi, (word) => (word[0] === "p" ? "pokemon" : "Pokemon"));
}

function titleWord(word: string, index: number, last: boolean): string {
  const lower = word.toLowerCase();
  if (SUFFIX[lower] && !(lower === "v" && index === 0)) return SUFFIX[lower];
  if (!last && index > 0 && SMALL.has(lower)) return lower;
  return word
    .split("-")
    .map((part) => {
      if (!part) return part;
      const lowerPart = part.toLowerCase();
      return lowerPart.charAt(0).toUpperCase() + lowerPart.slice(1);
    })
    .join("-");
}

/** Title Case shouting or lowercase phrases. Mixed-case official names stay as printed. */
export function titleCasePhrase(value: string): string {
  const clean = plainPokemon(value).replace(/\s+/g, " ").trim();
  const letters = clean.replace(/[^A-Za-z]/g, "");
  if (!letters || (letters !== letters.toUpperCase() && letters !== letters.toLowerCase())) return clean;
  const words = clean.split(" ");
  return words.map((word, index) => titleWord(word, index, index === words.length - 1)).join(" ");
}

export function releaseYear(value: string | null | undefined): string {
  const match = (value || "").match(/(\d{4})/);
  return match?.[1] || "";
}

/** Local id for `#88`. Numeric ids drop leading zeros. */
export function titleNumber(collectorNumber?: string | null, numberKey?: string | null): string {
  const local = (collectorNumber || "").split("/")[0]?.trim() || "";
  if (/^\d+$/.test(local)) return String(Number(local));
  if (local && local !== "—") return local;
  return (numberKey || "").trim();
}

/**
 * One finish suffix. Normal-only prints omit it.
 * Reverse is called out when the card is not already a holo; 1st edition and holo stack.
 */
export function finishLabel(variants: VariantFlags | null | undefined, rarity?: string | null): string | null {
  if (variants && (variants.normal || variants.holo || variants.reverse || variants.firstEdition || variants.wPromo)) {
    const bits: string[] = [];
    if (variants.firstEdition) bits.push("First Edition");
    if (variants.holo) bits.push("Holo");
    else if (variants.reverse) bits.push("Reverse Foil");
    if (variants.wPromo) bits.push("Promo");
    return bits.length ? bits.join(" ") : null;
  }
  const text = (rarity || "").toLowerCase();
  if (!text) return null;
  if (text.includes("promo")) return "Promo";
  if (text.includes("reverse")) return "Reverse Foil";
  if (text.includes("holo")) return "Holo";
  return null;
}

export function resolveEnglishSetName(raw: string, code: string): string {
  const hit = setNames[code] || setNames[code.toUpperCase()] || setNames[code.toLowerCase()];
  return (hit || raw).trim();
}

function splitSuffix(name: string): { body: string; suffix: string } {
  const match = name.match(/^(.*?)(?:\s+)?(V-UNION|VMAX|VSTAR|BREAK|GX|EX|ex|V)$/);
  if (!match?.[1]?.trim()) return { body: name, suffix: "" };
  const token = match[2];
  const suffix = token === "EX" ? "EX" : SUFFIX[token.toLowerCase()] || token;
  return { body: match[1].trim(), suffix };
}

function withSuffix(base: string, suffix: string): string {
  if (!suffix) return base;
  if (base.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) return base;
  return `${base} ${suffix}`;
}

function speciesName(dexIds: readonly number[]): string {
  const names = dexIds.map((id) => speciesByDex[String(id)]).filter((name): name is string => Boolean(name));
  return names.join(" & ");
}

/**
 * Japanese print → English card name.
 * Exact lexicon hit, then species (National Dex id) plus Mega / form prefix and ex/V/GX suffix.
 * ponytail: trainer cards absent from the lexicon stay in Japanese. Upgrade path: extend `cards` in dex-lexicon.json.
 */
export function resolveEnglishCardName(raw: string, dexIds: readonly number[] = []): string {
  const name = raw.normalize("NFKC").trim();
  if (!name) return "";
  if (!hasJapanese(name)) return titleCasePhrase(name);
  const exact = cardNames[name];
  if (exact) return exact;
  const { body, suffix } = splitSuffix(name);
  const exactBody = cardNames[body];
  if (exactBody) return withSuffix(exactBody, suffix);
  let rest = body;
  let prefix = "";
  for (const [jp, en] of PREFIXES) {
    if (!rest.startsWith(jp)) continue;
    prefix = en;
    rest = rest.slice(jp.length);
    break;
  }
  const species = speciesName(dexIds);
  const fromRest = cardNames[rest];
  const core = species || fromRest || "";
  if (!core) return name;
  const titled = prefix && !core.toLowerCase().startsWith(prefix.toLowerCase()) ? `${prefix} ${core}` : core;
  return withSuffix(titled, suffix);
}

export function dexIdsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);
}

export function variantFlagsOf(value: unknown): VariantFlags | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const known = ["normal", "holo", "reverse", "firstEdition", "wPromo"].some((key) => key in record);
  if (!known) return null;
  const on = (key: string) => record[key] === true;
  return {
    normal: on("normal"),
    holo: on("holo"),
    reverse: on("reverse"),
    firstEdition: on("firstEdition"),
    wPromo: on("wPromo"),
  };
}

/** `{year} Pokemon {Set Name} #{number} {Card Name} - {Finish}` */
export function catalogDisplayTitle(input: CatalogTitleInput): string {
  const year = releaseYear(input.releaseDate);
  const setName = titleCasePhrase(input.setName || "");
  const number = titleNumber(input.collectorNumber, input.numberKey);
  const cardName = titleCasePhrase(input.cardName || "");
  const finish = titleCasePhrase(input.finish || "");
  const parts = [year, year || setName || number || cardName ? "Pokemon" : "", setName, number ? `#${number}` : "", cardName].filter(Boolean);
  let title = parts.join(" ").replace(/\s+/g, " ").trim();
  if (finish) title = `${title} - ${finish}`;
  return title;
}

/** Listing titles are capped at 80. Shrink the set name before the card name and finish. */
export function listingTitleFromCatalog(input: CatalogTitleInput, max = 80): string {
  const full = catalogDisplayTitle(input);
  if (full.length <= max) return full;
  const year = releaseYear(input.releaseDate);
  const setName = titleCasePhrase(input.setName || "");
  const number = titleNumber(input.collectorNumber, input.numberKey);
  const cardName = titleCasePhrase(input.cardName || "");
  const finish = titleCasePhrase(input.finish || "");
  const tail = `${number ? `#${number} ` : ""}${cardName}${finish ? ` - ${finish}` : ""}`.trim();
  const head = `${year ? `${year} ` : ""}Pokemon `;
  const room = max - head.length - 1 - tail.length;
  if (room >= 4 && tail) {
    const cut = setName.length > room ? `${setName.slice(0, Math.max(1, room - 1)).trimEnd()}…` : setName;
    const built = `${head}${cut} ${tail}`.replace(/\s+/g, " ").trim();
    if (built.length <= max && built.length >= 2) return built;
  }
  return full.slice(0, max).trim();
}
