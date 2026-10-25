import type { DexPrintRegion } from "./dex";

export type CatalogPrinting = {
  externalId: string;
  collectorNumber: string;
  numberKey: string;
  nameEn: string;
  nameJa: string;
  sourceImageUrl: string;
  rarity: string | null;
  artist: string | null;
  /** Team for Topps. Other games leave it unset and ingest stores null. */
  finish?: string | null;
};

export type CatalogPrintingSet = {
  externalId: string;
  printRegion: DexPrintRegion;
  code: string;
  nameEn: string;
  nameJa: string;
  series: string | null;
  releaseDate: string | null;
  cards: CatalogPrinting[];
};

export function dedupePrintings(cards: CatalogPrinting[]): CatalogPrinting[] {
  const seen = new Set<string>();
  const out: CatalogPrinting[] = [];
  for (const card of cards) {
    if (!card.externalId || seen.has(card.externalId)) continue;
    seen.add(card.externalId);
    out.push(card);
  }
  out.sort((a, b) => a.externalId.localeCompare(b.externalId));
  return out;
}
