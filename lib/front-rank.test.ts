import { readFileSync } from "fs";
import { DEMO_ACCOUNTS, TRIAL_ACCOUNTS } from "./demo-login";
import { FRONT_RANK_LIMIT, FRONT_RANK_ORDER, frontRankBadge, pickFrontRank } from "./front-rank";
import { SOFT_SELLER_IDS, SOFT_SELLERS, softSellerId } from "./soft-sellers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const person = (id: string) => ({ id, nickname: id, avatarUrl: null });

assert(FRONT_RANK_LIMIT === 10, "the front row is ten");
assert(SOFT_SELLERS.length === 12 && new Set(SOFT_SELLERS.map((row) => row.handle)).size === 12, "twelve soft-seed sellers");
assert(softSellerId("hkcardking") === "user_soft_hkcardking", "soft-seed ids stay user_soft_");
assert(SOFT_SELLER_IDS[0] === "user_soft_hkcardking" && SOFT_SELLER_IDS[9] === "user_soft_islandbinder", "top 10 ends at IslandBinder");
assert(FRONT_RANK_ORDER.slice(0, 12).join() === SOFT_SELLER_IDS.join(), "soft-seed order leads the strip");
assert(
  FRONT_RANK_ORDER.slice(12, 15).join() === DEMO_ACCOUNTS.map((row) => row.id).join() &&
    FRONT_RANK_ORDER.slice(15).join() === TRIAL_ACCOUNTS.map((row) => row.id).join(),
  "reseed demo sellers follow soft-seed, still in a fixed order",
);

const all = FRONT_RANK_ORDER.map(person);
const top = pickFrontRank(FRONT_RANK_ORDER, [...all].reverse(), []);
assert(top.length === 10 && top.map((row) => row.id).join() === SOFT_SELLER_IDS.slice(0, 10).join(), "presence does not reorder; first ten soft-seed sellers win");
assert(top.map((row) => row.rank).join() === "1,2,3,4,5,6,7,8,9,10", "badges are 1 through 10");

const skipped = pickFrontRank(
  FRONT_RANK_ORDER,
  all.filter((row) => row.id !== "user_soft_hkcardking" && row.id !== "user_soft_tyudemo"),
  ["user_soft_marspacks"],
);
assert(skipped[0]?.id === "user_soft_kowloonbinder" && skipped[0].rank === 1, "missing and hidden sellers drop out; the next fixed id becomes #1");
assert(!skipped.some((row) => row.id === "user_soft_marspacks"), "a hidden seller stays off the row");

const fallback = pickFrontRank(
  FRONT_RANK_ORDER,
  [person("user_muel"), person("user_mars"), person("user_tyu")],
  [],
);
assert(fallback.map((row) => row.id).join() === "user_mars,user_tyu,user_muel", "without soft-seed, demo sellers stay Mars, Tyu, MueL");

assert(frontRankBadge(1).label === "#1" && frontRankBadge(1).fill === "#E0B53A" && frontRankBadge(1).top, "#1 is gold");
assert(frontRankBadge(2).label === "#2" && frontRankBadge(2).fill === "#B7C0C8", "#2 is silver");
assert(frontRankBadge(3).label === "#3" && frontRankBadge(3).fill === "#C9844A", "#3 is bronze");
assert(!frontRankBadge(4).top && frontRankBadge(4).label === "4" && frontRankBadge(4).ink === "#64748b", "#4 is a smaller gray number");
assert(frontRankBadge(10).label === "10" && !frontRankBadge(10).label.startsWith("#"), "#10 keeps the number without a hash");

const src = readFileSync(new URL("./front-rank.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../components/front-rank.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const seed = readFileSync(new URL("./seed-wave1.ts", import.meta.url), "utf8");
const sellers = readFileSync(new URL("./soft-sellers.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
assert(!src.includes("order.findMany") && !src.includes("postLike") && !src.includes("tallyRanks") && !src.includes("prisma.order") && !src.includes(".stars"), "the front row does not score deals, likes, or ratings");
assert(ui.includes("href={`/u/${person.id}`}") && !ui.includes("/shop/") && !ui.includes("StoryRail") && !ui.includes("FollowRail"), "a cell opens /u/[id], not a shop or the old story rail");
assert(ui.includes('href="/rank"') && ui.includes("全部") && ui.includes("frontRankBadge"), "全部 goes to the existing rank page and the badge helper paints the circle");
assert(ui.includes("h-[18px]") && ui.includes("h-3.5") && ui.includes("overflow-x-auto") && ui.includes("data-gesture") && !ui.includes("max-w-[390px]") && !ui.includes("max-w-[375px]"), "top badges are larger; the row scrolls without a phone frame");
assert(home.indexOf("<FrontRank") >= 0 && home.indexOf("<FrontRank") < home.indexOf("primary.map") && home.includes("loadFrontRank"), "the row sits at the top of Front");
assert(!home.includes("FollowRail") && !home.includes("StoryRail"), "the following rail stays off Front");
assert(seed.includes("SOFT_SELLERS") && seed.includes("softSellerId") && seed.includes("wiped: false") && !seed.includes("deleteMany") && !sellers.includes("deleteMany"), "soft-seed stays additive; the row reuses that seller list");
assert(!login.includes("FrontRank") && !login.includes("loadFrontRank"), "login is untouched by the front row");

console.log("front-rank.test.ts ok");
