import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { dedupePrintings, type CatalogPrinting, type CatalogPrintingSet } from "./catalog-source";
import { parseCsv } from "./csv";
import { numberKey } from "./dex";

export type ToppsGame = "TOPPS_BASKETBALL" | "TOPPS_SOCCER";

export type ToppsCardRow = {
  n: string;
  name: string;
  team: string;
  subset: string;
  rc: boolean;
};

export type ToppsSetFile = {
  code: string;
  game: ToppsGame;
  nameEn: string;
  series: string | null;
  releaseDate: string | null;
  source: string;
  cards: ToppsCardRow[];
};

export type ToppsWalkItem = {
  externalId: string;
  lang: "en";
  kind: "topps";
  id: string;
  name: string;
  code: string;
  releaseDate: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "topps");

/** Color parallels are a matrix, not extra subjects. Named inserts such as Mojo stay. */
export function isParallelSubset(subset: string): boolean {
  const text = subset.trim();
  if (!text) return false;
  if (/\b(refract(?:or|ors)|x-fractors?|superfractors?|printing plates?)\b/i.test(text)) return true;
  if (/\bparallels?\b/i.test(text)) return true;
  return false;
}

export function subsetSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "card";
}

/** Base is the default, so it stays off the title. Named inserts and RC stay. */
export function toppsRarity(subset: string, rc: boolean): string | null {
  const named = /^base$/i.test(subset.trim()) ? "" : subset.trim();
  if (rc && named) return `${named} RC`;
  if (rc) return "RC";
  return named || null;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/** `73TA-AI Allen Iverson - Philadelphia 76ers RC` → number, player, team, rc. */
export function parseChecklistLine(line: string): Omit<ToppsCardRow, "subset"> | null {
  const clean = line
    .replace(/\s+/g, " ")
    .replace(/\s*\(eBay\)\s*/gi, " ")
    .trim();
  const match = clean.match(/^([A-Za-z0-9][A-Za-z0-9./-]{0,24})\s+(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  const cut = match[2].lastIndexOf(" - ");
  if (cut <= 0) return null;
  let name = match[2].slice(0, cut).trim();
  let team = match[2].slice(cut + 3).trim();
  if (!name || !team || /^(cards?|odds|hobby)\b/i.test(name)) return null;
  let rc = false;
  const stripRc = (value: string) => {
    const next = value.replace(/\s*\(RC\)\s*$/i, "").replace(/\s+RC$/i, "").trim();
    if (next !== value) rc = true;
    return next;
  };
  name = stripRc(name);
  team = stripRc(team);
  if (name.length < 2 || team.length < 2) return null;
  return { n: match[1], name, team, rc };
}

/**
 * Checklist Insider sections. Team-set blocks repeat the base list, so they are skipped.
 * Parallel names live in a prose line, not as one row per color.
 */
export function parseChecklistHtml(html: string): ToppsCardRow[] {
  const source = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const sections = source.split(/<h2\b[^>]*>/i).slice(1);
  const rows: ToppsCardRow[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const end = section.search(/<\/h2>/i);
    if (end < 0) continue;
    const heading = decodeHtml(section.slice(0, end)).replace(/\s+/g, " ").trim();
    if (!/checklist/i.test(heading) || /team set|download|related/i.test(heading)) continue;
    const chunks = section.slice(end).split(/<h3\b[^>]*>/i).slice(1);
    for (const chunk of chunks) {
      const h3end = chunk.search(/<\/h3>/i);
      if (h3end < 0) continue;
      const h3 = decodeHtml(chunk.slice(0, h3end)).replace(/\s+/g, " ").trim();
      if (!/checklist$/i.test(h3) || /team set/i.test(h3)) continue;
      const subset = h3.replace(/\s+checklist$/i, "").trim();
      if (!subset || isParallelSubset(subset)) continue;
      const lines = chunk
        .slice(h3end)
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      for (const line of lines.split("\n")) {
        const card = parseChecklistLine(decodeHtml(line));
        if (!card) continue;
        const key = `${subset}\0${card.n}\0${card.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ ...card, subset });
      }
    }
  }
  return rows;
}

/** basketball.cards CSV: number, player, team, subset, rc. ebay_url is ignored. */
export function parseBasketballCsv(text: string): ToppsCardRow[] {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!table.length) return [];
  const header = table[0]!.map((cell) => cell.replace(/^\uFEFF/, "").trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const number = at("number");
  const player = at("player");
  const team = at("team");
  const subset = at("subset");
  const rc = at("rc");
  if (number < 0 || player < 0) return [];
  const out: ToppsCardRow[] = [];
  for (const cells of table.slice(1)) {
    const n = (cells[number] || "").trim();
    const name = (cells[player] || "").trim();
    const subsetName = ((subset >= 0 ? cells[subset] : "") || "").trim() || "Base";
    if (!n || !name || isParallelSubset(subsetName)) continue;
    const flag = (rc >= 0 ? cells[rc] : "") || "";
    out.push({
      n,
      name,
      team: ((team >= 0 ? cells[team] : "") || "").trim(),
      subset: subsetName,
      rc: /^\s*(rc|yes|1)\s*$/i.test(flag),
    });
  }
  return out;
}

export function mapToppsCard(setCode: string, row: ToppsCardRow, dupIndex = 0): CatalogPrinting {
  const subset = row.subset.trim() || "Base";
  const num = row.n.trim();
  const suffix = dupIndex > 0 ? `:${dupIndex + 1}` : "";
  const name = row.name.trim();
  return {
    externalId: `tb:${setCode}:${subsetSlug(subset)}:${num}${suffix}`,
    collectorNumber: num || "—",
    numberKey: numberKey(num),
    nameEn: name,
    nameJa: name,
    sourceImageUrl: "",
    rarity: toppsRarity(subset, row.rc),
    artist: null,
    finish: row.team.trim() || null,
  };
}

export function mapToppsCards(setCode: string, rows: readonly ToppsCardRow[]): CatalogPrinting[] {
  const seen = new Map<string, number>();
  const out: CatalogPrinting[] = [];
  for (const row of rows) {
    if (!row.n.trim() || !row.name.trim() || isParallelSubset(row.subset)) continue;
    const first = mapToppsCard(setCode, row, 0);
    const count = seen.get(first.externalId) ?? 0;
    seen.set(first.externalId, count + 1);
    out.push(count === 0 ? first : mapToppsCard(setCode, row, count));
  }
  return dedupePrintings(out);
}

export function mapToppsSet(file: ToppsSetFile): CatalogPrintingSet {
  return {
    externalId: `tb:${file.code}`,
    printRegion: "WEST",
    code: file.code,
    nameEn: file.nameEn.trim(),
    nameJa: file.nameEn.trim(),
    series: file.series,
    releaseDate: file.releaseDate,
    cards: mapToppsCards(file.code, file.cards),
  };
}

function asSetFile(value: unknown, fileName: string): ToppsSetFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`topps set ${fileName} is not an object`);
  const row = value as Partial<ToppsSetFile>;
  if (row.game !== "TOPPS_BASKETBALL" && row.game !== "TOPPS_SOCCER") throw new Error(`topps set ${fileName} game`);
  if (!row.code || !/^[A-Za-z0-9._-]+$/.test(row.code)) throw new Error(`topps set ${fileName} code`);
  if (!row.nameEn?.trim() || !Array.isArray(row.cards)) throw new Error(`topps set ${fileName} shape`);
  return {
    code: row.code,
    game: row.game,
    nameEn: row.nameEn.trim(),
    series: row.series?.trim() || null,
    releaseDate: row.releaseDate?.trim() || null,
    source: row.source?.trim() || "",
    cards: row.cards,
  };
}

let fileCache: ToppsSetFile[] | null = null;

export function loadToppsFiles(): ToppsSetFile[] {
  if (fileCache) return fileCache;
  const names = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  fileCache = names.map((name) => asSetFile(JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8")), name));
  return fileCache;
}

export function clearToppsFileCache() {
  fileCache = null;
}

export function toppsPrintingSet(code: string): CatalogPrintingSet | null {
  const file = loadToppsFiles().find((row) => row.code === code);
  return file ? mapToppsSet(file) : null;
}

/** Newest release first. Cursor ids are `en:{code}` so they share the dex ingest cursor. */
export function toppsQueue(game: ToppsGame): ToppsWalkItem[] {
  return loadToppsFiles()
    .filter((file) => file.game === game)
    .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || "") || a.code.localeCompare(b.code))
    .map((file) => ({
      externalId: `en:${file.code}`,
      lang: "en" as const,
      kind: "topps" as const,
      id: file.code,
      name: file.nameEn,
      code: file.code,
      releaseDate: file.releaseDate || "",
    }));
}
