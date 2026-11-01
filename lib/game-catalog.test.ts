import { readFileSync } from "node:fs";
import { POST as postSeedWave1 } from "../app/api/internal/seed-wave1/route";
import { catalogDisplayTitle, catalogTitleFromCard, rarityTitle } from "./card-title";
import { catalogRemaining, catalogSetSettled, planCatalogSteps } from "./catalog-batch";
import { catalogImageSrc, catalogTileSrc, isR2PublicUrl, officialOpImageUrl } from "./catalog-image";
import { catalogObjectKey, imageFromDataUrl, keptMirroredUrl, r2Config, storeUploadedImage } from "./r2";
import { catalogSuggestion } from "./catalog-suggest";
import { foldAlias, loadAliasRows } from "./catalog-aliases";
import { curatedCounts, CURATED_COUNTS, loadCuratedCatalog, loadSoftListings, softListingId, softPostId } from "./catalog-names";
import { catalogCardMatches, catalogNeedles, catalogQueryTokens, catalogSuggestWhere, catalogWhere, gameParam, parseGame, type CatalogSearchCard } from "./dex";
import { officialSet, parseOfficialCards, parseOfficialSeries } from "./op-official";
import { mapOptcgCard, optcgExternalId, optcgNumberKey, optcgQueue, optcgSet } from "./optcg";
import { mapRiftBulk, mapRiftCard, riftCollector } from "./riftbound";
import {
  isParallelSubset,
  loadToppsFiles,
  mapToppsCard,
  mapToppsSet,
  parseBasketballCsv,
  parseChecklistHtml,
  parseChecklistLine,
  toppsQueue,
  toppsRarity,
} from "./topps";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(parseGame("pokemon") === "POKEMON" && parseGame("one-piece") === "ONE_PIECE" && parseGame("riftbound") === "RIFTBOUND" && parseGame("demo") === "DEMO", "game query parses");
assert(parseGame("topps-basketball") === "TOPPS_BASKETBALL" && parseGame("topps_soccer") === "TOPPS_SOCCER", "topps sports are separate games");
assert(parseGame("topps") === null, "unknown game is ignored");
assert(parseGame("yugioh") === "YUGIOH" && parseGame("yu-gi-oh") === "YUGIOH" && parseGame("weiss-schwarz") === "WEISS_SCHWARZ", "wave-1 names parse");
assert(parseGame("digimon") === "DIGIMON" && parseGame("lorcana") === "LORCANA" && parseGame("mtg") === "MTG" && parseGame("fab") === "FLESH_AND_BLOOD", "wave-1 games parse");
assert(parseGame("gundam") === "BANDAI_GUNDAM" && parseGame("dragon-ball") === "DRAGON_BALL", "gundam and dragon ball parse");
assert(parseGame("union-arena") === null && parseGame("vanguard") === null && parseGame("panini") === null, "wave-2 games stay out");
const curated = loadCuratedCatalog();
const counts = curatedCounts(curated.cards);
for (const [game, count] of Object.entries(CURATED_COUNTS)) {
  assert(counts[game as keyof typeof counts] === count, `${game} curated count`);
}
assert(curated.cards.every((card) => !card.externalId.includes("http") && !/https?:\/\//i.test(card.nameJa)), "curated rows are names only");
const aliases = loadAliasRows();
const aliasCounts = { YUGIOH: 0, WEISS_SCHWARZ: 0, DIGIMON: 0, ONE_PIECE: 0 };
for (const row of aliases) {
  const game = row.proposedEnum as keyof typeof aliasCounts;
  assert(game in aliasCounts, `${row.proposedEnum} is wave-1`);
  aliasCounts[game] += 1;
}
assert(aliases.length === 217 && aliasCounts.YUGIOH === 185 && aliasCounts.WEISS_SCHWARZ === 12 && aliasCounts.DIGIMON === 10 && aliasCounts.ONE_PIECE === 10, "ja alias counts");
assert(foldAlias("ブラック・マジシャン") === foldAlias("ブラック マジシャン") && foldAlias("ブラック・マジシャン") === foldAlias("ブラックマジシャン"), "middle dots and spaces fold");
const curatedName = new Set(curated.cards.map((card) => `${card.game}\0${card.nameEn}`));
let linked = 0;
for (const row of aliases) {
  const hit = curatedName.has(`${row.proposedEnum}\0${row.nameEn}`);
  if (row.proposedEnum === "ONE_PIECE") {
    assert(!hit, "one piece aliases stay on ingested english names");
    continue;
  }
  if (hit) linked += 1;
}
assert(linked === 123, "aliases attach only to curated english names");
assert(curated.cards.filter((card) => card.nameJa).length === 123, "matched cards store the official ja name");
const darkMagician = curated.cards.find((card) => card.game === "YUGIOH" && card.nameEn === "Dark Magician");
const blueEyes = curated.cards.find((card) => card.game === "YUGIOH" && card.nameEn === "Blue-Eyes White Dragon");
const ash = curated.cards.find((card) => card.game === "YUGIOH" && card.nameEn === "Ash Blossom & Joyous Spring");
assert(darkMagician?.nameJa === "ブラック・マジシャン" && darkMagician.nameEn === "Dark Magician", "dark magician keeps the english name and gains ja");
assert(blueEyes?.nameJa === "青眼の白龍" && ash?.nameJa === "灰流うらら", "blue-eyes and ash store official ja");
assert(!curated.cards.some((card) => card.nameEn === "Baronne de Fleur"), "an alias without a curated english name does not insert a card");
const dmWhere = JSON.stringify(catalogSuggestWhere("黑魔導"));
assert(dmWhere.includes("Dark Magician") && dmWhere.includes("YUGIOH") && !dmWhere.includes("UNION_ARENA") && !dmWhere.includes("VANGUARD") && !/PANINI/.test(dmWhere), "黑魔導 searches Dark Magician");
assert(JSON.stringify(catalogSuggestWhere("ブラック マジシャン")).includes("Dark Magician"), "spaced katakana still searches Dark Magician");
assert(JSON.stringify(catalogSuggestWhere("灰流麗")).includes("Ash Blossom & Joyous Spring"), "灰流麗 searches Ash");
assert(JSON.stringify(catalogSuggestWhere("灰流うらら")).includes("Ash Blossom & Joyous Spring"), "灰流うらら searches Ash");
assert(JSON.stringify(catalogSuggestWhere("青眼白龍")).includes("Blue-Eyes White Dragon"), "青眼白龍 searches Blue-Eyes");
assert(JSON.stringify(catalogSuggestWhere("蒙奇·D·路飛")).includes("Monkey.D.Luffy"), "one piece zh alias searches the english name");
const soft = loadSoftListings();
const names = new Map<string, Set<string>>();
for (const card of curated.cards) {
  const set = names.get(card.game) ?? new Set<string>();
  set.add(card.nameEn);
  names.set(card.game, set);
}
assert(soft.length === 100 && new Set(soft.map((row) => row.sellerPersona)).size === 12, "a hundred listings across twelve sellers");
assert(soft.filter((row) => row.id.startsWith("soft_demo_")).length === 50, "night2 ids are soft_demo_51 through 100");
assert(softListingId("demo-01") === "soft_demo_01" && softListingId("soft_demo_51") === "soft_demo_51", "listing ids do not double-prefix");
assert(softPostId("demo-01") === "soft_post_demo_01" && softPostId("soft_demo_51") === "soft_post_demo_51", "post ids stay unique across both batches");
for (const row of soft) assert(row.imageUrl == null && names.get(row.proposedEnum)?.has(row.cardNameEn), `${row.id} name is in the curated list`);
const waveSeed = readFileSync(new URL("./seed-wave1.ts", import.meta.url), "utf8");
assert(!waveSeed.includes("wipeUserContent") && !waveSeed.includes("deleteMany"), "wave-1 seed only adds");
assert(waveSeed.includes("refreshAliasNames") && waveSeed.includes("aliases"), "wave-1 seed fills ja names on existing rows");
assert(waveSeed.includes("wiped: false"), "wave-1 seed reports that it did not wipe");
const waveRoute = readFileSync(new URL("../app/api/internal/seed-wave1/route.ts", import.meta.url), "utf8");
assert(waveRoute.includes("seedWave1") && waveRoute.includes("authorizedBearer") && waveRoute.includes("BOOTSTRAP_SECRET"), "wave-1 route uses the bootstrap bearer");
assert(waveRoute.includes("export const maxDuration = 300") && waveRoute.includes("counts"), "wave-1 route returns counts and allows the name insert");
assert(!waveRoute.includes("seedDemo") && !waveRoute.includes("wipeUserContent") && !waveRoute.includes("deleteMany"), "wave-1 route does not wipe");
const reseedRoute = readFileSync(new URL("../app/api/internal/reseed/route.ts", import.meta.url), "utf8");
assert(reseedRoute.includes("seedDemo") && reseedRoute.includes("export const maxDuration = 120") && !reseedRoute.includes("seedWave1"), "reseed stays the wipe path");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
assert(schema.includes("YUGIOH") && schema.includes("DRAGON_BALL") && !schema.includes("UNION_ARENA") && !schema.includes("VANGUARD") && !/PANINI_/.test(schema), "wave-2 enums stay out of the schema");
assert(rarityTitle("SEC") === "SEC" && rarityTitle("Super Rare") === "Super Rare", "short rarity codes stay printed");

assert(
  catalogDisplayTitle({
    releaseDate: "2022-12-02",
    setCode: "OP-01",
    printRegion: "WEST",
    collectorNumber: "OP01-001",
    cardName: "Roronoa Zoro",
    rarity: "L",
    game: "ONE_PIECE",
  }) === "2022 One Piece OP-01 EN #OP01-001 Roronoa Zoro L",
  "one piece title uses the game label",
);
assert(
  catalogDisplayTitle({
    setCode: "OP-01",
    printRegion: "JP",
    collectorNumber: "OP01-001",
    cardName: "Roronoa Zoro",
    rarity: "L",
    game: "ONE_PIECE",
  }) === "One Piece OP-01 JP #OP01-001 Roronoa Zoro L",
  "missing year stays off the one piece title",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2025-12-18",
    setCode: "TCB2526",
    printRegion: "WEST",
    collectorNumber: "1",
    cardName: "Pascal Siakam",
    rarity: null,
    game: "TOPPS_BASKETBALL",
  }) === "2025 Topps Basketball TCB2526 EN #1 Pascal Siakam",
  "topps basketball title uses the player and set code",
);
assert(
  catalogDisplayTitle({
    releaseDate: "2025-09-17",
    setCode: "PL2526",
    printRegion: "WEST",
    collectorNumber: "2",
    cardName: "David Raya",
    rarity: "RC",
    game: "topps-soccer",
  }) === "2025 Topps Soccer PL2526 EN #2 David Raya RC",
  "topps soccer title keeps RC",
);
const toppsTokens = catalogQueryTokens("2025 Topps Soccer PL2526 EN #2 David Raya");
assert(toppsTokens.includes("Raya") && toppsTokens.includes("PL2526") && !toppsTokens.some((token) => token.toLowerCase() === "soccer" || token.toLowerCase() === "topps"), "topps game words drop out of a pasted title");

assert(
  catalogTitleFromCard({
    game: "RIFTBOUND",
    printRegion: "WEST",
    collectorNumber: "007a",
    nameEn: "Fury Rune",
    rarity: "Showcase",
    set: { code: "OGN", releaseDate: "2025-10-31" },
  }) === "2025 Riftbound OGN EN #007a Fury Rune Showcase",
  "riftbound title keeps EN",
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
  "pokemon titles stay the same when game is omitted",
);

const luffyTokens = catalogQueryTokens("One Piece OP01-001 Luffy");
assert(luffyTokens.includes("Luffy") && luffyTokens.includes("OP01-001") && !luffyTokens.some((token) => token.toLowerCase() === "piece"), "game words drop out of a card query");
assert(JSON.stringify(catalogWhere("Zoro", "JP", "ONE_PIECE")).includes("ONE_PIECE"), "dex search can require a game");
assert(!JSON.stringify(catalogWhere("Zoro", null)).includes("ONE_PIECE"), "a game filter is not implied");
const opWhere = JSON.stringify(catalogWhere("OP-01", null, "ONE_PIECE"));
assert(opWhere.includes("OP-01") && opWhere.includes("ONE_PIECE") && !opWhere.includes("numberKey"), "OP-01 searches the set code, not every card numbered 1");
assert(JSON.stringify(catalogWhere("OP01", null, "ONE_PIECE")).includes("OP-01"), "OP01 still finds the hyphenated set code");
const zoroCard: CatalogSearchCard = {
  nameEn: "Roronoa Zoro",
  nameJa: "ロロノア・ゾロ",
  collectorNumber: "OP01-001",
  numberKey: "1",
  printRegion: "WEST",
  rarity: "L",
  setNameEn: "Romance Dawn",
  setNameJa: "ロマンスドーン",
  setCode: "OP-01",
  releaseDate: "2022-12-02",
};
const otherOp: CatalogSearchCard = { ...zoroCard, collectorNumber: "EB01-003", numberKey: "3", setNameEn: "Memorial Collection", setCode: "EB-01" };
assert(catalogCardMatches(zoroCard, "Romance Dawn") && catalogCardMatches(zoroCard, "OP-01") && catalogCardMatches(zoroCard, "OP01-001"), "one piece set name, set code, and collector number match");
assert(!catalogCardMatches(otherOp, "OP-01") && !catalogCardMatches(otherOp, "Romance Dawn"), "OP-01 does not hit another set");
assert(catalogCardMatches(zoroCard, "2022 One Piece OP-01 EN #OP01-001 Roronoa Zoro L"), "a pasted one piece title matches stored fields");
assert(catalogNeedles("路飛").some((needle) => needle.toLowerCase() === "luffy"), "路飛 expands to the english name");
assert(catalogCardMatches({ ...zoroCard, nameEn: "Monkey.D.Luffy", nameJa: "モンキー・D・ルフィ", collectorNumber: "OP01-003" }, "路飛"), "路飛 hits a luffy printing");
const annie: CatalogSearchCard = {
  nameEn: "Annie",
  nameJa: "Annie",
  collectorNumber: "001",
  numberKey: "1",
  printRegion: "WEST",
  rarity: "Epic",
  setNameEn: "Origins",
  setNameJa: "Origins",
  setCode: "OGN",
  releaseDate: "2025-10-31",
};
assert(catalogCardMatches(annie, "Origins") && catalogCardMatches(annie, "OGN"), "riftbound set name and set code both match");
const lebron: CatalogSearchCard = {
  nameEn: "LeBron James",
  nameJa: "LeBron James",
  collectorNumber: "127",
  numberKey: "127",
  printRegion: "WEST",
  rarity: null,
  finish: "Los Angeles Lakers",
  setNameEn: "2025-26 Topps Chrome Basketball",
  setNameJa: "2025-26 Topps Chrome Basketball",
  setCode: "TCB2526",
  releaseDate: "2025-12-18",
};
assert(catalogCardMatches(lebron, "LeBron") && catalogCardMatches(lebron, "Chrome Basketball") && catalogCardMatches(lebron, "TCB2526"), "topps player, set name, and set code match");

assert(optcgNumberKey("OP01-001_p1") === "1", "one piece number key uses the collector suffix");
const base = mapOptcgCard(
  {
    card_name: "Roronoa Zoro",
    card_set_id: "OP01-001",
    card_image_id: "OP01-001",
    card_image: "https://optcgapi.com/media/static/Card_Images/OP01-001.jpg",
    rarity: "L",
  },
  "set",
);
const parallel = mapOptcgCard(
  {
    card_name: "Roronoa Zoro (Parallel)",
    card_set_id: "OP01-001",
    card_image_id: "OP01-001_p1",
    card_image: "https://optcgapi.com/media/static/Card_Images/OP01-001_p1.jpg",
    rarity: "L",
  },
  "set",
);
assert(base?.externalId === "op-en:OP01-001" && parallel?.externalId === "op-en:OP01-001_p1", "parallel printings do not share an id");
assert(optcgSet({ kind: "set", id: "OP-01", name: "Romance Dawn", code: "OP-01" }, [base!, parallel!]).cards[0]?.externalId.startsWith("op-en:OP-01:"), "reprints in another set keep their own id");
assert(base?.numberKey === "1" && base?.sourceImageUrl.endsWith(".jpg"), "english printing keeps the remote image");
const promo = mapOptcgCard(
  {
    card_name: "Gum-Gum Lightning",
    card_set_id: "OP09-077",
    card_image_id: "OP09-077",
    card_image: "https://optcgapi.com/media/static/Card_Images/Gum-Gum_Lightning_img.jpg",
    rarity: "UC",
  },
  "promo",
);
assert(promo?.externalId === "op-en:promo:Gum-Gum_Lightning_img" && promo.externalId !== optcgExternalId("set", { card_image_id: "OP09-077" }), "promos do not overwrite the set printing");

const queue = optcgQueue(
  [
    { set_id: "OP-01", set_name: "Romance Dawn" },
    { set_id: "OP-02", set_name: "Paramount War" },
  ],
  [{ structure_deck_id: "ST-01", structure_deck_name: "Straw Hat Crew" }],
);
assert(queue[0]?.id === "OP-02" && queue.at(-1)?.id === "DON" && queue.some((row) => row.id === "PROMO"), "english queue is newest sets, then decks, promos, and DON");

const series = parseOfficialSeries(`
  <select id="series">
    <option value="550205">エクストラブースター &lt;br class=&quot;spInline&quot;&gt;ONE PIECE Heroines Edition vol.2【EB-05】</option>
    <option value="550117">ブースターパック 世界最強の戦士【OP-17】</option>
    <option value="550001">スタートデッキ<br class="spInline">麦わらの一味【ST-01】</option>
    <option value="550901">プロモーションカード</option>
  </select>
  <option value="9000">9000</option>
`);
assert(series.length === 4 && series[1]?.code === "OP-17" && series[2]?.code === "ST-01" && series[3]?.code === "PROMO", "official series list ignores the other dropdowns");
assert(series[0]?.code === "EB-05" && series[0]?.name === "エクストラブースター ONE PIECE Heroines Edition vol.2", "escaped line breaks are not stored in the set name");
assert(!series[1]?.name.includes("【") && !series.some((row) => row.name.includes("<")), "series name drops the bracketed code and tags");

const jp = parseOfficialCards(`
  <dl class="modalCol" id="EB04-061_p3">
    <div class="infoCol"><span>EB04-061</span> | <span>SEC</span> | <span>CHARACTER</span></div>
    <div class="cardName">モンキー・Ｄ・ルフィ</div>
    <img data-src="../images/cardlist/card/EB04-061_p3.png?261016" alt="">
  </dl>
`);
assert(jp.length === 1 && jp[0]?.externalId === "op-jp:EB04-061_p3", "japanese printing id keeps the parallel suffix");
assert(jp[0]?.nameJa === "モンキー・Ｄ・ルフィ" && jp[0]?.collectorNumber === "EB04-061" && jp[0]?.numberKey === "61", "japanese name and collector number come off the official row");
assert(jp[0]?.sourceImageUrl === "https://www.onepiece-cardgame.com/images/cardlist/card/EB04-061_p3.png", "japanese image is the official remote file");
assert(officialSet({ id: "550117", name: "世界最強の戦士", code: "OP-17" }, jp).cards[0]?.externalId === "op-jp:550117:EB04-061_p3", "the same art in another series is a separate row");
assert(jp[0]?.rarity === "SEC", "japanese rarity is the printed code");

const printed = riftCollector("ogn-007a-298", 7);
assert(printed.collectorNumber === "007a" && printed.numberKey === "7", "riftbound collector keeps the letter suffix");
const riftCard = mapRiftCard({
  id: "abc",
  riftboundId: "ogn-007a-298",
  name: "Fury Rune (Alternate Art)",
  num: 7,
  rarity: "Showcase",
  artist: "Fairfoul",
  set: "OGN",
  imgUrl: "https://cmsassets.rgpub.io/sanity/images/example.png",
});
assert(riftCard?.externalId === "rb:abc" && riftCard.artist === "Fairfoul" && riftCard.sourceImageUrl.startsWith("https://"), "riftbound printing uses the stable id and remote image");
const bulk = mapRiftBulk({
  sets: [
    { id: "OGN", name: "Origins", released: "2025-10-31" },
    { id: "SFD", name: "Spiritforged", released: "2026-02-13" },
  ],
  cards: [
    { id: "1", riftboundId: "ogn-001-298", name: "Blazing Scorcher", num: 1, rarity: "Common", set: "OGN", imgUrl: "https://example.com/a.png" },
    { id: "1", riftboundId: "ogn-001-298", name: "Blazing Scorcher", num: 1, rarity: "Common", set: "OGN", imgUrl: "https://example.com/a.png" },
    { id: "2", riftboundId: "sfd-010-300", name: "Annie", num: 10, rarity: "Rare", set: "SFD", imgUrl: "https://example.com/b.png" },
  ],
});
assert(bulk.sets[0]?.id === "SFD" && bulk.cardsBySet.get("OGN")?.length === 1, "riftbound sets are newest first and printings are unique");

assert(!catalogSetSettled(undefined) && !catalogSetSettled({ count: 3, total: null }), "a set without a stored total is not finished");
assert(catalogSetSettled({ count: 0, total: 0 }) && !catalogSetSettled({ count: 3, total: 10 }), "total is the finished marker");
const steps = planCatalogSteps(
  [{ externalId: "en:OP-02" }, { externalId: "en:OP-01" }, { externalId: "en:PROMO" }],
  { cursor: "en:OP-01#20", settled: new Set(["en:OP-02"]), maxSets: 2 },
);
assert(steps.steps[0]?.item.externalId === "en:OP-01" && steps.steps[0]?.cardOffset === 20, "a hash cursor stays on that set");
assert(steps.skippedSettled === 0, "settled rows behind the cursor are not counted again");
assert(catalogRemaining([{ externalId: "en:A" }, { externalId: "en:B" }], new Set(["en:A"]), "en:A") === 1, "a finished cursor leaves the sets after it");

const suggestion = catalogSuggestion(
  {
    id: "op1",
    nameEn: "Roronoa Zoro",
    nameJa: "ロロノア・ゾロ",
    collectorNumber: "OP01-001",
    numberKey: "1",
    printRegion: "JP",
    rarity: "L",
    finish: null,
    listingCount: 0,
    setNameEn: "Romance Dawn",
    setNameJa: "ロマンスドーン",
    setCode: "OP-01",
    series: "Booster",
    releaseDate: "2022-12-02",
    game: "ONE_PIECE",
  },
  "ONE_PIECE",
);
assert(suggestion.title.startsWith("2022 One Piece OP-01 JP") && suggestion.game === "One Piece" && suggestion.language === "日文", "suggestions use the one piece title and language");
const dirty = catalogSuggestion(
  {
    id: "eb",
    nameEn: "Luffy",
    nameJa: "ルフィ",
    collectorNumber: "EB05-008",
    numberKey: "8",
    printRegion: "JP",
    rarity: "C",
    finish: null,
    listingCount: 0,
    setNameEn: 'エクストラブースター <br class="spInline">ONE PIECE Heroines Edition vol.2',
    setNameJa: 'エクストラブースター <br class="spInline">ONE PIECE Heroines Edition vol.2',
    setCode: "EB-05",
    series: '<br class="spInline">ONE PIECE Heroines Edition vol.2',
    releaseDate: null,
    game: "ONE_PIECE",
  },
  "ONE_PIECE",
);
assert(!dirty.setName.includes("<") && !dirty.series.includes("<"), "stored line-break tags stay out of suggestion labels");
const official = "https://www.onepiece-cardgame.com/images/cardlist/card/ST01-001.png";
assert(officialOpImageUrl(official) === official, "official card art is allowed through the image proxy");
assert(officialOpImageUrl("https://evil.example/images/cardlist/card/ST01-001.png") === null, "other hosts are not proxied");
assert(catalogImageSrc(official) === `/api/catalog/image?src=${encodeURIComponent(official)}`, "official art is rewritten to the same-origin proxy");
assert(catalogImageSrc("https://optcgapi.com/media/static/Card_Images/OP01-001.jpg").startsWith("https://optcgapi.com/"), "english art stays a direct url");
const r2Art = "https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/dex/one-piece/op-jp_ST01-001.png";
assert(isR2PublicUrl(r2Art) && catalogImageSrc(r2Art) === r2Art, "r2 public art is not proxied");
assert(catalogTileSrc(r2Art) === r2Art, "r2 tiles keep the stored object");
assert(catalogTileSrc("https://assets.tcgdex.net/ja/SV/SV2a/001/high.webp") === "https://assets.tcgdex.net/ja/SV/SV2a/001/low.webp", "tcgdex tiles still ask for the small file");
assert(!isR2PublicUrl(official), "the official host is not treated as r2");
assert(catalogObjectKey("POKEMON", "ja:sv10-001", "webp") === "dex/pokemon/ja_sv10-001.webp", "pokemon objects stay under dex/pokemon");
assert(catalogObjectKey("ONE_PIECE", "op-jp:ST01-001", "png") === "dex/one-piece/op-jp_ST01-001.png", "one piece objects use their own prefix");
assert(catalogObjectKey("RIFTBOUND", "rb:abc", "jpg") === "dex/riftbound/rb_abc.jpg", "riftbound objects use their own prefix");
assert(catalogObjectKey("YUGIOH", "nm:YUGIOH:S001:0001", "webp") === "dex/yugioh/nm_YUGIOH_S001_0001.webp", "yugioh objects stay in their own folder");
assert(gameParam("BANDAI_GUNDAM") === "gundam" && gameParam("FLESH_AND_BLOOD") === "flesh-and-blood" && gameParam("DRAGON_BALL") === "dragon-ball", "wave-1 slugs match sell categories");
const jpeg = `data:image/jpeg;base64,${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
assert(imageFromDataUrl(jpeg)?.contentType === "image/jpeg", "jpeg data urls decode");
assert(imageFromDataUrl("data:image/svg+xml;base64,aaaa") === null, "svg uploads are rejected");
const uploadCheck = r2Config()
  ? Promise.resolve()
  : Promise.all([storeUploadedImage(jpeg, "uploads/listings"), storeUploadedImage("https://cdn.example/a.jpg", "uploads/listings")]).then(([dataUrl, httpsUrl]) => {
      assert(dataUrl === jpeg, "missing R2 keeps the data url");
      assert(httpsUrl === "https://cdn.example/a.jpg", "https photos are not copied");
    });
if (!r2Config()) {
  assert(keptMirroredUrl({ imageUrl: r2Art, sourceImageUrl: "https://assets.example/a.webp" }, "https://assets.example/a.webp") === null, "missing R2 does not pretend an image is mirrored");
}
{
  const keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.R2_ACCOUNT_ID = "acct";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET = "tysm-images";
  process.env.R2_PUBLIC_BASE_URL = "https://cards.example.com";
  const base = "https://cards.example.com/dex/pokemon/ja_sv10-001.webp";
  assert(keptMirroredUrl({ imageUrl: base, sourceImageUrl: "https://assets.tcgdex.net/ja/SV/SV10/001/high.webp" }, "https://assets.tcgdex.net/ja/SV/SV10/001/high.webp") === base, "unchanged source keeps the r2 url");
  assert(keptMirroredUrl({ imageUrl: base, sourceImageUrl: "https://assets.tcgdex.net/ja/SV/SV10/001/high.webp" }, "https://assets.tcgdex.net/ja/SV/SV10/001/low.webp") === null, "a new source is mirrored again");
  assert(isR2PublicUrl("https://cards.example.com/dex/one-piece/a.png") && catalogImageSrc("https://cards.example.com/dex/one-piece/a.png") === "https://cards.example.com/dex/one-piece/a.png", "custom public base is served directly");
  for (const key of keys) {
    if (saved[key] == null) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

assert(toppsRarity("Base", false) === null && toppsRarity("Base", true) === "RC" && toppsRarity("Future Stars", true) === "Future Stars RC", "base stays off the title and RC stacks on an insert");
assert(!isParallelSubset("1980-81 Topps Chrome Basketball Mojo") && !isParallelSubset("Base Card Variations") && isParallelSubset("Gold Refractor"), "named inserts stay and color refractors drop");
assert(parseChecklistLine("73TA-AI Allen Iverson - Philadelphia 76ers RC")?.rc === true, "a trailing RC flag is kept");
assert(parseChecklistLine("1 Jett Howard - Orlando Magic")?.name === "Jett Howard", "a base line keeps the player");
const html = `
<h2>Sample Checklist</h2>
<h3>Base Checklist</h3>
<div><em>Parallels</em>: Refractor; Gold Refractor /50; SuperFractor 1/1.</div>
<div>1 Jett Howard - Orlando Magic<br />102 KJ Simpson - Charlotte Hornets RC<br />122 Stephon Castle - San Antonio Spurs RC <a href="https://www.ebay.com/sch"><strong>(eBay)</strong></a><br /></div>
<h3>451 Checklist</h3>
<div>451-1 Giannis Antetokounmpo - Milwaukee Bucks<br /></div>
<h2>Sample Team Set Checklist</h2>
<h3>Atlanta Hawks Team Set List</h3>
<div>1 Jett Howard - Orlando Magic<br /></div>
`;
const parsed = parseChecklistHtml(html);
assert(parsed.length === 4 && parsed.some((row) => row.n === "102" && row.rc) && parsed.some((row) => row.subset === "451"), "html keeps base and inserts");
assert(parsed.find((row) => row.n === "122")?.team === "San Antonio Spurs" && parsed.find((row) => row.n === "122")?.rc === true, "an ebay link is not part of the team");
assert(!parsed.some((row) => /refractor/i.test(row.name) || /refractor/i.test(row.subset) || /ebay/i.test(row.team)), "parallel names and ebay links are not cards");
const csv = parseBasketballCsv('"number","player","team","subset","rc","ebay_url"\n"1","Pascal Siakam","Indiana Pacers","Base","","https://www.ebay.com/sch/i.html?x=1"\n');
assert(csv.length === 1 && csv[0]!.name === "Pascal Siakam" && csv[0]!.team === "Indiana Pacers" && !JSON.stringify(csv).includes("ebay"), "csv keeps the player and drops the ebay url");
const mapped = mapToppsCard("TCB2526", csv[0]!);
assert(mapped.sourceImageUrl === "" && mapped.finish === "Indiana Pacers" && mapped.nameJa === "Pascal Siakam" && mapped.externalId.startsWith("tb:TCB2526:"), "topps cards are names only and the team is searchable");

const files = loadToppsFiles();
const basketball = files.filter((file) => file.game === "TOPPS_BASKETBALL");
const soccer = files.filter((file) => file.game === "TOPPS_SOCCER");
const count = (rows: typeof files) => rows.reduce((sum, file) => sum + file.cards.length, 0);
assert(basketball.length >= 2 && count(basketball) >= 500, "basketball ships hundreds of named cards");
assert(["TCB2526", "TB2526", "TCB2425"].every((code) => basketball.some((file) => file.code === code)), "basketball ships chrome and flagship");
assert(soccer.length >= 2 && count(soccer) >= 100, "soccer ships more than one named set");
assert(["UEFA2425", "MLS24", "PL2526"].every((code) => soccer.some((file) => file.code === code)), "soccer ships premier league, uefa chrome, and mls chrome");
assert(files.every((file) => file.cards.some((card) => card.subset === "Base" && card.name.trim())), "each topps set has a named base card");
assert(!files.some((file) => file.cards.some((card) => isParallelSubset(card.subset) || /ebay\.com/i.test(JSON.stringify(card)))), "committed checklists have no parallel matrix and no ebay links");
const chrome = files.find((file) => file.code === "TCB2526");
assert(chrome && mapToppsSet(chrome).cards.length >= 200 && mapToppsSet(chrome).printRegion === "WEST", "2025-26 chrome basketball maps to western printings");
assert(toppsQueue("TOPPS_BASKETBALL")[0]?.externalId.startsWith("en:"), "topps ingest cursors use the dex cursor shape");

async function checkSeedWave1Auth() {
  const previous = process.env.BOOTSTRAP_SECRET;
  const call = (authorization?: string) =>
    postSeedWave1(
      new Request("http://localhost/api/internal/seed-wave1", {
        method: "POST",
        headers: authorization ? { authorization } : {},
      }),
    );
  delete process.env.BOOTSTRAP_SECRET;
  const missing = await call("Bearer test-secret");
  assert(missing.status === 503 && (await missing.json()).error === "unconfigured", "no secret is 503");
  process.env.BOOTSTRAP_SECRET = "test-secret";
  const unauth = await call("Bearer wrong");
  assert(unauth.status === 401 && (await unauth.json()).error === "unauthorized", "a bad bearer is 401");
  const bare = await call();
  assert(bare.status === 401, "a missing bearer is 401");
  if (previous === undefined) delete process.env.BOOTSTRAP_SECRET;
  else process.env.BOOTSTRAP_SECRET = previous;
}

uploadCheck
  .then(() => checkSeedWave1Auth())
  .then(
    () => console.log("game catalog ok"),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
