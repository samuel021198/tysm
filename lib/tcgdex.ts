import { dexIdsOf, finishLabel, resolveEnglishCardName, resolveEnglishSetName, variantFlagsOf } from "./card-title";
import { bilingualName, numberKey, type DexPrintRegion } from "./dex";

const ORIGIN = "https://api.tcgdex.net/v2";

export type MappedSet = {
  externalId: string;
  printRegion: DexPrintRegion;
  code: string;
  nameEn: string;
  nameJa: string;
  series: string | null;
  serieId: string;
  releaseDate: string;
  total: number | null;
  official: number | null;
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
  finish: string | null;
};

type SetResume = {
  id: string;
  name: string;
  total: number | null;
  official: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === "string" ? value.trim() : "";
}

function countOf(value: unknown): { total: number | null; official: number | null } {
  const record = asRecord(value);
  const total = record && typeof record.total === "number" ? record.total : null;
  const official = record && typeof record.official === "number" ? record.official : null;
  return { total, official };
}

/** TCGdex image field, with `/high.webp` when the API omits the extension. Guessed paths 404. */
export function cardImageUrl(image: string | null | undefined): string {
  const value = (image || "").trim();
  if (!value.startsWith("https://")) return "";
  if (/\.(png|webp|jpe?g)$/i.test(value)) return value;
  return `${value.replace(/\/$/, "")}/high.webp`;
}

export function logoUrl(value: string | null | undefined): string | null {
  const logo = (value || "").trim();
  if (!logo.startsWith("https://")) return null;
  if (/\.(png|webp|jpe?g)$/i.test(logo)) return logo;
  return `${logo}.webp`;
}

export function collectorNumber(localId: string, official: number | null): string {
  const local = localId.trim();
  if (!local) return "—";
  if (official && official > 0 && /^\d+$/.test(local)) return `${local}/${String(official).padStart(local.length, "0")}`;
  return local;
}

function pocket(id: string, name: string): boolean {
  return /tcgp|pocket/i.test(`${id} ${name}`);
}

export function usableSetResume(row: SetResume): boolean {
  const total = row.total ?? 0;
  if (total <= 0 || total > 400) return false;
  if ((row.official ?? 0) <= 0) return false;
  if (pocket(row.id, row.name)) return false;
  if (/promo|プロモ/i.test(row.name)) return false;
  return true;
}

export function mapTcgdexCard(
  raw: unknown,
  set: { externalId: string; code: string; printRegion: DexPrintRegion; serieId: string; official: number | null },
  lang: "en" | "ja",
): MappedCard | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = str(obj, "id");
  const localId = str(obj, "localId");
  const name = str(obj, "name");
  if (!id || !name) return null;
  const names = bilingualName(name, set.printRegion);
  const printed = collectorNumber(localId || id.split("-").pop() || "", set.official);
  const variants = variantFlagsOf(obj.variants);
  const rarity = str(obj, "rarity") || null;
  const resolved = set.printRegion === "JP" ? resolveEnglishCardName(name, dexIdsOf(obj.dexId)) : names.nameEn;
  const han = /[\u3040-\u30ff\u3400-\u9fff]/;
  const nameEn = han.test(resolved) && names.nameEn && !han.test(names.nameEn) ? names.nameEn : resolved || names.nameEn;
  return {
    externalId: `${lang}:${id}`,
    setExternalId: set.externalId,
    printRegion: set.printRegion,
    collectorNumber: printed,
    numberKey: numberKey(localId || printed),
    nameEn,
    nameJa: names.nameJa,
    sourceImageUrl: cardImageUrl(str(obj, "image")),
    rarity,
    artist: str(obj, "illustrator") || null,
    finish: finishLabel(variants, rarity),
  };
}

export function mapTcgdexSet(raw: unknown, lang: "en" | "ja"): (MappedSet & { cards: MappedCard[] }) | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = str(obj, "id");
  const name = str(obj, "name");
  if (!id || !name) return null;
  const region: DexPrintRegion = lang === "ja" ? "JP" : "WEST";
  const names = bilingualName(name, region);
  const nameEn = region === "JP" ? resolveEnglishSetName(name, id) : name;
  const counts = countOf(obj.cardCount);
  const serie = asRecord(obj.serie);
  const serieId = serie ? str(serie, "id") : "";
  const seriesName = serie ? str(serie, "name") : "";
  const set: MappedSet = {
    externalId: `${lang}:${id}`,
    printRegion: region,
    code: id,
    nameEn: nameEn || names.nameEn,
    nameJa: region === "JP" ? name : names.nameJa,
    series: seriesName || null,
    serieId,
    releaseDate: str(obj, "releaseDate"),
    total: counts.total,
    official: counts.official,
    logoUrl: logoUrl(str(obj, "logo")),
    onlineOnly: pocket(id, name),
  };
  const cards = Array.isArray(obj.cards)
    ? obj.cards.map((row) => mapTcgdexCard(row, set, lang)).filter((row): row is MappedCard => Boolean(row))
    : [];
  return { ...set, cards };
}

class TcgdexStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TcgdexStatusError";
    this.status = status;
  }
}

async function tcgdexGet(path: string, attempt = 0): Promise<unknown> {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  // ponytail: 4 tries with linear backoff. A full EN+JA pass is tens of thousands of card GETs; overlapping ingest POSTs will trip this.
  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    return tcgdexGet(path, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new TcgdexStatusError(res.status, `tcgdex ${res.status} ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return res.json();
}

function seriesList(body: unknown): { id: string; name: string }[] {
  if (!Array.isArray(body)) throw new Error("tcgdex unexpected series list");
  return body.flatMap((row) => {
    const obj = asRecord(row);
    if (!obj) return [];
    const id = str(obj, "id");
    if (!id) return [];
    return [{ id, name: str(obj, "name") }];
  });
}

type SerieBrief = { id: string; name: string; releaseDate: string; resumes: SetResume[] };

function serieBrief(body: unknown): SerieBrief | null {
  const obj = asRecord(body);
  if (!obj) return null;
  const id = str(obj, "id");
  if (!id) return null;
  return { id, name: str(obj, "name"), releaseDate: str(obj, "releaseDate"), resumes: resumesFrom(body) };
}

function resumesFrom(body: unknown): SetResume[] {
  const obj = asRecord(body);
  const rows = obj && Array.isArray(obj.sets) ? obj.sets : [];
  return rows.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const id = str(record, "id");
    if (!id) return [];
    const counts = countOf(record.cardCount);
    return [{ id, name: str(record, "name"), total: counts.total, official: counts.official }];
  });
}

async function loadSeries(lang: "en" | "ja"): Promise<SerieBrief[]> {
  const listed = seriesList(await tcgdexGet(`/${lang}/series`)).filter((row) => !pocket(row.id, row.name));
  const details: (SerieBrief | null)[] = new Array(listed.length).fill(null);
  await mapPool(listed, 4, async (row, index) => {
    try {
      details[index] = serieBrief(await tcgdexGet(`/${lang}/series/${encodeURIComponent(row.id)}`));
    } catch (error) {
      console.error("tcgdex series skipped", row.id, error instanceof Error ? error.message.slice(0, 120) : "error");
    }
  });
  return details
    .filter((row): row is SerieBrief => Boolean(row))
    .filter((row) => !pocket(row.id, row.name))
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.id.localeCompare(b.id));
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]!, index);
    }
  }
  const width = Math.min(limit, items.length);
  if (width > 0) await Promise.all(Array.from({ length: width }, () => worker()));
}

/** Set lists omit variants and dex ids. One card request fills English names and finish. */
export async function hydrateDexCards(lang: "en" | "ja", cards: MappedCard[], limit = 4): Promise<MappedCard[]> {
  const out = cards.slice();
  await mapPool(cards, limit, async (card, index) => {
    const id = card.externalId.startsWith(`${lang}:`) ? card.externalId.slice(lang.length + 1) : "";
    if (!id) return;
    try {
      const raw = await tcgdexGet(`/${lang}/cards/${encodeURIComponent(id)}`);
      const official = countOf(asRecord(asRecord(raw)?.set)?.cardCount).official;
      const mapped = mapTcgdexCard(
        raw,
        { externalId: card.setExternalId, code: id.split("-")[0] || "", printRegion: card.printRegion, serieId: "", official },
        lang,
      );
      if (!mapped) return;
      out[index] = { ...mapped, sourceImageUrl: mapped.sourceImageUrl || card.sourceImageUrl };
    } catch (error) {
      console.error("tcgdex card skipped", id, error instanceof Error ? error.message.slice(0, 120) : "error");
    }
  });
  return out;
}

export type DexQueueItem = {
  lang: "en" | "ja";
  id: string;
  externalId: string;
  name: string;
  total: number;
  official: number;
  /** Series release date. Every set in the series shares it. */
  releaseDate: string;
  serieId: string;
  /** Position among usable sets in the series payload. */
  order: number;
};

export type DexSetProgress = { count: number; total: number | null };

/**
 * A set is done when the saved cards cover TCGdex `cardCount.total`, or when a finished pass
 * stored a shorter payload (including 0) by writing that shorter number onto `CatalogSet.total`.
 * ponytail: lowering `total` is the skip marker. A later TCGdex fill of an empty set is ignored until that row is deleted. Upgrade path: an `ingestSettledAt` column.
 */
export function dexSetSettled(item: { total: number }, db: DexSetProgress | undefined): boolean {
  if (!db) return false;
  if (item.total > 0 && db.count >= item.total) return true;
  if (db.total != null && db.total < item.total && db.count >= db.total) return true;
  return false;
}

/** `ja:SV10` means that set is finished. `ja:SV10#40` means resume at card index 40. */
export function parseDexCursor(value: string | null | undefined): { externalId: string; cardOffset: number | null } | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const hash = raw.lastIndexOf("#");
  if (hash <= 0) return { externalId: raw, cardOffset: null };
  const offset = Number(raw.slice(hash + 1));
  if (!Number.isInteger(offset) || offset < 0) return { externalId: raw, cardOffset: null };
  return { externalId: raw.slice(0, hash), cardOffset: offset };
}

export function formatDexCursor(externalId: string, cardOffset: number | null): string {
  if (cardOffset == null) return externalId;
  return `${externalId}#${cardOffset}`;
}

export type DexBatchStep = { item: DexQueueItem; cardOffset: number };

export type DexBatchPlan = {
  steps: DexBatchStep[];
  skippedSettled: number;
  done: boolean;
};

/** Next sets to fetch. Settled rows do not consume `maxSets`. A `#offset` cursor stays on that set. */
export function planDexBatch(
  queue: readonly DexQueueItem[],
  args: { cursor: string | null | undefined; settled: ReadonlySet<string>; maxSets: number },
): DexBatchPlan {
  const maxSets = Math.max(0, args.maxSets);
  const parsed = parseDexCursor(args.cursor);
  let index = 0;
  let forcedOffset: number | null = null;
  if (parsed) {
    const at = queue.findIndex((row) => row.externalId === parsed.externalId);
    if (at >= 0) {
      if (parsed.cardOffset == null) index = at + 1;
      else {
        index = at;
        forcedOffset = parsed.cardOffset;
      }
    }
  }
  const steps: DexBatchStep[] = [];
  let skippedSettled = 0;
  while (index < queue.length && steps.length < maxSets) {
    const item = queue[index]!;
    const resumeOffset = forcedOffset != null && steps.length === 0 && item.externalId === parsed?.externalId ? forcedOffset : 0;
    if (resumeOffset <= 0 && args.settled.has(item.externalId)) {
      skippedSettled += 1;
      index += 1;
      forcedOffset = null;
      continue;
    }
    steps.push({ item, cardOffset: resumeOffset });
    index += 1;
    forcedOffset = null;
  }
  let cursorIndex = index;
  if (parsed && steps.length === 0) {
    const at = queue.findIndex((row) => row.externalId === parsed.externalId);
    if (at >= 0) cursorIndex = parsed.cardOffset == null ? at + 1 : at;
  }
  const done = steps.length === 0 && cursorIndex >= queue.length;
  return { steps, skippedSettled, done };
}

/** How many sets are still ahead of `cursor`, counting a mid-set cursor as unfinished. */
export function dexUnsettledRemaining(queue: readonly DexQueueItem[], settled: ReadonlySet<string>, cursor: string | null): number {
  const parsed = parseDexCursor(cursor);
  let start = 0;
  let mid = false;
  if (parsed) {
    const at = queue.findIndex((row) => row.externalId === parsed.externalId);
    if (at >= 0) {
      if (parsed.cardOffset == null) start = at + 1;
      else {
        start = at;
        mid = true;
      }
    }
  }
  let count = 0;
  for (let i = start; i < queue.length; i += 1) {
    if (mid && i === start) {
      count += 1;
      continue;
    }
    if (!settled.has(queue[i]!.externalId)) count += 1;
  }
  return count;
}

/** Usable EN/JA sets, newest series first. Pocket, promo, and unusable resumes are already dropped. */
export async function listDexSetQueue(langs: readonly ("en" | "ja")[]): Promise<DexQueueItem[]> {
  const items: DexQueueItem[] = [];
  const seen = new Set<string>();
  for (const lang of langs) {
    const series = await loadSeries(lang);
    for (const serie of series) {
      let order = 0;
      for (const resume of serie.resumes) {
        if (!usableSetResume(resume)) continue;
        const externalId = `${lang}:${resume.id}`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        items.push({
          lang,
          id: resume.id,
          externalId,
          name: resume.name,
          total: resume.total ?? 0,
          official: resume.official ?? 0,
          releaseDate: serie.releaseDate,
          serieId: serie.id,
          order,
        });
        order += 1;
      }
    }
  }
  items.sort(
    (a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.serieId.localeCompare(b.serieId) || a.order - b.order || a.id.localeCompare(b.id),
  );
  return items;
}

/** One set payload. 404 becomes null so ingest can mark it empty and move on. Other errors propagate. */
export async function fetchMappedSet(lang: "en" | "ja", id: string): Promise<(MappedSet & { cards: MappedCard[] }) | null> {
  try {
    const mapped = mapTcgdexSet(await tcgdexGet(`/${lang}/sets/${encodeURIComponent(id)}`), lang);
    if (!mapped) return null;
    const seen = new Set<string>();
    mapped.cards = mapped.cards.filter((card) => {
      if (seen.has(card.externalId)) return false;
      seen.add(card.externalId);
      return true;
    });
    mapped.cards.sort((a, b) => a.externalId.localeCompare(b.externalId) || a.collectorNumber.localeCompare(b.collectorNumber));
    return mapped;
  } catch (error) {
    if (error instanceof TcgdexStatusError && error.status === 404) return null;
    throw error;
  }
}
