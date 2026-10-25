import { catalogGetJson } from "./catalog-http";
import { dedupePrintings, type CatalogPrinting, type CatalogPrintingSet } from "./catalog-source";
import { numberKey } from "./dex";

const BULK = "https://api.rifthunt.com/bulk/cards";

export type RiftQueueItem = {
  externalId: string;
  lang: "en";
  kind: "rift";
  id: string;
  name: string;
  code: string;
  releaseDate: string;
};

type RiftSet = { id?: unknown; name?: unknown; released?: unknown };
type RiftCard = {
  id?: unknown;
  riftboundId?: unknown;
  name?: unknown;
  num?: unknown;
  rarity?: unknown;
  artist?: unknown;
  set?: unknown;
  imgUrl?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `ogn-007a-298` → collector `007a`, number key `7`. */
export function riftCollector(riftboundId: string, num: number | null): { collectorNumber: string; numberKey: string } {
  const parts = riftboundId.split("-").filter(Boolean);
  const local = parts.length >= 3 ? parts[1] || "" : "";
  const collectorNumber = local || (num != null && Number.isFinite(num) ? String(num) : "");
  return {
    collectorNumber: collectorNumber || "—",
    numberKey: numberKey(local || (num != null ? String(num) : "")),
  };
}

export function mapRiftCard(raw: unknown): CatalogPrinting | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as RiftCard;
  const id = text(row.id);
  const name = text(row.name);
  if (!id || !name) return null;
  const printed = riftCollector(text(row.riftboundId), typeof row.num === "number" ? row.num : null);
  const image = text(row.imgUrl);
  return {
    externalId: `rb:${id}`,
    collectorNumber: printed.collectorNumber,
    numberKey: printed.numberKey,
    nameEn: name,
    nameJa: name,
    sourceImageUrl: image.startsWith("https://") ? image : "",
    rarity: text(row.rarity) || null,
    artist: text(row.artist) || null,
  };
}

export type RiftBulk = {
  sets: RiftQueueItem[];
  cardsBySet: Map<string, CatalogPrinting[]>;
};

export function mapRiftBulk(body: unknown): RiftBulk {
  const record = body && typeof body === "object" ? (body as { sets?: unknown; cards?: unknown }) : {};
  const sets = Array.isArray(record.sets) ? record.sets : [];
  const queue: RiftQueueItem[] = [];
  for (const row of sets) {
    if (!row || typeof row !== "object") continue;
    const set = row as RiftSet;
    const id = text(set.id);
    const name = text(set.name);
    if (!id || !name) continue;
    queue.push({
      externalId: `en:${id}`,
      lang: "en",
      kind: "rift",
      id,
      name,
      code: id,
      releaseDate: text(set.released),
    });
  }
  queue.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.id.localeCompare(b.id));
  const cardsBySet = new Map<string, CatalogPrinting[]>();
  const cards = Array.isArray(record.cards) ? record.cards : [];
  const grouped = new Map<string, CatalogPrinting[]>();
  for (const row of cards) {
    const card = mapRiftCard(row);
    const setId = row && typeof row === "object" ? text((row as RiftCard).set) : "";
    if (!card || !setId) continue;
    const list = grouped.get(setId) || [];
    list.push(card);
    grouped.set(setId, list);
  }
  for (const [setId, list] of grouped) cardsBySet.set(setId, dedupePrintings(list));
  return { sets: queue, cardsBySet };
}

export function riftSet(item: RiftQueueItem, cards: CatalogPrinting[]): CatalogPrintingSet {
  return {
    externalId: `rb:${item.id}`,
    printRegion: "WEST",
    code: item.code,
    nameEn: item.name,
    nameJa: item.name,
    series: null,
    releaseDate: item.releaseDate || null,
    cards,
  };
}

let bulkCache: { at: number; bulk: RiftBulk } | null = null;

/** One bulk download per ingest call. The module cache only avoids a second GET in the same process within a minute. */
export async function loadRiftBulk(): Promise<RiftBulk> {
  if (bulkCache && Date.now() - bulkCache.at < 60_000) return bulkCache.bulk;
  const bulk = mapRiftBulk(await catalogGetJson(BULK));
  bulkCache = { at: Date.now(), bulk };
  return bulk;
}

export function clearRiftBulkCache() {
  bulkCache = null;
}
