import type { Locale } from "./i18n";

/**
 * SNKRDUNK public JSON used by their own sales-history page (no key).
 * Search:  GET https://snkrdunk.com/en/v1/search?keyword&perPage&page
 * Chart:   GET https://snkrdunk.com/v1/apparels/{id}/sales-chart/used?salesChartOptionId&range=all
 * History: GET https://snkrdunk.com/v1/apparels/{id}/sales-history?page&per_page&condition_id
 *
 * Prices are whole JPY. Chart points are the site's series (one point per day when a card trades often).
 * History dates are relative Japanese strings ("1時間前") or YYYY/MM/DD, not instants.
 * Condition ids default to A=18 and PSA10=22 and are corrected from `salesChartOption` when the names differ.
 *
 * Matching gaps: English TCGdex set codes (sv03.5, base1) usually are not SNKRDUNK's codes (MEW, or a bare
 * [4/102][EN]). Mirror / Master Ball printings that share a number tie and are left unmatched. One Piece and
 * Riftbound are not queried. Sealed boxes fail the collector-number parse and do not match.
 */

const SEARCH = "https://snkrdunk.com/en/v1/search";
const ORIGIN = "https://snkrdunk.com";
const UA = "TYSM/1.0 (market; +https://github.com/samuel021198/tysm)";

const TTL_OK = 30 * 60 * 1000;
const TTL_DOWN = 2 * 60 * 1000;
const PACE_MS = 250;

export type SnkrCardRef = {
  game: string;
  printRegion: "JP" | "WEST";
  setCode: string;
  setNameEn: string;
  setNameJa: string;
  collectorNumber: string;
  numberKey: string;
  nameEn: string;
  nameJa: string;
  rarity?: string | null;
  finish?: string | null;
};

export type SnkrSearchHit = {
  id: number;
  name: string;
  localizedName: string;
  isTradingCard?: boolean;
};

export type SnkrPoint = { t: number; price: number };

export type SnkrSale = { price: number; date: string; condition: string };

export type TrendRange = "1w" | "1m" | "3m" | "all";

export type SnkrMarket = {
  status: "ok" | "empty" | "unavailable";
  grade: "PSA10" | "A" | null;
  price: number | null;
  recent: SnkrSale[];
  /** History rows returned. 20 means the page was full. */
  saleCount: number;
  saleCountCapped: boolean;
  rangeLow: number | null;
  rangeHigh: number | null;
  /** PSA10 median / A median, one decimal. Null when either side has no sale. */
  premium: number | null;
  points: SnkrPoint[];
};

const EMPTY: SnkrMarket = {
  status: "empty",
  grade: null,
  price: null,
  recent: [],
  saleCount: 0,
  saleCountCapped: false,
  rangeLow: null,
  rangeHigh: null,
  premium: null,
  points: [],
};

const FALLBACK_IDS = { PSA10: 22, A: 18 };

let gradeIds = { ...FALLBACK_IDS };
let lastFetch = 0;
const cache = new Map<string, { at: number; ttl: number; value: SnkrMarket }>();
const inflight = new Map<string, Promise<SnkrMarket>>();

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function foldCode(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function snkrEnabled(game: string): boolean {
  return game === "POKEMON";
}

export function parseTrendRange(value: string | undefined | null): TrendRange {
  if (value === "1w" || value === "1m" || value === "3m") return value;
  return "all";
}

export function snkrQueries(card: SnkrCardRef): string[] {
  const num = card.numberKey.trim();
  const code = card.setCode.trim();
  const name = (card.printRegion === "JP" ? card.nameJa || card.nameEn : card.nameEn).trim();
  const setName = (card.printRegion === "JP" ? card.setNameJa || card.setNameEn : card.setNameEn).trim();
  const out = new Set<string>();
  if (code && num) out.add(`${code} ${num}`);
  if (name && code && num) out.add(`${name} ${code} ${num}`.replace(/\s+/g, " "));
  // English TCGdex codes often are not the code SNKRDUNK prints. The set name still is.
  if (name && num && setName.length >= 4 && foldCode(setName) !== foldCode(code)) out.add(`${name} ${setName} ${num}`.replace(/\s+/g, " "));
  return [...out].filter((query) => query.length >= 2).slice(0, 3);
}

type ParsedPrinting = {
  setCode: string | null;
  number: string;
  lang: "EN" | "JP";
  variant: boolean;
};

function isVariant(name: string): boolean {
  return /mirror|master ball|monster ball|ミラー|マスターボール|モンスターボール/i.test(name);
}

function cardWantsVariant(card: SnkrCardRef): boolean {
  return isVariant(`${card.nameEn} ${card.nameJa} ${card.finish || ""} ${card.rarity || ""}`);
}

/** Pull `[SV2a 006/165]`, `[MEW EN 193/165]`, or `[4/102][EN]` out of a SNKRDUNK title. */
export function parsePrinting(name: string): ParsedPrinting | null {
  const text = name.normalize("NFKC");
  const bracket = text.match(/\[([A-Za-z][A-Za-z0-9.]*)\s+(?:(EN|JP)\s+)?(\d+)(?:\/\d+)?\]/i);
  if (bracket) {
    const tagged = (bracket[2] || "").toUpperCase();
    const lang: "EN" | "JP" = tagged === "EN" || /\[EN\]|\(EN\)/.test(text) ? "EN" : "JP";
    if (tagged === "JP") return { setCode: bracket[1], number: String(Number(bracket[3])), lang: "JP", variant: isVariant(text) };
    return { setCode: bracket[1], number: String(Number(bracket[3])), lang, variant: isVariant(text) };
  }
  const old = text.match(/\[(\d+)\/\d+\]\s*\[(EN|JP)\]/i);
  if (!old) return null;
  return { setCode: null, number: String(Number(old[1])), lang: old[2].toUpperCase() === "JP" ? "JP" : "EN", variant: isVariant(text) };
}

function latinPhrase(blob: string, term: string): boolean {
  if (term.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeReg(term)}([^a-z0-9]|$)`, "i").test(blob);
}

function jaPhrase(hay: string, term: string): boolean {
  if (!term || !/[\u3040-\u9fff]/.test(term)) return false;
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(term, from);
    if (at < 0) return false;
    const next = hay[at + term.length] || "";
    if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(next)) return true;
    from = at + 1;
  }
  return false;
}

function nameHits(card: SnkrCardRef, blob: string): boolean {
  const en = card.nameEn.normalize("NFKC").trim().toLowerCase();
  const folded = blob.normalize("NFKC").toLowerCase();
  if (en && latinPhrase(folded, en)) return true;
  const token = en.split(/[^a-z0-9]+/).find((part) => part.length >= 4);
  if (token && latinPhrase(folded, token)) return true;
  return jaPhrase(blob, card.nameJa.normalize("NFKC").trim());
}

function setNameHits(card: SnkrCardRef, blob: string): boolean {
  const folded = blob.normalize("NFKC").toLowerCase();
  return [card.setNameEn, card.setNameJa].some((name) => {
    const text = name.normalize("NFKC").trim().toLowerCase();
    return text.length >= 4 && folded.includes(text);
  });
}

export function scoreSnkrHit(card: SnkrCardRef, hit: SnkrSearchHit): number {
  if (!snkrEnabled(card.game) || hit.isTradingCard === false) return 0;
  if (!card.numberKey) return 0;
  const blob = `${hit.name} ${hit.localizedName}`;
  const parsed = parsePrinting(blob);
  if (!parsed || parsed.number !== card.numberKey) return 0;
  if (card.printRegion === "JP" && parsed.lang !== "JP") return 0;
  if (card.printRegion === "WEST" && parsed.lang !== "EN") return 0;
  const code = foldCode(card.setCode);
  const hitCode = parsed.setCode ? foldCode(parsed.setCode) : "";
  let score = 0;
  if (hitCode && code && hitCode === code) score = 50;
  else if (!hitCode && nameHits(card, blob) && setNameHits(card, blob)) score = 34;
  else return 0;
  if (nameHits(card, blob)) score += 8;
  if (parsed.variant !== cardWantsVariant(card)) score -= 6;
  return score;
}

export function pickSnkrHit(card: SnkrCardRef, hits: SnkrSearchHit[]): SnkrSearchHit | null {
  const ranked = hits
    .map((hit) => ({ hit, score: scoreSnkrHit(card, hit) }))
    .filter((row) => row.score >= 34)
    .sort((a, b) => b.score - a.score || a.hit.id - b.hit.id);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0].hit;
}

export function parseSearch(raw: unknown): SnkrSearchHit[] {
  const obj = asRecord(raw);
  if (!obj) return [];
  const rows = [...asArray(obj.streetwears), ...asArray(obj.products), ...asArray(obj.apparels)];
  const hits: SnkrSearchHit[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec || typeof rec.id !== "number" || typeof rec.name !== "string") continue;
    hits.push({
      id: rec.id,
      name: rec.name,
      localizedName: typeof rec.localizedName === "string" ? rec.localizedName : "",
      isTradingCard: typeof rec.isTradingCard === "boolean" ? rec.isTradingCard : undefined,
    });
  }
  return hits;
}

export function parseChart(raw: unknown): { points: SnkrPoint[]; options: { id: number; name: string }[] } {
  const obj = asRecord(raw);
  if (!obj) return { points: [], options: [] };
  const points: SnkrPoint[] = [];
  for (const row of asArray(obj.points)) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const t = Number(row[0]);
    const price = Number(row[1]);
    if (!Number.isFinite(t) || !Number.isFinite(price) || price <= 0) continue;
    points.push({ t, price });
  }
  points.sort((a, b) => a.t - b.t);
  const options: { id: number; name: string }[] = [];
  for (const row of asArray(obj.salesChartOption)) {
    const rec = asRecord(row);
    if (!rec || typeof rec.id !== "number" || typeof rec.localizedName !== "string") continue;
    options.push({ id: rec.id, name: rec.localizedName });
  }
  return { points, options };
}

export function parseHistory(raw: unknown): SnkrSale[] {
  const obj = asRecord(raw);
  if (!obj) return [];
  const sales: SnkrSale[] = [];
  for (const row of asArray(obj.history)) {
    const rec = asRecord(row);
    if (!rec || typeof rec.price !== "number" || rec.price <= 0) continue;
    sales.push({
      price: rec.price,
      date: typeof rec.date === "string" ? rec.date : "",
      condition: typeof rec.condition === "string" ? rec.condition : "",
    });
  }
  return sales;
}

export function slicePoints(points: SnkrPoint[], range: TrendRange, now: number): SnkrPoint[] {
  if (range === "all") return points;
  const days = range === "1w" ? 7 : range === "1m" ? 30 : 90;
  return points.filter((point) => point.t >= now - days * 86_400_000);
}

export function marketStats(points: SnkrPoint[]): { high: number; low: number; spread: number; changePct: number | null } | null {
  if (!points.length) return null;
  const prices = points.map((point) => point.price);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const changePct = prices.length >= 2 && first > 0 ? ((last - first) / first) * 100 : null;
  return { high, low, spread: high - low, changePct };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function premiumRatio(graded: number[], raw: number[]): number | null {
  const left = median(graded);
  const right = median(raw);
  if (left == null || right == null || right <= 0) return null;
  const ratio = left / right;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.round(ratio * 10) / 10;
}

export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}%`;
}

export function gradeLabel(name: string, locale: Locale): string {
  const psa = name.replace(/\s+/g, "").match(/^PSA(\d+)$/i);
  if (psa) return `PSA ${psa[1]}`;
  if (/^[ABCD]$/.test(name)) return locale === "en" ? `Grade ${name}` : `${name} 級`;
  return name;
}

export function localizeSnkrDate(date: string, locale: Locale): string {
  const min = date.match(/^(\d+)分前$/);
  if (min) return locale === "en" ? `${min[1]}m ago` : `${min[1]} 分鐘前`;
  const hour = date.match(/^(\d+)時間前$/);
  if (hour) return locale === "en" ? `${hour[1]}h ago` : `${hour[1]} 小時前`;
  const day = date.match(/^(\d+)日前$/);
  if (day) return locale === "en" ? `${day[1]}d ago` : `${day[1]} 日前`;
  const abs = date.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (abs) {
    if (locale === "en") return `${abs[1]}-${abs[2]}-${abs[3]}`;
    return `${Number(abs[3])}/${Number(abs[2])}/${abs[1]}`;
  }
  return date;
}

function idsFromOptions(options: { id: number; name: string }[]) {
  const psa = options.find((option) => option.name.replace(/\s+/g, "").toUpperCase() === "PSA10");
  const raw = options.find((option) => option.name === "A");
  if (psa) gradeIds.PSA10 = psa.id;
  if (raw) gradeIds.A = raw.id;
}

function cacheKey(card: SnkrCardRef): string {
  return [card.game, card.printRegion, foldCode(card.setCode), card.numberKey, card.nameEn, card.nameJa, card.finish || "", card.rarity || ""].join("|");
}

async function pace() {
  const wait = Math.max(0, PACE_MS - (Date.now() - lastFetch));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastFetch = Date.now();
}

async function snkrGet(url: string): Promise<{ ok: true; body: unknown } | { ok: false; down: boolean }> {
  await pace();
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 1800 },
    });
    if (res.status === 429 || res.status === 503 || res.status >= 500) return { ok: false, down: true };
    if (!res.ok) return { ok: false, down: false };
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false, down: true };
  }
}

async function searchOnce(query: string) {
  const url = `${SEARCH}?${new URLSearchParams({ keyword: query, perPage: "20", page: "1" })}`;
  return snkrGet(url);
}

async function loadChart(id: number, optionId: number) {
  return snkrGet(`${ORIGIN}/v1/apparels/${id}/sales-chart/used?${new URLSearchParams({ salesChartOptionId: String(optionId), range: "all" })}`);
}

async function loadHistory(id: number, optionId: number) {
  return snkrGet(`${ORIGIN}/v1/apparels/${id}/sales-history?${new URLSearchParams({ page: "1", per_page: "20", condition_id: String(optionId) })}`);
}

function remember(key: string, value: SnkrMarket, ttl: number) {
  cache.set(key, { at: Date.now(), ttl, value });
  return value;
}

export function loadSnkrMarket(card: SnkrCardRef): Promise<SnkrMarket> {
  if (!snkrEnabled(card.game) || !card.numberKey || !card.setCode.trim()) return Promise.resolve(EMPTY);
  const key = cacheKey(card);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.value);
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = querySnkrMarket(card, key).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function querySnkrMarket(card: SnkrCardRef, key: string): Promise<SnkrMarket> {
  let down = false;
  let matched: SnkrSearchHit | null = null;
  for (const query of snkrQueries(card)) {
    const res = await searchOnce(query);
    if (!res.ok) {
      down = down || res.down;
      if (res.down) break;
      continue;
    }
    matched = pickSnkrHit(card, parseSearch(res.body));
    if (matched && scoreSnkrHit(card, matched) >= 50) break;
    if (matched) break;
  }
  if (!matched) return remember(key, down ? { ...EMPTY, status: "unavailable" } : EMPTY, down ? TTL_DOWN : TTL_OK);

  const requested = gradeIds.PSA10;
  const chartRes = await loadChart(matched.id, requested);
  if (!chartRes.ok) return remember(key, { ...EMPTY, status: "unavailable" }, TTL_DOWN);
  let chart = parseChart(chartRes.body);
  idsFromOptions(chart.options);
  if (gradeIds.PSA10 !== requested) {
    const again = await loadChart(matched.id, gradeIds.PSA10);
    if (again.ok) chart = parseChart(again.body);
  }

  const [psaRes, rawRes] = await Promise.all([loadHistory(matched.id, gradeIds.PSA10), loadHistory(matched.id, gradeIds.A)]);
  if (!psaRes.ok && !rawRes.ok) return remember(key, { ...EMPTY, status: "unavailable" }, TTL_DOWN);
  const psaSales = psaRes.ok ? parseHistory(psaRes.body) : [];
  const rawSales = rawRes.ok ? parseHistory(rawRes.body) : [];

  let grade: "PSA10" | "A" = "PSA10";
  let points = chart.points;
  let recent = psaSales;
  if (!points.length && !psaSales.length) {
    grade = "A";
    recent = rawSales;
    const rawChart = await loadChart(matched.id, gradeIds.A);
    points = rawChart.ok ? parseChart(rawChart.body).points : [];
    if (!points.length && !recent.length) return remember(key, EMPTY, TTL_OK);
  }

  const prices = recent.map((sale) => sale.price);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  return remember(
    key,
    {
      status: "ok",
      grade,
      price: recent[0]?.price ?? points[points.length - 1]?.price ?? null,
      recent: recent.slice(0, 4),
      saleCount: recent.length,
      saleCountCapped: recent.length >= 20,
      rangeLow: low,
      rangeHigh: high,
      premium: premiumRatio(
        psaSales.map((sale) => sale.price),
        rawSales.map((sale) => sale.price),
      ),
      points,
    },
    TTL_OK,
  );
}
