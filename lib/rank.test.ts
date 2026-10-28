import { readFileSync } from "fs";
import {
  collectorEvents,
  dealAt,
  formatRankChange,
  merchantEvents,
  rankBucket,
  postRankLabel,
  rankDisplayName,
  rankMetricLabel,
  postEvents,
  rankPath,
  rankTab,
  rankTabStep,
  RANK_WINDOW_MS,
  sortRank,
  tallyRanks,
  type LikeRow,
  type VolumeRow,
} from "./rank";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-10-28T12:00:00+08:00");
const hours = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);

assert(rankTab(undefined) === "shops" && rankTab("nope") === "shops" && rankTab("collectors") === "collectors" && rankTab("posts") === "posts", "unknown segment stays on shops");
assert(rankPath("shops") === "/rank" && rankPath("collectors") === "/rank?tab=collectors" && rankPath("posts") === "/rank?tab=posts", "segments are a query on /rank");
assert(rankTabStep("shops", 1) === "collectors" && rankTabStep("collectors", 1) === "posts", "rank swipe moves 商戶, 收藏家, 貼文");
assert(rankTabStep("posts", -1) === "collectors" && rankTabStep("collectors", -1) === "shops", "rank swipe moves back");
assert(rankTabStep("shops", -1) === null && rankTabStep("posts", 1) === null, "rank segments stop at the ends");

assert(rankBucket(hours(1), now) === "current", "yesterday is the current window");
assert(rankBucket(hours(24 * 3 - 1), now) === "current", "just inside 3 days is current");
assert(rankBucket(hours(24 * 3), now) === "prior", "the 3-day mark starts the prior window");
assert(rankBucket(hours(24 * 6 - 1), now) === "prior", "just inside 6 days is the prior window");
assert(rankBucket(hours(24 * 6), now) === null && rankBucket(hours(-1), now) === null, "older and future events are outside both windows");

const paid = { paidAt: hours(5), completedAt: hours(1), createdAt: hours(8) };
assert(dealAt(paid).getTime() === paid.paidAt.getTime(), "a paid order counts from payment, not completion");
assert(dealAt({ paidAt: null, completedAt: hours(2), createdAt: hours(9) }).getTime() === hours(2).getTime(), "a completed unpaid row uses completion");

const orders: VolumeRow[] = [
  {
    sellerId: "mars",
    status: "COMPLETED",
    paidAt: hours(10),
    completedAt: hours(8),
    createdAt: hours(12),
    items: [
      { quantity: 2, tag: "寶可夢" },
      { quantity: 1, tag: "遊戲王" },
    ],
  },
  {
    sellerId: "mars",
    status: "PENDING_PAYMENT",
    paidAt: hours(1),
    completedAt: null,
    createdAt: hours(1),
    items: [{ quantity: 9, tag: "寶可夢" }],
  },
  {
    sellerId: "tyu",
    status: "CANCELLED",
    paidAt: hours(2),
    completedAt: null,
    createdAt: hours(2),
    items: [{ quantity: 4, tag: "航海王" }],
  },
  {
    sellerId: "tyu",
    status: "REFUNDED",
    paidAt: hours(3),
    completedAt: null,
    createdAt: hours(3),
    items: [{ quantity: 4, tag: "航海王" }],
  },
  {
    sellerId: "muel",
    status: "IN_ESCROW",
    paidAt: hours(24 * 4),
    completedAt: null,
    createdAt: hours(24 * 4),
    items: [{ quantity: 5, tag: "寶可夢" }],
  },
  {
    sellerId: "muel",
    status: "SHIPPED",
    paidAt: hours(20),
    completedAt: null,
    createdAt: hours(22),
    items: [{ quantity: 1, tag: null }],
  },
];

const shopScores = tallyRanks(merchantEvents(orders), now);
const mars = shopScores.find((row) => row.id === "mars");
const muel = shopScores.find((row) => row.id === "muel");
assert(mars?.current === 3 && mars.tags.join() === "寶可夢,遊戲王", "volume is units sold, tags follow the units");
assert(!shopScores.some((row) => row.id === "tyu"), "cancelled and refunded orders are not volume");
assert(mars && shopScores[0]?.id === "mars", "the higher current volume ranks first");
assert(muel?.current === 1 && muel.prior === 5 && muel.tags.length === 0, "the prior window is separate and empty tags stay off the row");
assert(merchantEvents(orders).every((event) => event.id !== "tyu"), "unpaid volume never becomes an event");

const likes: LikeRow[] = [
  { userId: "tyu", createdAt: hours(2), authorId: "mars", tags: ["PC", "FS"] },
  { userId: "muel", createdAt: hours(3), authorId: "mars", tags: ["PC"] },
  { userId: "mars", createdAt: hours(1), authorId: "mars", tags: ["PC"] },
  { userId: "mars", createdAt: hours(24 * 4), authorId: "tyu", tags: ["ISO"] },
  { userId: "tyu", createdAt: hours(24 * 7), authorId: "muel", tags: ["PC"] },
];
const collectors = tallyRanks(collectorEvents(likes), now);
assert(collectors.find((row) => row.id === "mars")?.current === 2, "two likes from other people count; the author's own like does not");
assert(!collectors.some((row) => row.id === "tyu"), "likes only in the prior window do not rank");
assert(!collectors.some((row) => row.id === "muel"), "a like older than 6 days is ignored");
assert(collectors[0]?.tags.join() === "PC,FS", "collector tags come from liked posts, not binder size");

const postScores = tallyRanks(postEvents([
  { postId: "p1", at: hours(1) },
  { postId: "p1", at: hours(5) },
  { postId: "p2", at: hours(24 * 4) },
  { postId: "p3", at: hours(24 * 7) },
]), now);
assert(postScores[0]?.id === "p1" && postScores[0].current === 2 && postScores[0].tags.length === 0, "a post ranks by likes in the current 3 days");
assert(!postScores.some((row) => row.id === "p2" || row.id === "p3"), "a post with likes only before the current window stays off the board");

assert(sortRank([
  { name: "b", current: 2, prior: 0 },
  { name: "a", current: 2, prior: 1 },
  { name: "c", current: 2, prior: 1 },
]).map((row) => row.name).join() === "a,c,b", "ties break on the prior window, then name");

assert(rankDisplayName("shops", { nickname: "Mars", storeName: " 火星卡店 " }) === "火星卡店", "a shop with a name shows the shop");
assert(rankDisplayName("shops", { nickname: "Mars", storeName: "  " }) === "Mars", "a blank shop name falls back to the member");
assert(rankDisplayName("collectors", { nickname: "Mars", storeName: "火星卡店" }) === "Mars", "a collector is the member, not the shop");
assert(postRankLabel({ body: "  開箱留低。 #PC  ", collectionItem: { title: "手持一疊卡", cardName: "噴火龍" } }, "zh-HK") === "開箱留低。", "a post rank label is the caption, without the topic token");
assert(postRankLabel({ body: "第一行\n第二行", collectionItem: null }, "zh-HK") === "第一行 第二行", "a post rank label stays one line");
assert(postRankLabel({ body: "   ", collectionItem: { title: "手持一疊卡", cardName: "噴火龍" } }, "zh-HK") === "噴火龍", "an empty caption uses the card name");
assert(postRankLabel({ body: "#PC", collectionItem: { title: "皮卡丘", cardName: null } }, "zh-HK") === "皮卡丘", "a tag-only caption falls back to the collection title");
assert(postRankLabel({ body: "", collectionItem: { title: "皮卡丘", cardName: " " } }, "zh-HK") === "皮卡丘", "a blank card name falls through to the collection title");
assert(postRankLabel({ body: "", collectionItem: { title: "  ", cardName: " " } }, "zh-HK") === "貼文" && postRankLabel({ body: "", collectionItem: null }, "en") === "Post", "a blank post still has a short label");

assert(rankMetricLabel("shops", 4, "zh-HK") === "近 3 日成交量 4", "shop metric is 3-day volume");
assert(rankMetricLabel("collectors", 2, "zh-HK") === "近 3 日獲讚 2", "collector metric is likes received");
assert(rankMetricLabel("posts", 4, "zh-HK") === "近 3 日讚好 4", "post metric is likes on that post");
assert(formatRankChange(4, 2, "zh-HK").text === "+100%" && formatRankChange(4, 2, "zh-HK").tone === "up", "growth vs the prior 3 days");
assert(formatRankChange(1, 4, "zh-HK").text === "-75%" && formatRankChange(1, 4, "zh-HK").tone === "down", "a drop is negative");
assert(formatRankChange(2, 2, "zh-HK").tone === "flat" && formatRankChange(3, 0, "zh-HK").tone === "new", "flat stays 0% and a first window is new");
assert(formatRankChange(3, 0, "en").text === "New", "a first window has no invented percent");
assert(RANK_WINDOW_MS === 3 * 24 * 60 * 60 * 1000, "the window is three days");

const src = readFileSync(new URL("./rank.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/rank/page.tsx", import.meta.url), "utf8");
const tab = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
assert(src.includes("postLike.findMany") && src.includes("order.findMany") && src.includes("Not saves, comments"), "post rank is likes, not binder size");
assert(!src.includes("collectionItem.count"), "binder size is not a score");
assert(src.includes("COUNTED_ORDER_STATUSES") && src.includes("paidAt"), "shop rank uses paid deal time");
const shopsAt = page.indexOf("人氣商戶");
const collectorsAt = page.indexOf("人氣收藏家");
const postsAt = page.indexOf("人氣貼文");
assert(page.includes("暫時未有排行。") && shopsAt >= 0 && shopsAt < collectorsAt && collectorsAt < postsAt, "three segments, shops then collectors then posts");
assert(page.includes("grid-cols-3"), "the switcher is one row of three tabs");
assert(page.includes("href={row.href}") && src.includes("`/shop/${user.id}`") && src.includes("`/post/${post.id}`"), "shops open a profile and posts open the post");
assert(src.includes("avatarUrl: post.author.avatarUrl") && src.includes("coverUrl: postCover(post)"), "a post row keeps the author avatar and puts the cover beside it");
assert(src.includes("name: postRankLabel(post, locale)") && src.includes("byline: post.author.nickname.trim()"), "a post row labels the caption and keeps the author as the byline");
assert(!src.includes("name: post.author.nickname"), "the author nickname is not the post rank title");
assert(page.includes("row.byline") && page.includes("row.name"), "the caption is the primary label and the author sits under it");
assert(src.includes("coverUrl: null") && !src.includes("/u/") && !page.includes("/u/"), "collectors stay on the shop profile");
assert(page.includes("row.coverUrl") && page.includes('name="bag"') && page.includes("M12 19.2"), "posts show the cover, shops a bag, likes a heart");
assert(!page.includes("成交") && !page.includes("likes") && !page.includes("Likes") && !page.includes("讚好"), "the row shows the icon and number, not a metric label");
assert(page.includes("#E0B53A") && page.includes("#B7C0C8") && page.includes("#C9844A"), "the first three ranks keep gold, silver, and bronze medals");
assert(page.includes("change.text"), "the percent change stays on the row");
assert(tab.includes('href: "/rank"') && tab.includes("排行") && tab.includes('icon: "rank"') && !tab.includes('href: "/market"'), "bottom nav fourth tab is rank");
assert(shell.includes('href="/rank"'), "desktop nav includes rank");
const pager = readFileSync(new URL("../components/rank-pager.tsx", import.meta.url), "utf8");
assert(page.includes("<RankPager") && pager.includes("rankTabStep") && pager.includes("data-rank-pager") && pager.includes("adjacentTab"), "rank content swipes segments, then the neighbouring root");
assert(pager.includes("tabAxis") && pager.includes("swipeBlocked"), "rank swipe waits for a horizontal axis and an open sheet");
assert(pager.includes("stopPropagation") && pager.includes("EDGE_GUARD") && pager.includes("setPointerCapture"), "rank owns the drag and leaves the left edge for back");
assert(
  pager.includes("style.transform") && pager.includes("translate3d") && !pager.includes("useState") && pager.includes("router.prefetch"),
  "rank drag paints on the node and prefetches the next segment",
);
assert(page.includes("prefetch={true}"), "segment links prefetch the full route instead of the loading shell");

console.log("rank.test.ts ok");
