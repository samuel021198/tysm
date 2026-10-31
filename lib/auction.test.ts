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
  mallCat,
  mallHref,
  mallSort,
  shopTab,
  shownReserveCents,
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

assert(shownReserveCents(150000, null, "seller") === null, "a guest does not see the reserve while the auction is live");
assert(shownReserveCents(150000, "buyer", "seller") === null, "a buyer does not see the reserve on a live auction");
assert(shownReserveCents(150000, "seller", "seller") === 150000, "the seller still sees their own reserve");
assert(shownReserveCents(null, "seller", "seller") === null, "a blank reserve stays blank");

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
assert(mallSort(undefined) === "new" && mallSort("price_asc") === "price_asc" && mallSort("price_desc") === "price_desc" && mallSort("ending") === "ending" && mallSort("relevance") === "new", "mall sort defaults to 最新上架");
assert(mallHref() === "/shop" && mallHref({ q: "  皮卡丘  ", sort: "new", tab: "all" }) === `/shop?q=${encodeURIComponent("皮卡丘")}`, "an empty mall search is /shop and a query is ?q=");
assert(mallHref({ tab: "new", q: "路飛", sort: "price_asc" }) === `/shop?tab=new&q=${encodeURIComponent("路飛")}&sort=price_asc`, "new, query, and price sort stay on /shop");
assert(mallHref({ tab: "shops" }) === "/shop?tab=shops", "the shops chip stays the store directory");
assert(mallCat(undefined) === "picks" && mallCat("picks") === "picks" && mallCat(" pokemon ") === "pokemon", "a blank category is 精選");
assert(NEW_LISTING_MS === 7 * 86400000, "新上架 is the last 7 days");

assert(!nextUnpaidStrike(2).banned && nextUnpaidStrike(2).consecutive === 3, "unpaid strikes never auto-ban");
assert(DEAL_STALE_MS === 3 * 86400000, "stale handover is three days");
assert(dealStale("CONFIRMED", new Date(now.getTime() - DEAL_STALE_MS), now), "confirmed past 3 days is stale");
assert(!dealStale("DONE", new Date(now.getTime() - DEAL_STALE_MS), now), "finished deals are not stale");

const shop = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../components/mall-board.tsx", import.meta.url), "utf8");
assert(shop.includes("currentBid") && shop.includes("storeName") && shop.includes("NEW_LISTING_MS") && shop.includes("listingQueryWhere") && !shop.includes("MallRails") && !shop.includes('href="/rank"'), "the mall loads listings without the old rails or a rank chip");
assert(board.includes("/shop/${store.id}") && board.includes("熱門商品") && board.includes("附近商戶") && board.includes("已關注") && board.includes('name="auction"') && board.includes("拍賣"), "tabs are hot, nearby shops, following, and auctions");
assert(board.includes("VerificationPill") && board.includes("avatarUrl") && board.includes("刊登貨品") && board.includes("暫未有拍賣。") && board.includes('href="/sell"') && !board.includes("listings[0]"), "nearby rows are avatar, name, pill, and counts; empty states offer 刊登貨品");
const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
assert(sell.includes("固定價") && sell.includes("起標價") && sell.includes("底價 HKD（選填・買家不可見）") && !sell.includes("買家唔見") && sell.includes("preferAuction") && sell.includes("AUCTION_DAYS") && sell.includes("1、3、5 或 7"), "any account can auction; reserve stays hidden; length is 1, 3, 5, or 7");
assert(sell.includes("即買價 HKD（選填）"), "BIN stays optional");
const panel = readFileSync(new URL("../components/purchase-panel.tsx", import.meta.url), "utf8");
assert(panel.includes("目前出價") && panel.includes("剩餘時間") && panel.includes("function BidSheet") && panel.includes('name="amount"') && !panel.includes("你的最高出價"), "auction detail is current bid, time left, and an amount-only sheet");
assert(panel.includes(">即買</button>") || panel.includes('"即買"'), "Buy It Now stays a button");
const listing = readFileSync(new URL("../app/listing/[id]/page.tsx", import.meta.url), "utf8");
assert(
  listing.includes("shownReserveCents(listing.reservePrice, viewer?.id, listing.sellerId)") &&
    listing.split("listing.reservePrice").length === 2 &&
    listing.includes("底價 ${formatHkd(reserveCents, locale)}") &&
    !listing.includes("live || owner") &&
    !listing.includes("買家睇唔到") &&
    listing.includes("relistFixedAction"),
  "reserve amount is seller-only on the listing page; unsold can relist fixed",
);
const feed = readFileSync(new URL("./feed.ts", import.meta.url), "utf8");
assert(feed.includes("publicCardSelect") && !feed.includes("reservePrice") && !feed.includes("cardInclude"), "public cards select fields and leave the reserve out");
const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const profileQuery = readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
const dexQuery = readFileSync(new URL("./dex-query.ts", import.meta.url), "utf8");
assert(
  search.includes("publicCardSelect") &&
    !search.includes("reservePrice") &&
    listing.includes("select: publicCardSelect") &&
    profileQuery.includes("select: publicCardSelect") &&
    dexQuery.includes("select: publicCardSelect"),
  "search, similar cards, shop grid, and dex sales use the public select",
);
const edit = readFileSync(new URL("../app/sell/[id]/page.tsx", import.meta.url), "utf8");
assert(edit.includes("reserve: centsToInput(listing.reservePrice)") && edit.includes("listing.sellerId !== viewer.id"), "the seller edit form still loads their reserve");
const orders = readFileSync(new URL("./orders.ts", import.meta.url), "utf8");
assert(orders.includes("attachDealThread") && orders.includes("settleAuction") && orders.includes("管理員人手處理"), "win opens settle chat; unpaid points at manual ban");
const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
assert(admin.includes("banBids") && admin.includes("禁拍") && admin.includes("liftBan"), "admin bans bids by hand");
const post = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
assert(post.includes('name="auction"') && post.includes("post.auction") && post.includes('href="/auction"') && post.includes("<Countdown"), "post 拍賣 chip opens the zone and shows time left");
const profile = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
assert(profile.includes('name="auction"') && profile.includes("拍賣") && profile.includes('href="/auction"') && profile.includes("<Countdown"), "profile tiles link to the zone and show time left");
const zone = readFileSync(new URL("../app/auction/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const find = readFileSync(new URL("../app/find/page.tsx", import.meta.url), "utf8");
assert(!home.includes("reservePrice") && !find.includes("reservePrice") && !zone.includes("reservePrice") && !shop.includes("reservePrice"), "feed, find, auction zone, and shop do not read the reserve");
assert(zone.includes('href="/sell?sale=auction"') && zone.includes("任何帳戶均可刊登拍賣") && zone.includes("暫未有拍賣。") && zone.includes("auctionEndsAt") && zone.includes("<Countdown") && !zone.includes("canListAuction"), "the zone is open to every account and shows time left");
assert(board.includes('href="/auction"') && board.includes("<Countdown") && board.includes('useState<Lane>("hot")') && !board.includes("router.push"), "auction cards show time left; mall tabs do not refresh the page");
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
