import { readFileSync } from "node:fs";
import { compactSetLine } from "./card-line";
import { catalogTileSrc } from "./catalog-image";
import { DEMO_CARDS, DEMO_SETS, demoMarket, demoTrades } from "./demo-dex";
import { gameParam, parseGame } from "./dex";
import { railToggle } from "./dex-rail-state";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(compactSetLine("SV2a", "001") === "SV2a 001", "padded collector number stays three digits");
assert(compactSetLine("SV2a", "1/165") === "SV2a 001", "short numeric locals pad to three digits");
assert(compactSetLine("SV2a", "193/165") === "SV2a 193", "the local number drops the printed total");
assert(compactSetLine("OP-01", "OP01-001") === "OP-01 OP01-001", "non-numeric numbers stay printed");
assert(compactSetLine("DM01", "004") === "DM01 004", "demo numbers use the same line");

assert(railToggle("POKEMON", true, "POKEMON").open === false && railToggle("POKEMON", true, "POKEMON").changed === false, "second tap collapses sets");
assert(railToggle("POKEMON", false, "POKEMON").open === true && railToggle("POKEMON", false, "POKEMON").changed === false, "third tap expands the same game");
const switched = railToggle("POKEMON", false, "DEMO");
assert(switched.game === "DEMO" && switched.open && switched.changed, "another game selects and expands");

assert(parseGame("demo") === "DEMO" && gameParam("DEMO") === "demo", "demo is its own game param");
assert(DEMO_CARDS.length === 10, "demo dex ships about ten cards");
assert(new Set(DEMO_CARDS.map((card) => card.setId)).size === DEMO_SETS.length, "demo cards sit on demo sets");
assert(DEMO_SETS.every((set) => set.code.startsWith("DM")), "demo sets are not pokemon series codes");
assert(!DEMO_CARDS.some((card) => card.setCode.startsWith("SV")), "demo is not nested under a pokemon set");

const market = demoMarket("demo_card_charizard");
assert(market.status === "ok" && market.price != null && market.points.length >= 2 && market.recent.length >= 2, "demo market is filled without a network call");
assert(demoTrades("demo_card_luffy").length === 2 && demoTrades("demo_card_luffy")[0]!.hkd > 0, "demo trades give the sales tab something to show");

assert(catalogTileSrc("https://assets.tcgdex.net/ja/SV/SV2a/001/high.webp") === "https://assets.tcgdex.net/ja/SV/SV2a/001/low.webp", "tiles request the small tcgdex file");
assert(catalogTileSrc("/demo/cards/seed_charizard.svg") === "/demo/cards/seed_charizard.svg", "local demo art is unchanged");

const rail = readFileSync("components/dex-rail.tsx", "utf8");
assert(rail.includes('["DEMO", "Demo", "Demo"]') && rail.includes("aria-expanded"), "demo is a peer rail row and sets collapse");
assert(!rail.includes("overflow-y-auto overscroll-contain md:w-52"), "the rail is not a second sticky scroller");
console.log("dex browse ok");
