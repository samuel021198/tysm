import { readFileSync } from "fs";
import {
  auctionOutcome,
  auctionSchedule,
  isAuctionDays,
  publicIncrementCents,
  publicMinimumBid,
  shopTab,
} from "./auction";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(publicIncrementCents(10000) === 1000, "HK$100 raises by HK$10, not 5%");
assert(publicIncrementCents(30000) === 1500, "HK$300 raises by 5% (HK$15)");
assert(publicIncrementCents(19900) === 1000, "a 5% slice under HK$10 still raises HK$10");
assert(publicMinimumBid(80000, null, false) === 80000, "the first bid may be the start price");
assert(publicMinimumBid(80000, 80000, true) === 84000, "HK$800 raises by 5% (HK$40)");

assert(auctionOutcome({ high: null, leaderId: null, reserve: null, voided: false }) === "passed", "no bid is 流標");
assert(auctionOutcome({ high: 10000, leaderId: "a", reserve: 15000, voided: false }) === "passed", "under the reserve is 流標");
assert(auctionOutcome({ high: 15000, leaderId: "a", reserve: 15000, voided: false }) === "won", "meeting the reserve is 已保留");
assert(auctionOutcome({ high: 10000, leaderId: "a", reserve: null, voided: false }) === "won", "no reserve sells to the high bid");
assert(auctionOutcome({ high: 20000, leaderId: "a", reserve: null, voided: true }) === "passed", "voided bids do not win");

const now = new Date("2026-10-30T00:00:00Z");
const keptEnd = new Date("2026-11-02T00:00:00Z");
const same = auctionSchedule({
  saleType: "AUCTION",
  auctionDays: 3,
  fallbackEnd: null,
  publishAt: null,
  now,
  existing: { auctionDays: 3, auctionEndsAt: keptEnd },
});
assert(same.auctionEndsAt?.getTime() === keptEnd.getTime(), "editing without changing the length keeps the clock");
const moved = auctionSchedule({
  saleType: "AUCTION",
  auctionDays: 1,
  fallbackEnd: null,
  publishAt: null,
  now,
  existing: { auctionDays: 3, auctionEndsAt: keptEnd },
});
assert(moved.auctionEndsAt?.getTime() === now.getTime() + 86400000, "a new length restarts from now");
assert(auctionSchedule({ saleType: "BUY_NOW", auctionDays: 3, fallbackEnd: keptEnd, publishAt: null, now, existing: null }).auctionEndsAt === null, "fixed price clears the auction clock");
assert(isAuctionDays(1) && isAuctionDays(7) && !isAuctionDays(2), "only 1, 3, 5, 7");
assert(shopTab(undefined) === "all" && shopTab("new") === "new" && shopTab("auction") === "auction" && shopTab("shops") === "shops" && shopTab("nope") === "all", "mall chips");

const shop = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
assert(shop.includes("全部") && shop.includes("新上架") && shop.includes("拍賣") && shop.includes("商店"), "mall chips are 全部, 新上架, 拍賣, 商店");
assert(shop.includes("currentBid") && shop.includes("storeName") && shop.includes("/shop/${store.id}"), "listing cards show the bid and the store; store cards open the shop");
const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
assert(sell.includes("固定價") && sell.includes("起標價") && sell.includes("買家唔見") && sell.includes("[1, 3, 5, 7]"), "create listing offers fixed or auction with the locked fields");
const panel = readFileSync(new URL("../components/purchase-panel.tsx", import.meta.url), "utf8");
assert(panel.includes("目前出價") && panel.includes("剩餘時間") && panel.includes("function BidSheet") && panel.includes('name="amount"') && !panel.includes("你的最高出價"), "auction detail is current bid, time left, and an amount-only sheet");
assert(panel.includes(">即買</button>") || panel.includes('"即買"'), "Buy It Now stays a button");

console.log("auction ok");
