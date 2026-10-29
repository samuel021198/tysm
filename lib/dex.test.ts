import { readFileSync } from "node:fs";
import {
  bilingualName,
  catalogAnchorMatches,
  catalogCardMatches,
  catalogNeedles,
  catalogSuggestWhere,
  catalogWhere,
  chooseDexSets,
  INGEST_POST_RESERVE_MS,
  ingestPastSoftDeadline,
  ingestPostDeadline,
  dexPath,
  listingDexLinks,
  namesMatch,
  nameKeys,
  numberKey,
  pickCatalogCard,
  runIngestPostSteps,
  usableCollectorNumber,
  type CatalogSearchCard,
  type DexLinkCard,
} from "./dex";
import { awsSigV4Authorization, sha256Hex } from "./r2";
import { catalogDisplayTitle, catalogTitleRewrite, finishLabel, legacyCatalogDisplayTitle, listingTitleFromCatalog, resolveEnglishCardName } from "./card-title";
import {
  cardImageUrl,
  collectorNumber,
  dexSetSettled,
  dexUnsettledRemaining,
  formatDexCursor,
  logoUrl,
  mapTcgdexCard,
  mapTcgdexSet,
  parseDexCursor,
  planDexBatch,
  usableSetResume,
  type DexQueueItem,
} from "./tcgdex";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(numberKey("020/189") === "20", "leading zeros drop");
assert(numberKey("４") === "4", "fullwidth digits");
assert(usableCollectorNumber("009/185") === "", "seed placeholder number ignored");
assert(usableCollectorNumber("020/189") === "20", "real printed number kept");

const charizard: DexLinkCard = {
  id: "c-new",
  nameEn: "Charizard",
  nameJa: "リザードン",
  numberKey: "6",
  printRegion: "JP",
  releaseDate: "2024-01-01",
  setNameEn: "Wild Force",
  setNameJa: "ワイルドフォース",
  setCode: "sv5K",
};
const charizard20: DexLinkCard = { ...charizard, id: "c-20", numberKey: "20", releaseDate: "2020-01-01", setNameEn: "Vivid Voltage", setNameJa: "仰天のボルテッカー", setCode: "s4" };
const pikachu: DexLinkCard = { ...charizard, id: "pika", nameEn: "Pikachu", nameJa: "ピカチュウ", numberKey: "25" };
const umbreon: DexLinkCard = { ...charizard, id: "umb", nameEn: "Umbreon", nameJa: "ブラッキー", numberKey: "95" };
const eevee: DexLinkCard = { ...charizard, id: "eev", nameEn: "Eevee", nameJa: "イーブイ", numberKey: "133" };

const zardListing = {
  id: "seed_charizard",
  title: "噴火龍 VMAX Charizard",
  cardName: "噴火龍",
  setName: "仰天峰",
  cardNumber: "020/189",
  language: "日文",
};
assert(pickCatalogCard(zardListing, [charizard, charizard20, pikachu])?.id === "c-20", "number picks the charizard");
assert(pickCatalogCard({ ...zardListing, cardNumber: "001/185", setName: "其他" }, [charizard, charizard20])?.id === "c-new", "newer charizard wins a tie");
assert(pickCatalogCard({ ...zardListing, title: "皮卡丘", cardName: "皮卡丘", cardNumber: null, setName: null }, [charizard, pikachu])?.id === "pika", "pikachu alias");
assert(
  !namesMatch(nameKeys("伊布"), nameKeys("Umbreon ブラッキー")),
  "eevee does not match umbreon",
);
assert(pickCatalogCard({ id: "u", title: "月亮伊布", cardName: "月亮伊布", setName: null, cardNumber: null, language: "日文" }, [eevee, umbreon])?.id === "umb", "umbreon alias");
assert(catalogNeedles("噴火龍").includes("charizard"), "zh search expands to english");
assert(catalogNeedles("リザードン").includes("charizard"), "ja search expands to english");

const picked = chooseDexSets(
  [
    { id: "new", total: 180, releaseDate: "2026-01-01" },
    { id: "mid", total: 180, releaseDate: "2025-06-01" },
    { id: "old", total: 90, releaseDate: "2024-01-01" },
  ],
  2,
  250,
);
assert(picked.map((set) => set.id).join(",") === "new,mid", "two recent sets share the budget");
const one = chooseDexSets(
  [
    { id: "huge", total: 300, releaseDate: "2026-02-01" },
    { id: "small", total: 40, releaseDate: "2025-01-01" },
  ],
  2,
  250,
);
assert(one.map((set) => set.id).join(",") === "huge", "newest set fills the budget");

function queueItem(externalId: string, total = 80): DexQueueItem {
  const lang = externalId.startsWith("en:") ? "en" : "ja";
  return {
    lang,
    id: externalId.slice(lang.length + 1),
    externalId,
    name: externalId,
    total,
    official: total,
    releaseDate: "2024-01-01",
    serieId: "SV",
    order: 0,
  };
}

const dexQueue = ["ja:s1", "ja:s2", "ja:s3", "ja:s4", "en:s5", "en:s6"].map((id) => queueItem(id));
const opened: string[] = [];
let resumeCursor: string | null = null;
for (let batch = 0; batch < 3; batch += 1) {
  const plan = planDexBatch(dexQueue, { cursor: resumeCursor, settled: new Set(opened), maxSets: 2 });
  assert(plan.steps.length === 2, "each batch opens two sets");
  for (const step of plan.steps) opened.push(step.item.externalId);
  resumeCursor = formatDexCursor(plan.steps[1]!.item.externalId, null);
}
assert(opened.join(",") === "ja:s1,ja:s2,ja:s3,ja:s4,en:s5,en:s6", "resume advances past the first 2 sets");
assert(opened[2] === "ja:s3" && opened[3] === "ja:s4", "second batch is the third and fourth sets");

const skipped = planDexBatch(dexQueue, { cursor: null, settled: new Set(["ja:s1", "ja:s2"]), maxSets: 2 });
assert(skipped.skippedSettled === 2 && skipped.steps.map((step) => step.item.externalId).join(",") === "ja:s3,ja:s4", "stored sets do not consume the batch");
const mid = planDexBatch(dexQueue, { cursor: "ja:s3#40", settled: new Set(["ja:s1", "ja:s2"]), maxSets: 2 });
assert(mid.steps[0]?.item.externalId === "ja:s3" && mid.steps[0].cardOffset === 40, "mid-set cursor stays on that set");
assert(mid.steps[1]?.item.externalId === "ja:s4" && mid.steps[1].cardOffset === 0, "the following set starts at the first card");
assert(parseDexCursor("ja:SV10")?.cardOffset === null && parseDexCursor("ja:SV10#80")?.cardOffset === 80, "cursor keeps a finished set distinct from an offset");
assert(formatDexCursor("en:sv03.5", null) === "en:sv03.5" && formatDexCursor("en:sv03.5", 0) === "en:sv03.5#0", "offset 0 is still on the set");
assert(dexSetSettled({ total: 100 }, undefined) === false, "missing set is not settled");
assert(dexSetSettled({ total: 100 }, { count: 100, total: 100 }), "full card count is settled");
assert(dexSetSettled({ total: 100 }, { count: 40, total: 100 }) === false, "partial set stays open");
assert(dexSetSettled({ total: 100 }, { count: 0, total: 0 }), "empty payload marker is settled");
assert(dexUnsettledRemaining(dexQueue, new Set(["ja:s1", "ja:s2"]), "ja:s2") === 4, "remaining starts after a finished cursor");
assert(planDexBatch(dexQueue, { cursor: "en:s6", settled: new Set(dexQueue.map((row) => row.externalId)), maxSets: 2 }).done, "cursor past the end is done");

const setRef = { externalId: "ja:SV10", code: "SV10", printRegion: "JP" as const, serieId: "SV", official: 98 };
const ja = mapTcgdexCard(
  { id: "SV10-001", localId: "001", name: "リザードン", image: "https://assets.tcgdex.net/ja/SV/SV10/001" },
  setRef,
  "ja",
);
assert(ja?.nameJa === "リザードン" && ja.nameEn === "Charizard", "ja charizard fills english from alias");
const zardZh = mapTcgdexCard(
  { id: "x-1", localId: "1", name: "噴火龍" },
  { externalId: "ja:x", code: "x", printRegion: "JP", serieId: "x", official: 10 },
  "ja",
);
assert(zardZh?.nameEn === "Charizard", "chinese alias still fills when the lexicon misses");
assert(ja?.collectorNumber === "001/098" && ja.numberKey === "1", "printed number and key");
assert(ja?.externalId === "ja:SV10-001", "language prefix on card id");
assert(ja?.sourceImageUrl === "https://assets.tcgdex.net/ja/SV/SV10/001/high.webp", "bare tcgdex image gets high.webp");
assert(mapTcgdexCard({ id: "M6-001", localId: "001", name: "ヘラクロス" }, setRef, "ja")?.sourceImageUrl === "", "missing image is not guessed");

const en = mapTcgdexCard(
  { id: "sv08-001", localId: "001", name: "Pikachu", image: "https://assets.tcgdex.net/en/sv/sv08/001" },
  { externalId: "en:sv08", code: "sv08", printRegion: "WEST", serieId: "sv", official: 86 },
  "en",
);
assert(en?.sourceImageUrl.endsWith("/high.webp"), "bare tcgdex image gets high.webp");
assert(en?.nameEn === "Pikachu" && en.nameJa === "ピカチュウ", "english pikachu fills japanese from alias");

const chiko = mapTcgdexCard(
  { id: "sv2a-001", localId: "001", name: "チコリータ" },
  { externalId: "ja:sv2a", code: "sv2a", printRegion: "JP", serieId: "SV", official: 165 },
  "ja",
);
assert(chiko?.nameEn === "Chikorita" && chiko.nameJa === "チコリータ", "ja chikorita resolves to english");
const unknown = mapTcgdexCard(
  { id: "sv2a-999", localId: "999", name: "未翻訳カード" },
  { externalId: "ja:sv2a", code: "sv2a", printRegion: "JP", serieId: "SV", official: 165 },
  "ja",
);
assert(unknown?.nameEn === "未翻訳カード" && unknown.nameJa === "未翻訳カード", "unknown name stays in both fields");
assert(unknown?.finish === null, "missing variants omit finish");

const set = mapTcgdexSet(
  {
    id: "M1S",
    name: "メガシンフォニア",
    releaseDate: "2025-08-01",
    logo: "https://assets.tcgdex.net/ja/M/M1S/logo",
    serie: { id: "M", name: "MEGA" },
    cardCount: { official: 63, total: 92 },
    cards: [{ id: "M1S-003", localId: "003", name: "リザードン" }],
  },
  "ja",
);
assert(set?.code === "M1S" && set.externalId === "ja:M1S" && set.releaseDate === "2025-08-01", "set code and date");
assert(set?.nameJa === "メガシンフォニア" && set.nameEn === "Mega Symphonia", "jp set uses the english name");
assert(set?.cards.length === 1 && set.logoUrl?.endsWith(".webp"), "set cards and logo");

assert(!usableSetResume({ id: "mep", name: "Promos", total: 30, official: 0 }), "official 0 skipped");
assert(!usableSetResume({ id: "MC", name: "Mega deck", total: 774, official: 100 }), "huge deck skipped");
assert(!usableSetResume({ id: "svp", name: "SVP Black Star Promos", total: 50, official: 50 }), "promo name skipped");
assert(!usableSetResume({ id: "tcgp", name: "Pocket", total: 100, official: 100 }), "pocket skipped");
assert(usableSetResume({ id: "M1S", name: "メガシンフォニア", total: 92, official: 63 }), "physical set kept");

const ex = bilingualName("Charizard ex", "WEST");
assert(ex.nameJa === "リザードン" && ex.nameEn === "Charizard ex", "suffix alias keeps printed english");
assert(cardImageUrl("https://assets.tcgdex.net/en/sv/sv08/001.png").endsWith(".png"), "image with extension stays");
assert(cardImageUrl("") === "", "empty image stays empty");
assert(collectorNumber("003", 63) === "003/063", "official padded to local id");

const psy = mapTcgdexCard(
  {
    id: "lc-88",
    localId: "88",
    name: "Psyduck",
    variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
  },
  { externalId: "en:lc", code: "lc", printRegion: "WEST", serieId: "lc", official: 110 },
  "en",
);
assert(psy?.finish === "Reverse Foil" && psy.collectorNumber === "88/110", "reverse foil is called out");
assert(
  catalogDisplayTitle({
    releaseDate: "2002-05-24",
    setCode: "lc",
    printRegion: "WEST",
    collectorNumber: psy?.collectorNumber,
    cardName: psy?.nameEn,
    rarity: psy?.rarity,
  }) === "2002 Pokemon lc EN #88 Psyduck",
  "psyduck title uses the set code and omits finish",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2002-05-24",
    setCode: "lc",
    printRegion: "WEST",
    collectorNumber: "088/110",
    cardName: "PSYDUCK",
    rarity: "NONE",
  }) === "2002 Pokemon lc EN #88 Psyduck",
  "shouting names become title case and None rarity is omitted",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2023-06-16",
    setCode: "SV2a",
    printRegion: "JP",
    collectorNumber: "193/165",
    cardName: "Mew ex",
    rarity: "Super Rare",
  }) === "2023 Pokemon SV2a JP #193 Mew ex Super Rare",
  "japanese mew uses set code, JP, and rarity",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2023-06-16",
    setCode: "sv04.5",
    printRegion: "WEST",
    collectorNumber: "006/091",
    cardName: "Charizard ex",
    rarity: "Double rare",
  }) === "2023 Pokemon sv04.5 EN #6 Charizard ex Double Rare",
  "english print keeps the stored set code and title-cases rarity",
);
assert(
  legacyCatalogDisplayTitle({
    releaseDate: "2023-06-16",
    setName: "Pokémon Card 151",
    collectorNumber: "193/165",
    cardName: "Mew ex",
    finish: "Holo",
  }) === "2023 Pokemon Pokemon Card 151 #193 Mew ex - Holo",
  "legacy title still matches the old stored string",
);

const mega = mapTcgdexCard(
  {
    id: "M6-009",
    localId: "009",
    name: "メガグソクムシャex",
    dexId: [768],
    variants: { firstEdition: false, holo: true, normal: false, reverse: false, wPromo: false },
  },
  { externalId: "ja:M6", code: "M6", printRegion: "JP", serieId: "M", official: 76 },
  "ja",
);
assert(mega?.nameEn === "Mega Golisopod ex" && mega.nameJa === "メガグソクムシャex" && mega.finish === "Holo", "mega ex keeps suffix and holo");
assert(
  catalogDisplayTitle({
    releaseDate: "2026-07-31",
    setCode: "M6",
    printRegion: "JP",
    collectorNumber: mega?.collectorNumber,
    cardName: mega?.nameEn,
    rarity: "Double rare",
  }) === "2026 Pokemon M6 JP #9 Mega Golisopod ex Double Rare",
  "japanese mega title uses rarity not holo",
);
assert(resolveEnglishCardName("ヒートロトム", [479]) === "Heat Rotom", "rotom form prefix");
assert(resolveEnglishCardName("リザードンex", [6]) === "Charizard ex", "suffix reattaches after the species");
assert(resolveEnglishCardName("ぼうけんのランタン") === "Adventure Lantern", "trainer lexicon");
assert(finishLabel({ normal: true, holo: false, reverse: false, firstEdition: false }) === null, "normal omits finish");
assert(finishLabel({ normal: false, holo: true, reverse: true, firstEdition: true }) === "First Edition Holo", "first edition holo stacks");
assert(
  catalogDisplayTitle({
    releaseDate: "1999-01-09",
    setCode: "base1",
    printRegion: "WEST",
    collectorNumber: "4/102",
    cardName: "Charizard",
    rarity: null,
  }) === "1999 Pokemon base1 EN #4 Charizard",
  "missing rarity omits the rarity token",
);
const mewRewrite = catalogTitleRewrite({
  releaseDate: "2023-06-16",
  setName: "Pokemon Card 151",
  setCode: "SV2a",
  printRegion: "JP",
  collectorNumber: "193/165",
  cardName: "Mew ex",
  finish: "Holo",
  rarity: "Super Rare",
});
assert(mewRewrite.listingTitle === "2023 Pokemon SV2a JP #193 Mew ex Super Rare", "rewrite listing title uses the new format");
assert(
  mewRewrite.previousListingTitles.includes("2023 Pokemon Pokemon Card 151 #193 Mew ex - Holo"),
  "rewrite recognizes the old listing title",
);
const longTitle = listingTitleFromCatalog({
  releaseDate: "2024-01-01",
  setCode: "sv04.5",
  printRegion: "WEST",
  collectorNumber: "12",
  cardName: "Koraidon ex With A Very Long Marketplace Name Indeed Extra",
  rarity: "Special Illustration Rare",
});
assert(longTitle.length <= 80 && longTitle.includes("EN") && longTitle.includes("Koraidon"), "listing title stays within 80 and keeps lang and name");
assert(!longTitle.includes(" - "), "listing title has no finish dash");
const trimmedCode = listingTitleFromCatalog(
  {
    releaseDate: "2024-01-01",
    setCode: "sv04.5",
    printRegion: "WEST",
    collectorNumber: "12",
    cardName: "Koraidon ex",
    rarity: "Special Illustration Rare",
  },
  36,
);
assert(trimmedCode.length <= 36 && trimmedCode.includes("EN") && trimmedCode.includes("Koraidon ex"), "tight listing keeps the language tag and card name");
assert(trimmedCode.includes("…") && !trimmedCode.includes("sv04.5"), "tight listing shortens the set code after rarity");
const mewSearch: CatalogSearchCard = {
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
  series: "Scarlet & Violet",
  releaseDate: "2023-06-16",
};
const fatesSearch: CatalogSearchCard = {
  nameEn: "Charizard ex",
  nameJa: "リザードンex",
  collectorNumber: "006/091",
  numberKey: "6",
  printRegion: "WEST",
  rarity: "Double Rare",
  finish: "Holo",
  setNameEn: "Paldean Fates",
  setNameJa: "パルデアの運命",
  setCode: "sv4.5",
  series: "Scarlet & Violet",
  releaseDate: "2024-01-26",
};
assert(catalogCardMatches(fatesSearch, "Paldean Fates"), "old set name still matches");
assert(catalogCardMatches(fatesSearch, "Holo") && !catalogCardMatches(mewSearch, "Paldean Fates"), "finish matches and set name does not bleed");
assert(catalogCardMatches(mewSearch, "SV2a") && catalogCardMatches(mewSearch, "Super Rare"), "set code and rarity match");
assert(catalogCardMatches(mewSearch, "2023 Pokemon Pokemon Card 151 #193 Mew ex - Holo"), "old ebay-style title matches stored fields");
assert(catalogCardMatches(mewSearch, "2023 Pokemon SV2a JP #193 Mew ex Super Rare"), "new title matches the same card");
assert(catalogCardMatches(mewSearch, "JP") && !catalogCardMatches(mewSearch, "EN"), "language token follows print region");
assert(JSON.stringify(catalogWhere("Holo", null)).includes("finish"), "dex search looks at finish");
assert(JSON.stringify(catalogWhere("Super Rare", null)).includes("rarity"), "dex search looks at rarity");
assert(JSON.stringify(catalogWhere("SV2a", null)).includes("code"), "dex search looks at set code");
assert(JSON.stringify(catalogWhere("Paldean Fates", null)).includes("AND"), "multi-word dex search requires each token");

const mewJp: CatalogSearchCard = {
  nameEn: "Mew ex",
  nameJa: "ミュウex",
  collectorNumber: "151/165",
  numberKey: "151",
  printRegion: "JP",
  rarity: "Double rare",
  finish: "Holo",
  setNameEn: "Pokémon Card 151",
  setNameJa: "ポケモンカード151",
  setCode: "SV2a",
  series: "スカーレット&バイオレット",
  releaseDate: "2023-06-16",
};
const mewEn: CatalogSearchCard = {
  ...mewJp,
  collectorNumber: "193/165",
  numberKey: "193",
  printRegion: "WEST",
  rarity: "Ultra Rare",
  setNameEn: "151",
  setNameJa: "151",
  setCode: "sv03.5",
  series: "Scarlet & Violet",
  releaseDate: "2023-09-22",
};
const other151: CatalogSearchCard = {
  ...mewJp,
  nameEn: "Mewtwo ex",
  nameJa: "ミュウツーex",
  collectorNumber: "151/128",
  numberKey: "151",
  printRegion: "WEST",
  rarity: "Special illustration rare",
  setNameEn: "30th Celebration",
  setNameJa: "30th Celebration",
  setCode: "30th",
  releaseDate: "2026-01-01",
};
const eevee151: CatalogSearchCard = {
  ...mewEn,
  nameEn: "Eevee",
  nameJa: "イーブイ",
  collectorNumber: "133/165",
  numberKey: "133",
  rarity: "Common",
  finish: null,
};
assert(catalogCardMatches(fatesSearch, "Holo Charizard") && !catalogCardMatches(mewJp, "Holo Charizard"), "Holo Charizard stays on that card");
assert(catalogCardMatches({ ...fatesSearch, finish: "Reverse Foil" }, "Reverse Foil"), "reverse foil finish matches");
assert(catalogCardMatches(mewJp, "Pokemon Card 151") && catalogCardMatches(mewEn, "Pokemon Card 151"), "Pokemon Card 151 hits both 151 sets");
assert(catalogCardMatches(eevee151, "Pokemon Card 151") && !catalogCardMatches(other151, "Pokemon Card 151"), "set phrase matches the set, not every #151");
assert(catalogCardMatches(mewJp, "Pokemon Card") && catalogCardMatches(mewJp, "Pokémon Card 151"), "stop words still match the accented set name");
assert(!catalogCardMatches(other151, "Pokemon Card"), "Pokemon Card does not match an unrelated set");
assert(catalogCardMatches(mewJp, "ポケモンカード151") && catalogCardMatches(mewJp, "Mew ex SV2a"), "ja set name and set code still match");
assert(catalogCardMatches(mewEn, "sv03.5") && catalogCardMatches(mewEn, "EN") && !catalogCardMatches(mewEn, "JP"), "english set code and language match");
assert(catalogCardMatches(mewJp, "Double Rare") && catalogCardMatches(mewEn, "Ultra Rare"), "stored rarity still matches");
assert(catalogCardMatches(mewJp, "2023 Pokemon Pokemon Card 151 #151 Mew ex - Holo"), "old title matches the ingested JP Mew ex");
assert(catalogCardMatches(mewEn, "2023 Pokemon 151 #193 Mew ex - Holo"), "old title matches the ingested EN Mew ex");
assert(catalogCardMatches(mewJp, "2023 Pokemon SV2a JP #151 Mew ex Double Rare"), "new title matches the ingested JP Mew ex");
assert(catalogCardMatches(mewEn, "2023 Pokemon sv03.5 EN #193 Mew ex Ultra Rare"), "new title matches the ingested EN Mew ex");
assert(!catalogCardMatches(mewJp, "Mew ex SV2a Super Rare") && catalogAnchorMatches(mewJp, "Mew ex SV2a Super Rare"), "wrong rarity does not erase the name and set");
const phraseWhere = JSON.stringify(catalogWhere("Pokemon Card 151", null));
assert(!phraseWhere.includes("numberKey") && phraseWhere.includes("nameEn"), "Pokemon Card 151 searches set names, not collector numbers");
assert(JSON.stringify(catalogWhere("151", null)).includes("numberKey"), "a bare 151 still searches collector numbers");
assert(JSON.stringify(catalogWhere("Pokemon Card", null)).includes("Pokémon"), "Pokemon Card searches the accented set name");
assert(JSON.stringify(catalogWhere("#151", null)).includes("numberKey"), "a hash number stays a collector number");
const loose = JSON.stringify(catalogSuggestWhere("Mew ex SV2a Super Rare"));
assert(loose.includes("SV2a") && !loose.includes("Super"), "suggest keeps the set code and does not require a stale rarity");
const jpSuggest = JSON.stringify(catalogSuggestWhere("Mew ex", "JP"));
assert(jpSuggest.includes('"printRegion":"JP"'), "suggest where honors the dex region chip");
assert(!JSON.stringify(catalogSuggestWhere("Mew ex")).includes("printRegion"), "suggest where stays open when no region is set");
const dexToolbar = readFileSync("components/dex-toolbar.tsx", "utf8");
const dexPage = readFileSync("components/dex-browser.tsx", "utf8");
const dexRoutes = [readFileSync("app/dex/page.tsx", "utf8"), readFileSync("app/dex/search/page.tsx", "utf8"), readFileSync("app/dex/[id]/page.tsx", "utf8")].join("\n");
const dexDetail = readFileSync("components/dex-market-panel.tsx", "utf8");
assert(dexRoutes.includes('permanentRedirect("/find")') && !dexRoutes.includes("DexBrowser") && !dexRoutes.includes("睇圖鑑"), "dex routes open search");
assert(dexPage.includes("<DexRail"), "dex browse picks a game, then its sets");
assert(dexPage.includes("history.replaceState"), "game switches stay on the mounted dex shell");
assert(dexPage.includes("grid-cols-3") || readFileSync("components/dex-grid.tsx", "utf8").includes("grid-cols-3"), "dex tiles are three-up on a phone");
assert(dexDetail.includes("暫未有背景故事") && dexDetail.includes("放售") && dexDetail.includes("暫未有市場數據"), "story, sales, and empty market state");
assert(dexDetail.includes("呢個遊戲暫時未有行情"), "non-pokemon market copy is intentional");
assert(dexDetail.includes("我要放售呢張") && dexDetail.includes("catalogCardId"), "dex detail opens sell with the catalog card");
assert(!dexDetail.includes("加入收藏") && !dexDetail.includes("collectCatalogCard") && !dexDetail.includes("已加入收藏"), "dex collect stays hidden");
assert(listingDexLinks({ catalogCardId: null, items: [] }).length === 0, "an unlinked listing has no dex target");
assert(dexPath("  ") === null && dexPath("card_mew") === "/dex/card_mew", "dex path needs an id");
assert(
  listingDexLinks({
    catalogCardId: "card_mew",
    cardName: "Mew",
    items: [{ catalogCardId: "card_mew" }, { catalogCardId: "card_pika", cardName: "Pikachu" }],
  }).map((link) => link.id).join("|") === "card_mew|card_pika",
  "listing and item links stay unique",
);
const listingPage = readFileSync("app/listing/[id]/page.tsx", "utf8");
const postPage = readFileSync("app/post/[id]/page.tsx", "utf8");
const sellFromCollection = postPage + readFileSync("components/collection-menu.tsx", "utf8");
const sellPage = readFileSync("app/sell/page.tsx", "utf8");
const sellForm = readFileSync("components/sell-form.tsx", "utf8");
assert(!listingPage.includes("睇圖鑑") && !listingPage.includes("/dex") && !listingPage.includes("listingDexLinks"), "listing detail does not link into the dex");
assert(!readFileSync("components/listing-card.tsx", "utf8").includes("睇圖鑑") && !readFileSync("components/listing-card.tsx", "utf8").includes("/dex"), "listing cards do not offer the dex");
assert(sellFromCollection.includes("放賣") && sellFromCollection.includes("collectionItemId") && sellFromCollection.includes("catalogCardId") && postPage.includes("!post.collectionItem.listingId"), "collection sell still binds the item and skips a card that is already listed");
assert(!readFileSync("components/profile-board.tsx", "utf8").includes("collectionItemId"), "the profile grid no longer sells from an owned card");
assert(sellPage.includes("collectionItemId") && sellForm.includes('name="collectionItemId"'), "publishing a collection item writes the listing back");
assert(sellPage.includes("prefill?.catalogCardId") && !sellPage.includes("categoryId ? prefill"), "dex prefill keeps the catalog id when the category slug is missing");
assert(sellForm.includes("catalogCardId: card.catalogId"), "a picked catalog card is submitted with the listing");
assert(dexDetail.includes("loadSnkrMarket") && dexDetail.includes("formatJpy") && !dexDetail.includes("GBP"), "detail prices are SNKRDUNK yen");
assert(dexToolbar.includes("/api/catalog/suggest?"), "dex search reuses catalog suggest");
assert(dexToolbar.includes('params.set("region", current)'), "dex suggestions pass the region chip");
assert(dexToolbar.includes("/dex/${hit.id}"), "a suggestion opens the dex card");
assert(dexToolbar.includes('method="get"'), "enter still submits the dex search form");
assert(JSON.stringify(catalogWhere("Mew ex SV2a Super Rare", null)).includes("Super"), "dex search still requires each rarity word");
assert(logoUrl("https://assets.tcgdex.net/en/sv/sv08/logo") === "https://assets.tcgdex.net/en/sv/sv08/logo.webp", "logo webp");

const payload = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const canonical = [
  "GET",
  "/",
  "Action=ListUsers&Version=2010-05-08",
  "content-type:application/x-www-form-urlencoded; charset=utf-8",
  "host:iam.amazonaws.com",
  "x-amz-date:20150830T123600Z",
  "",
  "content-type;host;x-amz-date",
  payload,
].join("\n");
assert(sha256Hex(canonical) === "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59", "aws canonical hash");
const auth = awsSigV4Authorization({
  method: "GET",
  path: "/",
  query: "Action=ListUsers&Version=2010-05-08",
  headers: {
    host: "iam.amazonaws.com",
    "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    "x-amz-date": "20150830T123600Z",
  },
  payloadHash: payload,
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "iam",
  amzDate: "20150830T123600Z",
});
assert(auth.endsWith("Signature=33f5dad2191de0cb4b7ab912f876876c2c4f72e2991a458f9499233c7b992438"), "sigv4 signature");

assert(ingestPastSoftDeadline(20_000, 24_000, 6_000), "first set pauses inside the chunk reserve before any card is written");
assert(!ingestPastSoftDeadline(1_000, 24_000, 6_000), "chunk still starts while the reserve is intact");
assert(ingestPostDeadline(false, 0, 240_000, INGEST_POST_RESERVE_MS) === null, "mid-ingest batch does not get a link budget");
assert(ingestPostDeadline(true, 230_000, 240_000, INGEST_POST_RESERVE_MS) === null, "done batch skips linking inside the post reserve");
assert(ingestPostDeadline(true, 10_000, 240_000, INGEST_POST_RESERVE_MS) === 225_000, "linking stops 15s before the soft deadline");

const ingestRoute = readFileSync("app/api/internal/ingest-dex/route.ts", "utf8");
const ingestSource = readFileSync("lib/dex-ingest.ts", "utf8");
assert(/export const maxDuration = 300;/.test(ingestRoute), "ingest route maxDuration is 300");
assert(/const INGEST_DEADLINE_MS = 240_000;/.test(ingestRoute) && /deadlineMs: INGEST_DEADLINE_MS/.test(ingestRoute), "soft deadline is 240s, under maxDuration");
assert(
  ingestRoute.includes("backfillCatalogTitles({ deadlineMs: INGEST_DEADLINE_MS, cursor: options.cursor })"),
  "title backfill uses the soft deadline",
);
assert(ingestSource.includes("catalogTitleRewrite") && ingestSource.includes("updateMany"), "title backfill rewrites stored titles in batches");
assert(ingestSource.includes("TITLE_BACKFILL_RESERVE_MS"), "title backfill stops before the soft deadline");
assert(ingestSource.includes("link: (until) => linkCatalogListings({ deadlineMs: until })"), "linking is the post-step callback");
assert(!ingestSource.includes("await linkCatalogListings("), "ingest does not await linking directly");

async function assertIngestPostSteps() {
  {
    let links = 0;
    let fills = 0;
    const skipped = await runIngestPostSteps({
      done: false,
      deadline: 240_000,
      now: () => 0,
      link: async () => {
        links += 1;
        return { listings: 9, collectionItems: 9 };
      },
      backfill: async () => {
        fills += 1;
      },
    });
    assert(links === 0 && fills === 0 && skipped.listings === 0 && skipped.collectionItems === 0, "mid-ingest batch does not link");
  }

  {
    let calls = 0;
    const tight = await runIngestPostSteps({
      done: true,
      deadline: 240_000,
      now: () => 230_000,
      link: async () => {
        calls += 1;
        return { listings: 1, collectionItems: 1 };
      },
      backfill: async () => {
        calls += 1;
      },
    });
    assert(calls === 0 && tight.listings === 0 && tight.collectionItems === 0, "done batch does not link when the reserve is gone");
  }

  {
    let fills = 0;
    let linkDeadline = 0;
    const ran = await runIngestPostSteps({
      done: true,
      deadline: 240_000,
      now: () => 1_000,
      backfill: async (until) => {
        fills += 1;
        assert(until === 240_000 - INGEST_POST_RESERVE_MS, "backfill receives the post-step deadline");
      },
      link: async (until) => {
        linkDeadline = until;
        return { listings: 4, collectionItems: 2 };
      },
    });
    assert(fills === 1 && linkDeadline === 225_000 && ran.listings === 4 && ran.collectionItems === 2, "done batch with time links once");
  }

  {
    let links = 0;
    let tick = 0;
    const after = await runIngestPostSteps({
      done: true,
      deadline: 100_000,
      reserveMs: 15_000,
      now: () => (tick === 0 ? 0 : 90_000),
      backfill: async () => {
        tick += 1;
      },
      link: async () => {
        links += 1;
        return { listings: 1, collectionItems: 0 };
      },
    });
    assert(tick === 1 && links === 0 && after.listings === 0 && after.collectionItems === 0, "linking does not start after backfill uses the reserve");
  }
}

assertIngestPostSteps()
  .then(() => {
    console.log("dex tests ok");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
