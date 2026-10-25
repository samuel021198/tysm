import { flavorFromCard } from "./flavor";
import {
  formatPct,
  gradeLabel,
  localizeSnkrDate,
  marketStats,
  parseChart,
  parseHistory,
  parsePrinting,
  parseSearch,
  parseTrendRange,
  pickSnkrHit,
  premiumRatio,
  scoreSnkrHit,
  slicePoints,
  snkrEnabled,
  snkrQueries,
  type SnkrCardRef,
  type SnkrSearchHit,
} from "./snkrdunk";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const charizard: SnkrCardRef = {
  game: "POKEMON",
  printRegion: "JP",
  setCode: "M6a",
  setNameEn: "30th Celebration",
  setNameJa: "30th CELEBRATION",
  collectorNumber: "137/103",
  numberKey: "137",
  nameEn: "Charizard",
  nameJa: "リザードン",
};

const hit = (id: number, name: string, localizedName = ""): SnkrSearchHit => ({ id, name, localizedName, isTradingCard: true });

const m6a = hit(882281, 'Charizard [M6a 137/103](Expansion Pack "30th CELEBRATION")', "リザードン [M6a 137/103](拡張パック「30th CELEBRATION」)");
assert(parsePrinting(m6a.name)?.setCode === "M6a" && parsePrinting(m6a.name)?.number === "137" && parsePrinting(m6a.name)?.lang === "JP", "M6a bracket");
assert(pickSnkrHit(charizard, [m6a])?.id === 882281, "set code and number pick the charizard");
assert(scoreSnkrHit({ ...charizard, numberKey: "6" }, m6a) === 0, "a different number does not match");

const mirror = hit(1, "Pikachu C: Master Ball Mirror[SV2a 025/165](Enhanced Expansion Pack \"Pokemon Card 151\")");
const plain = hit(2, "Pikachu C[SV2a 025/165](Enhanced Expansion Pack \"Pokemon Card 151\")");
const pika: SnkrCardRef = { ...charizard, setCode: "SV2a", numberKey: "25", nameEn: "Pikachu", nameJa: "ピカチュウ", setNameEn: "Pokemon Card 151", setNameJa: "ポケモンカード151" };
assert(pickSnkrHit(pika, [mirror, plain])?.id === 2, "plain printing beats a mirror");
assert(pickSnkrHit({ ...pika, nameEn: "Pikachu Master Ball Mirror" }, [mirror, plain])?.id === 1, "a mirror name keeps the mirror");
assert(pickSnkrHit(pika, [mirror, { ...mirror, id: 3, name: mirror.name.replace("Master Ball", "Monster Ball") }]) === null, "two mirrors tie and stay unmatched");

const mew: SnkrCardRef = { ...charizard, setCode: "SV2a", numberKey: "151", nameEn: "Mew", nameJa: "ミュウ" };
const mewtwo = hit(9, "Mewtwo AR[SV2a 183/165](Enhanced Expansion Pack \"Pokemon Card 151\")", "ミュウツー");
assert(scoreSnkrHit(mew, mewtwo) === 0, "mew does not match mewtwo");
assert(scoreSnkrHit({ ...mew, nameJa: "ミュウツー", nameEn: "Mewtwo", numberKey: "183" }, mewtwo) >= 50, "mewtwo still matches itself");

const base: SnkrCardRef = {
  ...charizard,
  printRegion: "WEST",
  setCode: "base1",
  setNameEn: "Base Set",
  setNameJa: "Base Set",
  numberKey: "4",
  collectorNumber: "4/102",
  nameJa: "Charizard",
};
const base1 = hit(11, 'Charizard R [4/102][EN](Base Set 1st Edition)');
const base2 = hit(12, 'Charizard R [4/130][EN](Base "Set 2")');
assert(parsePrinting(base1.name)?.setCode === null && parsePrinting(base1.name)?.lang === "EN", "old english bracket has no set code");
assert(pickSnkrHit(base, [base1, base2])?.id === 11, "base set name keeps the 1st edition charizard");
assert(scoreSnkrHit(charizard, base1) === 0, "a japanese card does not take an EN printing");

const box = hit(13, 'Pokemon Card Game Scarlet & Violet Enhanced Expansion Pack "pokemon card 151" Box');
assert(scoreSnkrHit(pika, box) === 0, "a sealed box is not a single");

const en151: SnkrCardRef = { ...base, setCode: "sv03.5", setNameEn: "151", numberKey: "193", nameEn: "Mew ex" };
const mewEn = hit(14, 'Mew ex UR [MEW EN 193/165](Scarlet & Violet "151")');
assert(scoreSnkrHit(en151, mewEn) === 0, "tcgdex sv03.5 does not equal SNKRDUNK MEW");

assert(snkrQueries(charizard)[0] === "M6a 137", "first query is set code plus number");
assert(snkrQueries(base).includes("Charizard Base Set 4"), "english set name is searched when the code differs");
assert(!snkrEnabled("ONE_PIECE") && !snkrEnabled("RIFTBOUND"), "only pokemon is priced");
assert(parseTrendRange("1w") === "1w" && parseTrendRange("nope") === "all", "trend range");

const search = parseSearch({
  streetwears: [{ id: 882281, name: m6a.name, localizedName: m6a.localizedName, isTradingCard: true }],
  sneakers: [],
});
assert(search.length === 1 && search[0]?.id === 882281, "search reads streetwears");

const chart = parseChart({
  points: [
    [1000, 16000],
    [3000, 19000],
    [2000, 0],
  ],
  salesChartOption: [
    { id: 18, localizedName: "A" },
    { id: 22, localizedName: "PSA10" },
  ],
});
assert(chart.points.map((point) => point.price).join() === "16000,19000", "chart drops a zero price and sorts");
assert(chart.options[1]?.name === "PSA10", "chart keeps condition names");

const history = parseHistory({
  history: [
    { price: 190000, date: "1時間前", condition: "PSA10" },
    { price: 0, date: "1日前", condition: "PSA10" },
  ],
});
assert(history.length === 1 && history[0]?.date === "1時間前", "history drops a zero sale");
assert(localizeSnkrDate("1時間前", "zh-HK") === "1 小時前" && localizeSnkrDate("2026/10/09", "zh-HK") === "9/10/2026", "sale dates in zh-HK");
assert(gradeLabel("PSA10", "zh-HK") === "PSA 10" && gradeLabel("A", "zh-HK") === "A 級", "grade labels");

const points = [
  { t: 0, price: 100 },
  { t: 86_400_000, price: 80 },
];
const stats = marketStats(points);
assert(stats?.high === 100 && stats.low === 80 && stats.spread === 20 && stats.changePct === -20, "high low spread change");
assert(slicePoints(points, "1w", 8 * 86_400_000).length === 1, "one week keeps the newer point");
assert(slicePoints(points, "all", 0).length === 2, "all keeps every point");
assert(premiumRatio([100, 300], [100]) === 2, "psa median over raw");
assert(premiumRatio([10], []) === null, "premium needs both sides");
assert(formatPct(9.36) === "+9.4%" && formatPct(-20.84) === "-20.8%", "signed percent");
assert(flavorFromCard({ description: "Spits fire that is hot enough to melt boulders." })?.startsWith("Spits"), "flavor text");
assert(flavorFromCard({ description: "short" }) === null && flavorFromCard({}) === null, "missing flavor stays empty");

console.log("snkrdunk ok");
