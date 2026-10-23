import {
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
import { fillMissingNames, mapScrydexCard, mapScrydexExpansion, parseScrydexPage } from "./scrydex";

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

const ja = mapScrydexCard(
  {
    id: "sv10_ja-1",
    name: "クヌギダマ",
    number: "1",
    printed_number: "001/098",
    rarity: "通常",
    artist: "YASHIRO Nanaco",
    language_code: "JA",
    images: [{ type: "front", large: "https://images.scrydex.com/pokemon/sv10_ja-1/large" }],
    expansion: { id: "sv10_ja", language_code: "JA" },
    translation: { en: { name: "Pineco" } },
  },
  "JP",
  "sv10_ja",
);
assert(ja?.nameJa === "クヌギダマ" && ja.nameEn === "Pineco", "ja card keeps both names");
assert(ja?.collectorNumber === "001/098" && ja.numberKey === "1", "printed number and key");
assert(ja?.sourceImageUrl.startsWith("https://images.scrydex.com/"), "scrydex image");

const en = mapScrydexCard(
  {
    id: "me55-3",
    name: "Volbeat",
    number: "3",
    printed_number: "003/086",
    language_code: "EN",
    images: [{ type: "front", medium: "https://images.scrydex.com/pokemon/me55-3/medium" }],
    expansion: { id: "me55", name: "Mega Evolution" },
  },
  "WEST",
  "me55",
);
assert(en?.nameEn === "Volbeat" && en.nameJa === "Volbeat", "english card without ja yet");
const [filledEn] = fillMissingNames([
  ja!,
  en!,
  {
    ...en!,
    externalId: "ja-pika",
    nameEn: "Pikachu",
    nameJa: "ピカチュウ",
    printRegion: "JP",
  },
  { ...en!, externalId: "en-pika", nameEn: "Pikachu", nameJa: "Pikachu", printRegion: "WEST" },
]);
assert(filledEn?.nameEn === "Pineco", "ja card unchanged by fill");
const pika = fillMissingNames([
  { ...en!, externalId: "ja-pika", nameEn: "Pikachu", nameJa: "ピカチュウ", printRegion: "JP" },
  { ...en!, externalId: "en-pika", nameEn: "Pikachu", nameJa: "Pikachu", printRegion: "WEST" },
]).find((card) => card.externalId === "en-pika");
assert(pika?.nameJa === "ピカチュウ", "english card borrows the japanese name");

const expansion = mapScrydexExpansion(
  {
    id: "m1s_ja",
    name: "メガシンフォニア",
    code: "M1S",
    series: "Mega Evolution",
    total: 92,
    language_code: "JA",
    release_date: "2025/08/01",
    is_online_only: false,
    logo: "https://images.scrydex.com/pokemon/m1s_ja-logo/logo",
    translation: { en: { name: "Mega Symphonia" } },
  },
  "JP",
);
assert(expansion?.nameJa === "メガシンフォニア" && expansion.nameEn === "Mega Symphonia", "expansion names");
assert(expansion?.releaseDate === "2025-08-01" && expansion.code === "M1S", "release date and code");
assert(parseScrydexPage({ data: [{ id: "a" }], pageSize: 100, totalCount: 2 }).totalCount === 2, "page envelope");

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
