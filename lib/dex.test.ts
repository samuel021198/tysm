import {
  bilingualName,
  catalogNeedles,
  chooseDexSets,
  namesMatch,
  nameKeys,
  numberKey,
  pickCatalogCard,
  usableCollectorNumber,
  type DexLinkCard,
} from "./dex";
import { awsSigV4Authorization, sha256Hex } from "./r2";
import { catalogDisplayTitle, finishLabel, listingTitleFromCatalog, resolveEnglishCardName } from "./card-title";
import { cardImageUrl, collectorNumber, logoUrl, mapTcgdexCard, mapTcgdexSet, usableSetResume } from "./tcgdex";

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
    setName: "Legendary Collection",
    collectorNumber: psy?.collectorNumber,
    cardName: psy?.nameEn,
    finish: psy?.finish,
  }) === "2002 Pokemon Legendary Collection #88 Psyduck - Reverse Foil",
  "psyduck marketplace title",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2002-05-24",
    setName: "LEGENDARY COLLECTION",
    collectorNumber: "088/110",
    cardName: "PSYDUCK",
    finish: "REVERSE FOIL",
  }) === "2002 Pokemon Legendary Collection #88 Psyduck - Reverse Foil",
  "shouting names become title case",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2023-06-16",
    setName: "Pokémon Card 151",
    collectorNumber: "001/165",
    cardName: "Bulbasaur",
  }) === "2023 Pokemon Pokemon Card 151 #1 Bulbasaur",
  "accented pokemon in the set name is plain english",
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
    setName: "Storm Emeralda",
    collectorNumber: mega?.collectorNumber,
    cardName: mega?.nameEn,
    finish: mega?.finish,
  }) === "2026 Pokemon Storm Emeralda #9 Mega Golisopod ex - Holo",
  "japanese mega title",
);
assert(resolveEnglishCardName("ヒートロトム", [479]) === "Heat Rotom", "rotom form prefix");
assert(resolveEnglishCardName("リザードンex", [6]) === "Charizard ex", "suffix reattaches after the species");
assert(resolveEnglishCardName("ぼうけんのランタン") === "Adventure Lantern", "trainer lexicon");
assert(finishLabel({ normal: true, holo: false, reverse: false, firstEdition: false }) === null, "normal omits finish");
assert(finishLabel({ normal: false, holo: true, reverse: true, firstEdition: true }) === "First Edition Holo", "first edition holo stacks");
assert(
  catalogDisplayTitle({
    releaseDate: "1999-01-09",
    setName: "Base Set",
    collectorNumber: "4/102",
    cardName: "Charizard",
    finish: null,
  }) === "1999 Pokemon Base Set #4 Charizard",
  "normal charizard omits finish",
);
const longTitle = listingTitleFromCatalog({
  releaseDate: "2024-01-01",
  setName: "Ancient Koraidon ex Starter Deck & Build Set Extra Words",
  collectorNumber: "12",
  cardName: "Koraidon ex",
  finish: "Reverse Foil",
});
assert(longTitle.length <= 80 && longTitle.includes("Koraidon ex") && longTitle.endsWith("- Reverse Foil"), "listing title stays within 80");
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

console.log("dex tests ok");
