import { bilingualName, chooseDexSets, numberKey, type DexPrintRegion } from "./dex";

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
  return {
    externalId: `${lang}:${id}`,
    setExternalId: set.externalId,
    printRegion: set.printRegion,
    collectorNumber: printed,
    numberKey: numberKey(localId || printed),
    nameEn: names.nameEn,
    nameJa: names.nameJa,
    sourceImageUrl: cardImageUrl(str(obj, "image")),
    rarity: str(obj, "rarity") || null,
    artist: str(obj, "illustrator") || null,
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
  const counts = countOf(obj.cardCount);
  const serie = asRecord(obj.serie);
  const serieId = serie ? str(serie, "id") : "";
  const seriesName = serie ? str(serie, "name") : "";
  const set: MappedSet = {
    externalId: `${lang}:${id}`,
    printRegion: region,
    code: id,
    nameEn: names.nameEn,
    nameJa: names.nameJa,
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

async function tcgdexGet(path: string, attempt = 0): Promise<unknown> {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if ((res.status === 429 || res.status === 503) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    return tcgdexGet(path, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tcgdex ${res.status} ${text.slice(0, 160).replace(/\s+/g, " ")}`);
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
  const details = await Promise.all(
    listed.map(async (row) => {
      try {
        return serieBrief(await tcgdexGet(`/${lang}/series/${encodeURIComponent(row.id)}`));
      } catch (error) {
        console.error("tcgdex series skipped", row.id, error instanceof Error ? error.message.slice(0, 120) : "error");
        return null;
      }
    }),
  );
  return details
    .filter((row): row is SerieBrief => Boolean(row))
    .filter((row) => !pocket(row.id, row.name))
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.id.localeCompare(b.id));
}

/** Newest 1–2 physical sets per language that actually have card art, capped by card budget. No API key. */
export async function fetchDexSubset(lang: "en" | "ja", want = 2, budget = 250): Promise<{ sets: MappedSet[]; cards: MappedCard[] }> {
  const series = await loadSeries(lang);
  const sets: MappedSet[] = [];
  const cards: MappedCard[] = [];
  let left = budget;
  for (const serie of series) {
    if (sets.length >= want || left <= 0) break;
    const resumes = serie.resumes.filter(usableSetResume);
    const full = (
      await Promise.all(
        resumes.map(async (resume) => {
          try {
            return mapTcgdexSet(await tcgdexGet(`/${lang}/sets/${encodeURIComponent(resume.id)}`), lang);
          } catch (error) {
            console.error("tcgdex set skipped", resume.id, error instanceof Error ? error.message.slice(0, 120) : "error");
            return null;
          }
        }),
      )
    )
      .filter((row): row is MappedSet & { cards: MappedCard[] } => Boolean(row))
      .filter((row) => row.cards.some((card) => card.sourceImageUrl));
    const picked = chooseDexSets(
      full.map((set) => ({ id: set.externalId, total: set.total, releaseDate: set.releaseDate })),
      want - sets.length,
      left,
    );
    for (const choice of picked) {
      const set = full.find((row) => row.externalId === choice.id);
      if (!set || left <= 0) continue;
      const slice = set.cards.slice(0, Math.min(left, set.cards.length));
      const { cards: _cards, ...meta } = set;
      sets.push(meta);
      cards.push(...slice);
      left -= slice.length;
    }
  }
  return { sets, cards };
}
