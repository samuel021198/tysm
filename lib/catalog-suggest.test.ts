import { catalogSuggestScore, catalogSuggestion, rankCatalogSuggestions, type CatalogSuggestCard } from "./catalog-suggest";
import { catalogCardMatches } from "./dex";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function card(over: Partial<CatalogSuggestCard> = {}): CatalogSuggestCard {
  return {
    id: "card_zard",
    nameEn: "Charizard",
    nameJa: "リザードン",
    collectorNumber: "4/102",
    numberKey: "4",
    printRegion: "WEST",
    rarity: "Rare Holo",
    finish: "Holo",
    listingCount: 1,
    setNameEn: "Base Set",
    setNameJa: "基本セット",
    setCode: "base1",
    series: "Base",
    releaseDate: "1999-01-09",
    ...over,
  };
}

const zard = card();
const hot = card({ id: "card_hot", nameEn: "Pikachu", nameJa: "ピカチュウ", listingCount: 40, releaseDate: "2022-09-02", setNameEn: "Lost Origin", collectorNumber: "52/196", numberKey: "52" });
const quiet = card({ id: "card_quiet", nameEn: "Pikachu", listingCount: 0, releaseDate: "2022-01-01", setNameEn: "Pokemon Go", collectorNumber: "28/78", numberKey: "28" });

const picked = catalogSuggestion(zard);
assert(picked.title === "1999 Pokemon base1 EN #4 Charizard Rare Holo", "suggestion uses the catalog title");
assert(!picked.title.includes(" - "), "suggestion title has no finish dash");
assert(picked.game === "Pokémon" && picked.setName === "Base Set" && picked.language === "英文", "game, set, and language come off the card");
assert(catalogSuggestion(card({ printRegion: "JP", setNameEn: "", setNameJa: "仰天のボルテッカー" })).language === "日文", "japanese prints store 日文");

const mew = card({
  id: "mew",
  nameEn: "Mew ex",
  nameJa: "ミュウex",
  collectorNumber: "193/165",
  numberKey: "193",
  printRegion: "JP",
  rarity: "Super Rare",
  finish: "Holo",
  setNameEn: "Pokemon Card 151",
  setNameJa: "ポケモンカード151",
  setCode: "SV2a",
  releaseDate: "2023-06-16",
});
const fates = card({
  id: "fates",
  nameEn: "Charizard ex",
  nameJa: "リザードンex",
  collectorNumber: "006/091",
  numberKey: "6",
  printRegion: "WEST",
  rarity: "Double rare",
  finish: "Holo",
  setNameEn: "Paldean Fates",
  setNameJa: "パルデアの運命",
  setCode: "sv4.5",
  releaseDate: "2024-01-26",
});
const plain = card({
  id: "plain",
  nameEn: "Snorlax",
  nameJa: "カビゴン",
  collectorNumber: "11/20",
  numberKey: "11",
  rarity: null,
  finish: null,
  setNameEn: "Other Set",
  setCode: "xyz",
  releaseDate: "2026-01-01",
});
assert(catalogSuggestion(mew).title === "2023 Pokemon SV2a JP #193 Mew ex Super Rare", "displayed suggestion uses the new format");
assert(!catalogSuggestion(mew).title.includes("151") && !catalogSuggestion(mew).title.includes(" - "), "displayed title drops the set name and finish");
assert(catalogSuggestion(fates).title === "2024 Pokemon sv4.5 EN #6 Charizard ex Double Rare", "english suggestion keeps the set code");
assert(rankCatalogSuggestions([plain, fates, mew], "Paldean Fates", 1)[0]?.id === "fates", "old set name still ranks the card");
assert(rankCatalogSuggestions([plain, fates], "Holo", 1)[0]?.id === "fates", "finish still ranks a card whose title omits it");
assert(rankCatalogSuggestions([plain, mew], "SV2a", 1)[0]?.id === "mew", "set code ranks the new title");
assert(rankCatalogSuggestions([plain, mew], "Super Rare", 1)[0]?.id === "mew", "rarity ranks the new title");
assert(
  rankCatalogSuggestions([plain, mew], "2023 Pokemon Pokemon Card 151 #193 Mew ex - Holo", 1)[0]?.id === "mew",
  "a full old-style query still returns the card",
);
assert(catalogCardMatches(
  {
    nameEn: mew.nameEn,
    nameJa: mew.nameJa,
    collectorNumber: mew.collectorNumber,
    numberKey: mew.numberKey,
    printRegion: mew.printRegion,
    rarity: mew.rarity,
    finish: mew.finish,
    setNameEn: mew.setNameEn,
    setNameJa: mew.setNameJa,
    setCode: mew.setCode,
    series: mew.series,
    releaseDate: mew.releaseDate,
  },
  "Holo",
), "field match does not depend on the display title");

assert(catalogSuggestScore(hot, "Pikachu") > catalogSuggestScore(zard, "Pikachu"), "a name hit outranks a miss");
assert(catalogSuggestScore(hot, "Pikachu") > catalogSuggestScore(quiet, "Pikachu"), "the same name ranks the hotter listing first");
assert(catalogSuggestScore(hot, "2022") > catalogSuggestScore(zard, "2022"), "a year prefers cards released that year");

const ranked = rankCatalogSuggestions([zard, quiet, hot], "pika", 2);
assert(ranked.map((row) => row.id).join("|") === "card_hot|card_quiet", "typeahead is hot-first within the name");
assert(rankCatalogSuggestions([zard, hot], "charizard", 12)[0]?.id === "card_zard", "an exact name stays first");

console.log("catalog suggest ok");
