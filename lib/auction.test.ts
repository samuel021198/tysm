import { readFileSync } from "fs";
import {
  AUCTION_DAY_MAX,
  AUCTION_DAY_MIN,
  NEW_LISTING_MS,
  auctionOutcome,
  auctionSchedule,
  isAuctionDays,
  publicIncrementCents,
  publicMinimumBid,
  shopTab,
} from "./auction";
import { buyerDescription, displayPhoto } from "./demo-covers";
import { bidIncrementCents, DEAL_STALE_MS, nextUnpaidStrike } from "./rules";
import { dealStale } from "./deal-phase";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(publicIncrementCents(10000) === bidIncrementCents(10000), "public raise uses the shared step");
assert(publicIncrementCents(10000) === 1000, "HK$100 raises by HK$10");
assert(publicIncrementCents(11000) === 1000 && publicMinimumBid(11000, 11000, true) === 12000, "HK$110 next minimum is HK$120");
assert(publicIncrementCents(80000) === 4000, "HK$800 raises by 5% (HK$40)");
assert(publicIncrementCents(19900) === 1000, "under HK$200 the HK$10 floor wins");
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
assert(isAuctionDays(1) && isAuctionDays(3) && isAuctionDays(5) && isAuctionDays(7) && !isAuctionDays(2) && !isAuctionDays(14) && !isAuctionDays(0) && !isAuctionDays(15), "length is 1, 3, 5, or 7");
assert(AUCTION_DAY_MIN === 1 && AUCTION_DAY_MAX === 7, "longest chip is 7 days");
assert(shopTab(undefined) === "all" && shopTab("new") === "new" && shopTab("auction") === "auction" && shopTab("shops") === "shops" && shopTab("nope") === "all", "mall chips");
assert(NEW_LISTING_MS === 7 * 86400000, "新上架 is the last 7 days");

assert(!nextUnpaidStrike(2).banned && nextUnpaidStrike(2).consecutive === 3, "unpaid strikes never auto-ban");
assert(DEAL_STALE_MS === 3 * 86400000, "stale handover is three days");
assert(dealStale("CONFIRMED", new Date(now.getTime() - DEAL_STALE_MS), now), "confirmed past 3 days is stale");
assert(!dealStale("DONE", new Date(now.getTime() - DEAL_STALE_MS), now), "finished deals are not stale");

const shop = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
assert(shop.includes("全部") && shop.includes("新上架") && shop.includes("拍賣") && shop.includes("商店") && shop.includes('href="/rank"') && shop.includes("排行"), "mall chips are 全部, 新上架, 拍賣, 商店, plus 排行");
assert(shop.includes("currentBid") && shop.includes("storeName") && shop.includes("/shop/${store.id}") && shop.includes("NEW_LISTING_MS"), "listing cards show the bid and the store; 新上架 uses the recent window");
assert(shop.includes('name="auction"') && shop.includes("拍賣"), "shop mall cards show the auction entry");
assert(shop.includes("VerificationPill") && shop.includes("avatarUrl") && shop.includes("刊登貨品") && shop.includes("暫未有拍賣。") && shop.includes('href="/sell"') && !shop.includes("listings[0]"), "store rows are avatar, name, pill, and counts; empty states offer 刊登貨品");
const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
assert(sell.includes("固定價") && sell.includes("起標價") && sell.includes("底價 HKD（選填・買家不可見）") && !sell.includes("買家唔見") && sell.includes("preferAuction") && sell.includes("AUCTION_DAYS") && sell.includes("1、3、5 或 7"), "any account can auction; reserve stays hidden; length is 1, 3, 5, or 7");
assert(sell.includes("即買價 HKD（選填）"), "BIN stays optional");
const panel = readFileSync(new URL("../components/purchase-panel.tsx", import.meta.url), "utf8");
assert(panel.includes("目前出價") && panel.includes("剩餘時間") && panel.includes("function BidSheet") && panel.includes('name="amount"') && !panel.includes("你的最高出價"), "auction detail is current bid, time left, and an amount-only sheet");
assert(panel.includes(">即買</button>") || panel.includes('"即買"'), "Buy It Now stays a button");
const listing = readFileSync(new URL("../app/listing/[id]/page.tsx", import.meta.url), "utf8");
assert(listing.includes("owner && listing.reservePrice") && listing.includes("底價 ${formatHkd(listing.reservePrice, locale)}") && !listing.includes("買家睇唔到") && listing.includes("relistFixedAction"), "reserve is owner-only; unsold can relist fixed");
const orders = readFileSync(new URL("./orders.ts", import.meta.url), "utf8");
assert(orders.includes("attachDealThread") && orders.includes("settleAuction") && orders.includes("管理員人手處理"), "win opens settle chat; unpaid points at manual ban");
const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
assert(admin.includes("banBids") && admin.includes("禁拍") && admin.includes("liftBan"), "admin bans bids by hand");
const post = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
assert(post.includes('name="auction"') && post.includes("post.auction") && post.includes('href="/auction"') && post.includes("<Countdown"), "post 拍賣 chip opens the zone and shows time left");
const profile = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
assert(profile.includes('name="auction"') && profile.includes("拍賣") && profile.includes('href="/auction"') && profile.includes("<Countdown"), "profile tiles link to the zone and show time left");
const zone = readFileSync(new URL("../app/auction/page.tsx", import.meta.url), "utf8");
assert(zone.includes('href="/sell?sale=auction"') && zone.includes("任何帳戶均可刊登拍賣") && zone.includes("暫未有拍賣。") && zone.includes("auctionEndsAt") && zone.includes("<Countdown") && !zone.includes("canListAuction"), "the zone is open to every account and shows time left");
assert(shop.includes('href="/auction"') && shop.includes("<Countdown"), "the shop 拍賣 chip opens the zone and cards show time left");
const inventory = readFileSync(new URL("../components/shop-inventory.tsx", import.meta.url), "utf8");
assert(inventory.includes('name="auction"'), "own shop inventory marks auctions");
const greenZard = "https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/uploads/listings/6d83b20f6759074beffc8493.jpg";
const greenYuan = "https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/uploads/listings/e231693f8a4aa3b27934df3c.jpg";
assert(displayPhoto(greenZard) === "/demo/photos/charizard.webp" && displayPhoto(greenYuan) === "/demo/photos/pikachu.webp", "the QA green covers render as real card files");
assert(displayPhoto("/demo/cards/seed_charizard.svg") === "/demo/photos/charizard.webp" && displayPhoto("/demo/other.svg") === "/demo/other.svg", "seed charizard svg is swapped; other art stays");
const leaked = buyerDescription("Soft-launch QA auction. Start 100, reserve 200, BIN 500, 1 day.");
assert(leaked === "Soft-launch QA auction. Start 100, BIN 500, 1 day." && !leaked.toLowerCase().includes("reserve"), "public copy drops the reserve amount");
const covers = readFileSync(new URL("./demo-covers.ts", import.meta.url), "utf8");
const refresh = readFileSync(new URL("../scripts/refresh-demo-covers.ts", import.meta.url), "utf8");
assert(covers.includes("QA soft-launch 拍賣 Charizard") && covers.includes("QA 拍賣測試 1元") && refresh.includes("DEMO_COVERS") && refresh.includes("--apply") && refresh.includes('startsWith: "seed_"') && !refresh.includes("user.delete") && !refresh.includes("listing.delete"), "refresh rewrites only known demo covers");
assert(zone.includes("displayPhoto") && listing.includes("buyerDescription"), "the zone and the listing page use the cover and description swaps");

console.log("auction ok");
