import { catalogSuggestScore, catalogSuggestion, rankCatalogSuggestions, type CatalogSuggestCard } from "./catalog-suggest";

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
    series: "Base",
    releaseDate: "1999-01-09",
    ...over,
  };
}

const zard = card();
const hot = card({ id: "card_hot", nameEn: "Pikachu", nameJa: "ピカチュウ", listingCount: 40, releaseDate: "2022-09-02", setNameEn: "Lost Origin", collectorNumber: "52/196", numberKey: "52" });
const quiet = card({ id: "card_quiet", nameEn: "Pikachu", listingCount: 0, releaseDate: "2022-01-01", setNameEn: "Pokemon Go", collectorNumber: "28/78", numberKey: "28" });

const picked = catalogSuggestion(zard);
assert(picked.title === "1999 Pokemon Base Set #4 Charizard - Holo", "suggestion uses the marketplace title");
assert(picked.game === "Pokémon" && picked.setName === "Base Set" && picked.language === "英文", "game, set, and language come off the card");
assert(catalogSuggestion(card({ printRegion: "JP", setNameEn: "", setNameJa: "仰天のボルテッカー" })).language === "日文", "japanese prints store 日文");

assert(catalogSuggestScore(hot, "Pikachu") > catalogSuggestScore(zard, "Pikachu"), "a name hit outranks a miss");
assert(catalogSuggestScore(hot, "Pikachu") > catalogSuggestScore(quiet, "Pikachu"), "the same name ranks the hotter listing first");
assert(catalogSuggestScore(hot, "2022") > catalogSuggestScore(zard, "2022"), "a year prefers cards released that year");

const ranked = rankCatalogSuggestions([zard, quiet, hot], "pika", 2);
assert(ranked.map((row) => row.id).join("|") === "card_hot|card_quiet", "typeahead is hot-first within the name");
assert(rankCatalogSuggestions([zard, hot], "charizard", 12)[0]?.id === "card_zard", "an exact name stays first");

console.log("catalog suggest ok");
