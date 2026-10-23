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
assert(chiko?.nameEn === "チコリータ" && chiko.nameJa === "チコリータ", "unknown name stays in both fields");

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
assert(set?.nameJa === "メガシンフォニア" && set.nameEn === "メガシンフォニア", "set name has no alias");
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
