import { catalogSuggestScore, catalogSuggestion, listingCatalogPrefill, rankCatalogSuggestions, type CatalogSuggestCard } from "./catalog-suggest";
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

const popular = card({
  id: "popular",
  nameEn: "Radiant Charizard",
  nameJa: "かがやくリザードン",
  collectorNumber: "020/159",
  numberKey: "20",
  rarity: "Radiant Rare",
  finish: "Holo",
  listingCount: 80,
  setNameEn: "Crown Zenith",
  setCode: "swsh12.5",
  releaseDate: "2023-01-20",
});
const realMew = card({
  id: "real-mew",
  nameEn: "Mew ex",
  nameJa: "ミュウex",
  collectorNumber: "151/165",
  numberKey: "151",
  printRegion: "JP",
  rarity: "Double rare",
  finish: "Holo",
  listingCount: 0,
  setNameEn: "Pokémon Card 151",
  setNameJa: "ポケモンカード151",
  setCode: "SV2a",
  releaseDate: "2023-06-16",
});
const realEn = card({
  id: "real-en",
  nameEn: "Mew ex",
  collectorNumber: "193/165",
  numberKey: "193",
  printRegion: "WEST",
  rarity: "Ultra Rare",
  finish: "Holo",
  listingCount: 0,
  setNameEn: "151",
  setNameJa: "151",
  setCode: "sv03.5",
  releaseDate: "2023-09-22",
});
const other151 = card({
  id: "other-151",
  nameEn: "Mewtwo ex",
  collectorNumber: "151/128",
  numberKey: "151",
  rarity: "Special illustration rare",
  finish: "Holo",
  listingCount: 50,
  setNameEn: "30th Celebration",
  setCode: "30th",
  releaseDate: "2026-01-01",
});
const setHits = rankCatalogSuggestions([other151, popular, realMew, realEn], "Pokemon Card 151", 12);
assert(setHits.some((row) => row.id === "real-mew") && setHits.some((row) => row.id === "real-en"), "Pokemon Card 151 suggests both 151 sets");
assert(!setHits.some((row) => row.id === "other-151" || row.id === "popular"), "Pokemon Card 151 does not suggest unrelated #151 cards");
const pasted = rankCatalogSuggestions([popular, realMew], "2023 Pokemon SV2a JP #151 Mew ex Double Rare", 12);
assert(pasted[0]?.id === "real-mew" && pasted.every((row) => row.id !== "popular"), "a pasted new title ranks that card above a popular same-year card");
const oldPaste = rankCatalogSuggestions([popular, realMew], "2023 Pokemon Pokemon Card 151 #151 Mew ex - Holo", 12);
assert(oldPaste[0]?.id === "real-mew" && oldPaste.every((row) => row.id !== "popular"), "a pasted old title ranks that card above a popular same-year card");
const weak = rankCatalogSuggestions([popular, realEn, realMew], "Mew ex SV2a Super Rare", 12);
assert(weak[0]?.id === "real-mew" && weak.every((row) => row.id !== "popular" && row.id !== "real-en"), "a stale rarity still surfaces the SV2a Mew ex");
const enPaste = rankCatalogSuggestions([popular, realEn], "2023 Pokemon sv03.5 EN #193 Mew ex Ultra Rare", 12);
assert(enPaste.map((row) => row.id).join("|") === "real-en", "a pasted english title stays on that card");

const ranked = rankCatalogSuggestions([zard, quiet, hot], "pika", 2);
assert(ranked.map((row) => row.id).join("|") === "card_hot|card_quiet", "typeahead is hot-first within the name");
assert(rankCatalogSuggestions([zard, hot], "charizard", 12)[0]?.id === "card_zard", "an exact name stays first");

const linked = listingCatalogPrefill({
  ...card({
    id: "op01",
    nameEn: "Roronoa Zoro",
    collectorNumber: "OP01-001",
    numberKey: "1",
    printRegion: "WEST",
    rarity: "L",
    setNameEn: "Romance Dawn",
    setCode: "OP-01",
    releaseDate: "2022-12-02",
    game: "ONE_PIECE",
  }),
  game: "ONE_PIECE",
});
assert(linked.categorySlug === "one-piece" && linked.catalogCardId === "op01", "dex prefill keeps the catalog id and sell category");
assert(linked.catalogTitle.includes("OP-01") && linked.setName === "Romance Dawn" && linked.cardName === "Roronoa Zoro", "prefill summary uses the set code title and the set name");
assert(linked.language === "英文" && linked.collectorNumber === "OP01-001", "prefill keeps language and collector number");
assert(rankCatalogSuggestions([card({ id: "luffy", nameEn: "Monkey.D.Luffy", nameJa: "モンキー・D・ルフィ", game: "ONE_PIECE" }), zard], "路飛", 1)[0]?.id === "luffy", "路飛 suggests the one piece printing");

console.log("catalog suggest ok");
