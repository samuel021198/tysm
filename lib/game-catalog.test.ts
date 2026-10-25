import { catalogDisplayTitle, catalogTitleFromCard, rarityTitle } from "./card-title";
import { catalogRemaining, catalogSetSettled, planCatalogSteps } from "./catalog-batch";
import { catalogImageSrc, officialOpImageUrl } from "./catalog-image";
import { catalogSuggestion } from "./catalog-suggest";
import { catalogQueryTokens, catalogWhere, parseGame } from "./dex";
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
assert(luffyTokens.includes("Luffy") && luffyTokens.includes("OP01") && !luffyTokens.some((token) => token.toLowerCase() === "piece"), "game words drop out of a card query");
assert(JSON.stringify(catalogWhere("Zoro", "JP", "ONE_PIECE")).includes("ONE_PIECE"), "dex search can require a game");
assert(!JSON.stringify(catalogWhere("Zoro", null)).includes("ONE_PIECE"), "a game filter is not implied");

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

console.log("game catalog ok");
