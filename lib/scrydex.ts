import {
  DEX_PLACEHOLDER,
  normalizeReleaseDate,
  numberKey,
  regionFromCode,
  type DexPrintRegion,
} from "./dex";
import { foldSearch } from "./search";

const ORIGIN = "https://api.scrydex.com";

export type MappedSet = {
  externalId: string;
  printRegion: DexPrintRegion;
  code: string;
  nameEn: string;
  nameJa: string;
  series: string | null;
  releaseDate: string;
  total: number | null;
  logoUrl: string | null;
  onlineOnly: boolean;
};

export type MappedCard = {
  externalId: string;
  setExternalId: string;
  printRegion: DexPrintRegion;
  collectorNumber: string;
  numberKey: string;
  nameEn: string;
  nameJa: string;
  sourceImageUrl: string;
  rarity: string | null;
  artist: string | null;
};

export function scrydexConfigured(): boolean {
  return Boolean(process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim());
}

export function httpsUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
  } catch {
    /* ignore */
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === "string" ? value.trim() : "";
}

function translationName(obj: Record<string, unknown>, lang: "en" | "ja"): string {
  const translation = asRecord(obj.translation);
  const bucket = translation ? asRecord(translation[lang]) : null;
  return bucket ? str(bucket, "name") : "";
}

function frontImage(obj: Record<string, unknown>): string {
  const images = Array.isArray(obj.images) ? obj.images : [];
  const rows = images.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const front = rows.find((row) => str(row, "type").toLowerCase() === "front") || rows[0];
  if (!front) return "";
  return httpsUrl(str(front, "large") || str(front, "medium") || str(front, "small"));
}

export function parseScrydexPage(body: unknown): { data: unknown[]; pageSize: number; totalCount: number } {
  const record = asRecord(body);
  if (!record || !Array.isArray(record.data)) throw new Error("scrydex unexpected body");
  const pageSize = Number(record.pageSize ?? record.page_size ?? record.data.length) || record.data.length;
  const totalCount = Number(record.totalCount ?? record.total_count ?? record.data.length) || 0;
  return { data: record.data, pageSize, totalCount };
}

export function mapScrydexExpansion(raw: unknown, fallback: DexPrintRegion): MappedSet | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const externalId = str(obj, "id");
  if (!externalId) return null;
  const region = regionFromCode(str(obj, "language_code"), fallback);
  const localName = str(obj, "name") || externalId;
  const en = translationName(obj, "en");
  const ja = translationName(obj, "ja");
  const total = typeof obj.total === "number" && Number.isFinite(obj.total) ? obj.total : null;
  return {
    externalId,
    printRegion: region,
    code: str(obj, "code") || externalId,
    nameEn: region === "WEST" ? localName : en || localName,
    nameJa: region === "JP" ? localName : ja || localName,
    series: str(obj, "series") || null,
    releaseDate: normalizeReleaseDate(str(obj, "release_date")),
    total,
    logoUrl: httpsUrl(str(obj, "logo")) || null,
    onlineOnly: obj.is_online_only === true,
  };
}

export function mapScrydexCard(raw: unknown, fallbackRegion: DexPrintRegion, fallbackSetId: string): MappedCard | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const externalId = str(obj, "id");
  if (!externalId) return null;
  const expansion = asRecord(obj.expansion);
  const region = regionFromCode(str(obj, "language_code") || (expansion ? str(expansion, "language_code") : ""), fallbackRegion);
  const local = str(obj, "name");
  const en = translationName(obj, "en");
  const ja = translationName(obj, "ja");
  const nameEn = (region === "JP" ? en || local : local || en) || externalId;
  const nameJa = (region === "JP" ? local || ja || en : ja || local || en) || nameEn;
  const printed = str(obj, "printed_number");
  const number = str(obj, "number");
  return {
    externalId,
    setExternalId: (expansion && str(expansion, "id")) || fallbackSetId,
    printRegion: region,
    collectorNumber: printed || number || "—",
    numberKey: numberKey(number || printed),
    nameEn,
    nameJa,
    sourceImageUrl: frontImage(obj),
    rarity: str(obj, "rarity") || null,
    artist: str(obj, "artist") || null,
  };
}

/** Copy a real Japanese or English name onto rows that only have one language. */
export function fillMissingNames(cards: MappedCard[]): MappedCard[] {
  const enToJa = new Map<string, string>();
  const jaToEn = new Map<string, string>();
  for (const card of cards) {
    const en = foldSearch(card.nameEn);
    const ja = card.nameJa.trim();
    if (!en || !ja || foldSearch(ja) === en) continue;
    if (!enToJa.has(en)) enToJa.set(en, ja);
    const jaKey = foldSearch(ja);
    if (!jaToEn.has(jaKey)) jaToEn.set(jaKey, card.nameEn.trim());
  }
  return cards.map((card) => {
    let nameEn = card.nameEn.trim();
    let nameJa = card.nameJa.trim();
    if (nameJa && foldSearch(nameEn) === foldSearch(nameJa)) {
      nameEn = jaToEn.get(foldSearch(nameJa)) || nameEn;
    }
    if (!nameJa || foldSearch(nameJa) === foldSearch(nameEn)) {
      nameJa = enToJa.get(foldSearch(nameEn)) || nameJa || nameEn;
    }
    if (!nameEn) nameEn = nameJa || card.externalId;
    if (!nameJa) nameJa = nameEn;
    return { ...card, nameEn, nameJa };
  });
}

export function displayImage(sourceImageUrl: string): string {
  return sourceImageUrl || DEX_PLACEHOLDER;
}

async function scrydexGet(path: string, params: Record<string, string>, attempt = 0): Promise<unknown> {
  const key = process.env.SCRYDEX_API_KEY?.trim();
  const team = process.env.SCRYDEX_TEAM_ID?.trim();
  if (!key || !team) throw new Error("SCRYDEX_API_KEY and SCRYDEX_TEAM_ID are required");
  const url = new URL(path.startsWith("http") ? path : `${ORIGIN}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const res = await fetch(url, {
    headers: { "X-Api-Key": key, "X-Team-ID": team, accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 429 && attempt === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return scrydexGet(path, params, 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`scrydex ${res.status} ${text.slice(0, 180).replace(/[\r\n]+/g, " ")}`);
  }
  return res.json();
}

async function scrydexPage(path: string, params: Record<string, string>) {
  try {
    return parseScrydexPage(await scrydexGet(path, params));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!params.orderBy || !message.includes("scrydex 400")) throw error;
    const { orderBy: _drop, ...rest } = params;
    return parseScrydexPage(await scrydexGet(path, rest));
  }
}

function newestFirst(sets: MappedSet[]): boolean {
  if (sets.length < 2) return false;
  return (sets[0]?.releaseDate || "") > (sets[sets.length - 1]?.releaseDate || "");
}

export async function listExpansions(lang: "en" | "ja"): Promise<MappedSet[]> {
  const region: DexPrintRegion = lang === "ja" ? "JP" : "WEST";
  const out: MappedSet[] = [];
  let total = Infinity;
  for (let page = 1; page <= 8 && out.length < total; page += 1) {
    const parsed = await scrydexPage(`/pokemon/v1/${lang}/expansions`, {
      page: String(page),
      page_size: "100",
      orderBy: "-release_date",
    });
    const batch = parsed.data.map((row) => mapScrydexExpansion(row, region)).filter((row): row is MappedSet => Boolean(row));
    out.push(...batch);
    total = parsed.totalCount || out.length;
    if (!batch.length || batch.length < parsed.pageSize) break;
    const physicalOnPage = batch.filter((set) => !set.onlineOnly).length;
    if (page === 1 && newestFirst(batch) && physicalOnPage >= 8) break;
  }
  return out;
}

export async function listExpansionCards(lang: "en" | "ja", expansionId: string, limit: number): Promise<unknown[]> {
  const id = encodeURIComponent(expansionId);
  const scoped = `/pokemon/v1/${lang}/expansions/${id}/cards`;
  const plain = `/pokemon/v1/expansions/${id}/cards`;
  let path = scoped;
  const rows: unknown[] = [];
  for (let page = 1; page <= 10 && rows.length < limit; page += 1) {
    let parsed;
    try {
      parsed = await scrydexPage(path, { page: String(page), page_size: "100", orderBy: "number" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (page === 1 && path === scoped && message.includes("scrydex 404")) {
        path = plain;
        parsed = await scrydexPage(path, { page: String(page), page_size: "100", orderBy: "number" });
      } else throw error;
    }
    if (!parsed.data.length) break;
    rows.push(...parsed.data);
    if (parsed.data.length < parsed.pageSize) break;
  }
  return rows.slice(0, limit);
}
