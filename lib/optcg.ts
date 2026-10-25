import { catalogGetJson, catalogStatus } from "./catalog-http";
import { dedupePrintings, type CatalogPrinting, type CatalogPrintingSet } from "./catalog-source";
import { numberKey } from "./dex";

const ORIGIN = "https://optcgapi.com/api";

export type OptcgKind = "set" | "deck" | "promo" | "don";

type OptcgRow = {
  card_name?: unknown;
  set_name?: unknown;
  set_id?: unknown;
  rarity?: unknown;
  card_set_id?: unknown;
  card_image_id?: unknown;
  card_image?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Card number after the set prefix. `OP01-001_p1` → `1`. */
export function optcgNumberKey(code: string): string {
  const local = code.split("_")[0]?.split("-").pop() || code;
  return numberKey(local);
}

function fileSlug(url: string): string {
  const file = decodeURIComponent(url.split("?")[0]?.split("/").pop() || "");
  return file
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

/**
 * Set and deck printings key off the image id (`OP01-001_p1`).
 * Promos reuse those ids with a different picture, so they key off the image file.
 */
export function optcgExternalId(kind: OptcgKind, row: { card_image_id?: string; card_set_id?: string; card_image?: string }): string {
  const imageId = (row.card_image_id || row.card_set_id || "").trim();
  if (kind === "set" || kind === "deck") return imageId ? `op-en:${imageId}` : "";
  const file = fileSlug(row.card_image || "");
  const key = file || imageId;
  return key ? `op-en:${kind}:${key}` : "";
}

export function mapOptcgCard(raw: unknown, kind: OptcgKind): CatalogPrinting | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as OptcgRow;
  const cardSetId = text(row.card_set_id);
  const imageId = text(row.card_image_id);
  const image = text(row.card_image);
  const name = text(row.card_name);
  const externalId = optcgExternalId(kind, { card_image_id: imageId, card_set_id: cardSetId, card_image: image });
  if (!externalId || !name) return null;
  const collectorNumber = cardSetId || imageId || fileSlug(image) || "—";
  return {
    externalId,
    collectorNumber,
    numberKey: optcgNumberKey(collectorNumber),
    nameEn: name,
    nameJa: name,
    sourceImageUrl: image.startsWith("https://") ? image : "",
    rarity: text(row.rarity) || null,
    artist: null,
  };
}

function mapList(body: unknown, kind: OptcgKind): CatalogPrinting[] {
  if (!Array.isArray(body)) return [];
  return dedupePrintings(body.flatMap((row) => {
    const card = mapOptcgCard(row, kind);
    return card ? [card] : [];
  }));
}

export type OptcgQueueItem = {
  externalId: string;
  lang: "en";
  kind: OptcgKind;
  id: string;
  name: string;
  code: string;
};

function rowsOf(body: unknown): Record<string, unknown>[] {
  if (!Array.isArray(body)) return [];
  return body.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

/** OPTCG lists oldest first (OP-01 … latest). Newest sets are ingested first. */
export function optcgQueue(setsBody: unknown, decksBody: unknown): OptcgQueueItem[] {
  const sets = rowsOf(setsBody)
    .flatMap((row) => {
      const id = text(row.set_id);
      const name = text(row.set_name);
      if (!id || !name) return [];
      return [{ externalId: `en:${id}`, lang: "en" as const, kind: "set" as const, id, name, code: id }];
    })
    .reverse();
  const decks = rowsOf(decksBody)
    .flatMap((row) => {
      const id = text(row.structure_deck_id);
      const name = text(row.structure_deck_name);
      if (!id || !name) return [];
      return [{ externalId: `en:${id}`, lang: "en" as const, kind: "deck" as const, id, name, code: id }];
    })
    .reverse();
  return [
    ...sets,
    ...decks,
    { externalId: "en:PROMO", lang: "en", kind: "promo", id: "PROMO", name: "Promotion Cards", code: "PROMO" },
    { externalId: "en:DON", lang: "en", kind: "don", id: "DON", name: "DON!!", code: "DON" },
  ];
}

export async function listOptcgQueue(): Promise<OptcgQueueItem[]> {
  const [setsBody, decksBody] = await Promise.all([catalogGetJson(`${ORIGIN}/allSets/`), catalogGetJson(`${ORIGIN}/allDecks/`)]);
  return optcgQueue(setsBody, decksBody);
}

function seriesLabel(kind: OptcgKind): string {
  if (kind === "deck") return "Starter Deck";
  if (kind === "promo") return "Promo";
  if (kind === "don") return "DON!!";
  return "Booster";
}

export function optcgSet(item: Pick<OptcgQueueItem, "kind" | "id" | "name" | "code">, cards: CatalogPrinting[]): CatalogPrintingSet {
  const scoped =
    item.kind === "promo" || item.kind === "don"
      ? cards
      : cards.map((card) => ({
          ...card,
          externalId: `op-en:${item.code}:${card.externalId.replace(/^op-en:/, "")}`,
        }));
  return {
    externalId: `op-en:${item.code}`,
    printRegion: "WEST",
    code: item.code,
    nameEn: item.name,
    nameJa: item.name,
    series: seriesLabel(item.kind),
    releaseDate: null,
    cards: dedupePrintings(scoped),
  };
}

async function readList(url: string, kind: OptcgKind): Promise<CatalogPrinting[] | null> {
  try {
    return mapList(await catalogGetJson(url), kind);
  } catch (error) {
    if (catalogStatus(error) === 404) return null;
    throw error;
  }
}

/** One OPTCG group. 404 becomes null so ingest can mark it empty. */
export async function fetchOptcgSet(item: OptcgQueueItem): Promise<CatalogPrintingSet | null> {
  if (item.kind === "set") {
    const cards = await readList(`${ORIGIN}/sets/${encodeURIComponent(item.id)}/`, "set");
    return cards ? optcgSet(item, cards) : null;
  }
  if (item.kind === "deck") {
    const cards = await readList(`${ORIGIN}/decks/${encodeURIComponent(item.id)}/`, "deck");
    return cards ? optcgSet(item, cards) : null;
  }
  if (item.kind === "promo") {
    const cards = await readList(`${ORIGIN}/allPromos/`, "promo");
    return cards ? optcgSet(item, cards) : null;
  }
  const cards = await readList(`${ORIGIN}/allDonCards/`, "don");
  return cards ? optcgSet(item, cards) : null;
}
