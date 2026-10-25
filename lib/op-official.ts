import { catalogGetText, catalogStatus } from "./catalog-http";
import { dedupePrintings, type CatalogPrinting, type CatalogPrintingSet } from "./catalog-source";
import { numberKey } from "./dex";

const ORIGIN = "https://www.onepiece-cardgame.com";

/** Series rows that have no 【CODE】 on the official select. */
const FALLBACK_CODE: Record<string, string> = {
  "550901": "PROMO",
  "550801": "LIMITED",
  "550701": "FAMILY",
};

export type OfficialSeries = {
  id: string;
  name: string;
  code: string;
};

export type OfficialQueueItem = {
  externalId: string;
  lang: "ja";
  kind: "official";
  id: string;
  name: string;
  code: string;
};

function decodeHtml(value: string): string {
  const text = value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  return text
    .replace(/<br\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function latinName(label: string, code: string): string {
  const latin = label
    .replace(/【[^】]*】/g, " ")
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return latin || code;
}

/** Series `<select id="series">` on the official Japanese card list. Newest is first. */
export function parseOfficialSeries(html: string): OfficialSeries[] {
  const select = html.match(/<select[^>]*id="series"[\s\S]*?<\/select>/i)?.[0] || "";
  const out: OfficialSeries[] = [];
  for (const match of select.matchAll(/<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi)) {
    const id = match[1] || "";
    const name = decodeHtml(match[2] || "");
    if (!id || !name) continue;
    const bracket = name.match(/【([^】]+)】/)?.[1]?.trim() || "";
    const code = bracket || FALLBACK_CODE[id] || id;
    out.push({ id, name: name.replace(/【[^】]*】/g, " ").replace(/\s+/g, " ").trim(), code });
  }
  return out;
}

export function officialImageUrl(src: string): string {
  const clean = src.trim().split("?")[0] || "";
  if (clean.startsWith("https://")) return clean;
  const file = clean.split("/").pop() || "";
  if (!file || !/\.(png|jpe?g|webp)$/i.test(file)) return "";
  return `${ORIGIN}/images/cardlist/card/${file}`;
}

/** One `dl.modalCol` from the official card list. */
export function parseOfficialCards(html: string): CatalogPrinting[] {
  const cards: CatalogPrinting[] = [];
  for (const block of html.split(/<dl class="modalCol"/i).slice(1)) {
    const imageId = block.match(/\sid="([^"]+)"/)?.[1]?.trim() || "";
    const info = block.match(/<div class="infoCol">([\s\S]*?)<\/div>/i)?.[1] || "";
    const spans = [...info.matchAll(/<span>([^<]*)<\/span>/gi)].map((match) => decodeHtml(match[1] || ""));
    const code = spans[0] || imageId.split("_")[0] || "";
    const rarity = spans[1] || "";
    const name = decodeHtml(block.match(/<div class="cardName">([^<]*)<\/div>/i)?.[1] || "");
    const image = officialImageUrl(block.match(/data-src="([^"]+)"/i)?.[1] || "");
    if (!imageId || !name) continue;
    const collectorNumber = code || imageId;
    cards.push({
      externalId: `op-jp:${imageId}`,
      collectorNumber,
      numberKey: numberKey(collectorNumber.split("-").pop() || collectorNumber),
      nameEn: name,
      nameJa: name,
      sourceImageUrl: image,
      rarity: rarity || null,
      artist: null,
    });
  }
  return dedupePrintings(cards);
}

export function officialQueue(series: OfficialSeries[]): OfficialQueueItem[] {
  return series.map((row) => ({
    externalId: `ja:${row.id}`,
    lang: "ja" as const,
    kind: "official" as const,
    id: row.id,
    name: row.name,
    code: row.code,
  }));
}

export function officialSet(item: Pick<OfficialQueueItem, "id" | "name" | "code">, cards: CatalogPrinting[]): CatalogPrintingSet {
  return {
    externalId: `op-jp:${item.id}`,
    printRegion: "JP",
    code: item.code,
    nameEn: latinName(item.name, item.code),
    nameJa: item.name,
    series: null,
    releaseDate: null,
    cards: dedupePrintings(
      cards.map((card) => ({
        ...card,
        externalId: `op-jp:${item.id}:${card.externalId.replace(/^op-jp:/, "")}`,
      })),
    ),
  };
}

export async function listOfficialQueue(): Promise<OfficialQueueItem[]> {
  const html = await catalogGetText(`${ORIGIN}/cardlist/`);
  const queue = officialQueue(parseOfficialSeries(html));
  if (!queue.length) throw new Error("official series list was empty");
  return queue;
}

export async function fetchOfficialSet(item: OfficialQueueItem): Promise<CatalogPrintingSet | null> {
  try {
    const html = await catalogGetText(`${ORIGIN}/cardlist/?series=${encodeURIComponent(item.id)}`);
    if (!html.includes('id="series"')) throw new Error("official card list was not recognized");
    return officialSet(item, parseOfficialCards(html));
  } catch (error) {
    if (catalogStatus(error) === 404) return null;
    throw error;
  }
}
