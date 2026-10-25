import { listingTitleFromCatalog, releaseYear, titleCasePhrase } from "./card-title";
import { catalogAnchorMatches, catalogCardMatches, type CatalogSearchCard, type DexPrintRegion } from "./dex";
import { foldSearch } from "./search";

export type CatalogSuggestCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  numberKey: string;
  printRegion: DexPrintRegion;
  rarity: string | null;
  finish: string | null;
  listingCount: number;
  setNameEn: string;
  setNameJa: string;
  setCode: string;
  series: string | null;
  releaseDate: string | null;
};

export type CatalogSuggestion = {
  id: string;
  title: string;
  game: string;
  setName: string;
  series: string;
  cardName: string;
  language: string;
  collectorNumber: string;
  rarity: string | null;
  setCode: string;
  year: string;
};

const GAME_LABEL: Record<string, string> = { POKEMON: "Pokémon" };

/** Stored language matches existing listings (日文 / 英文), which dex linking already understands. */
export function catalogLanguage(region: DexPrintRegion): string {
  return region === "JP" ? "日文" : "英文";
}

export function catalogGameLabel(game: string | null | undefined): string {
  return GAME_LABEL[game || "POKEMON"] || "Pokémon";
}

export function catalogSuggestion(card: CatalogSuggestCard, game = "POKEMON"): CatalogSuggestion {
  const setName = titleCasePhrase(card.setNameEn || card.setNameJa);
  const cardName = titleCasePhrase(card.nameEn || card.nameJa);
  const series = titleCasePhrase(card.series || setName);
  return {
    id: card.id,
    title: listingTitleFromCatalog({
      releaseDate: card.releaseDate,
      setCode: card.setCode,
      printRegion: card.printRegion,
      collectorNumber: card.collectorNumber,
      numberKey: card.numberKey,
      cardName,
      rarity: card.rarity,
    }),
    game: catalogGameLabel(game),
    setName,
    series,
    cardName,
    language: catalogLanguage(card.printRegion),
    collectorNumber: card.collectorNumber,
    rarity: card.rarity,
    setCode: card.setCode,
    year: releaseYear(card.releaseDate),
  };
}

function searchCard(card: CatalogSuggestCard): CatalogSearchCard {
  return {
    nameEn: card.nameEn,
    nameJa: card.nameJa,
    collectorNumber: card.collectorNumber,
    numberKey: card.numberKey,
    printRegion: card.printRegion,
    rarity: card.rarity,
    finish: card.finish,
    setNameEn: card.setNameEn,
    setNameJa: card.setNameJa,
    setCode: card.setCode,
    series: card.series,
    releaseDate: card.releaseDate,
  };
}

function band(card: CatalogSuggestCard, query: string): number {
  const folded = foldSearch(query.trim());
  if (!folded) return 0;
  const suggestion = catalogSuggestion(card);
  const title = foldSearch(suggestion.title);
  const nameEn = foldSearch(card.nameEn);
  const nameJa = foldSearch(card.nameJa);
  const setEn = foldSearch(card.setNameEn);
  const setJa = foldSearch(card.setNameJa);
  const exact = [nameEn, nameJa, title].some((value) => value === folded);
  if (exact) return 4;
  const prefix = [nameEn, title, setEn].some((value) => value.startsWith(folded));
  if (prefix) return 3;
  const includes = [title, nameEn, nameJa, setEn, setJa, foldSearch(card.series || ""), foldSearch(card.setCode), foldSearch(card.rarity || ""), foldSearch(card.finish || "")].some(
    (value) => value.includes(folded),
  );
  if (includes || catalogCardMatches(searchCard(card), query)) return 2;
  if (catalogAnchorMatches(searchCard(card), query)) return 1;
  return 0;
}

/** Relevance band first, then listing count, so a typed name stays above a merely popular neighbour. */
export function catalogSuggestScore(card: CatalogSuggestCard, query: string): number {
  return band(card, query) * 1000 + Math.min(Math.max(card.listingCount, 0), 999);
}

export function rankCatalogSuggestions<T extends CatalogSuggestCard>(cards: T[], query: string, limit = 12): T[] {
  return [...cards]
    .filter((card) => band(card, query) > 0)
    .sort((a, b) => catalogSuggestScore(b, query) - catalogSuggestScore(a, query) || (b.releaseDate || "").localeCompare(a.releaseDate || ""))
    .slice(0, limit);
}
