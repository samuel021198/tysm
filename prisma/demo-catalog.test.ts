import { existsSync, readFileSync } from "fs";
import { authorizedBearer } from "../lib/bootstrap";
import { DEMO_SHOWCASE_NICKNAME, DEMO_SHOWCASE_USER_ID } from "../lib/demo-login";
import { resolveAuction } from "../lib/rules";
import {
  LEAF_CATEGORIES,
  demoCart,
  demoFavorites,
  demoFollows,
  demoListings,
  demoMessages,
  demoNotifications,
  demoOffers,
  demoShowcaseCollections,
  demoShowcaseListings,
  demoShowcasePosts,
  demoShowcaseReviews,
  demoThreads,
  demoUsers,
  showcasePostPhotos,
} from "./demo-catalog";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function unique(ids: string[], label: string) {
  assert(new Set(ids).size === ids.length, `${label} ids must be unique`);
}

const active = demoListings.filter((item) => item.status === "ACTIVE");
unique(demoListings.map((item) => item.id), "listing");
unique(demoUsers.map((user) => user.id), "user");
unique(
  demoListings.flatMap((item) => item.photos.map((photo) => photo.id)),
  "photo",
);
unique(
  demoListings.flatMap((item) => item.bids.map((bid) => bid.id)),
  "proxy",
);
unique(demoOffers.map((offer) => offer.id), "offer");
unique(demoMessages.map((message) => message.id), "message");
unique(demoNotifications.map((note) => note.id), "notification");
unique(demoFavorites.map((row) => row.id), "favorite");
unique(demoCart.map((row) => row.id), "cart");

assert(demoUsers.length >= 10, "need more demo users");
assert(active.length >= 56, "home feed should feel full");
for (const [id] of LEAF_CATEGORIES) {
  const rows = active.filter((item) => item.categoryId === id);
  assert(rows.length >= 7, `${id} needs at least 7 active listings`);
}
assert(active.some((item) => item.saleType === "BUY_NOW"), "buy now");
assert(active.filter((item) => item.saleType === "AUCTION").length >= 12, "auctions");
assert(active.filter((item) => item.saleType === "BOTH").length >= 6, "buy now plus auction");
assert(active.filter((item) => item.offersEnabled).length >= 10, "offers");
for (const grade of ["A", "B", "C", "D"] as const) {
  assert(active.some((item) => item.rawGrade === grade), `raw ${grade}`);
}
for (const grader of ["PSA", "BGS", "CGC", "TAG"] as const) {
  assert(active.filter((item) => item.grader === grader).length >= 3, grader);
}
const scores = new Set(active.map((item) => item.gradeValue).filter((value) => value != null));
for (const score of [100, 95, 90, 85]) assert(scores.has(score), `grade value ${score}`);
assert(scores.has(80), "PSA 8");

for (const item of active) {
  assert(/\p{Script=Han}/u.test(item.title), `${item.id} title needs Chinese`);
  assert(/[A-Za-z]/.test(item.title) && /[A-Za-z]/.test(item.description), `${item.id} needs English`);
  assert(item.photos[0]?.url === `/demo/cards/${item.id}.svg`, `${item.id} front art`);
  assert(item.photos[1]?.url === `/demo/cards/${item.id}-back.svg`, `${item.id} back art`);
  assert(item.photos[0].url !== item.photos[1].url, `${item.id} front and back differ`);
  const svgPath = new URL(`../public/demo/cards/${item.id}.svg`, import.meta.url);
  const backPath = new URL(`../public/demo/cards/${item.id}-back.svg`, import.meta.url);
  assert(existsSync(svgPath) && existsSync(backPath), `${item.id} svg missing`);
  const svg = readFileSync(svgPath, "utf8");
  const backSvg = readFileSync(backPath, "utf8");
  assert(svg.includes(item.zh) && svg.includes("#f7f1e8"), `${item.id} svg should render a card, not a black box`);
  assert(!svg.includes('fill="#000000"') && !backSvg.includes('fill="#000000"'), `${item.id} svg uses black fill`);
  assert(svg !== backSvg && backSvg.includes("背面"), `${item.id} back should not copy the front`);
  if (item.conditionTrack === "GRADED") assert(svg.includes("TYSM SLAB"), `${item.id} graded card should sit in a slab`);
  if (item.saleType !== "BUY_NOW") {
    assert(item.auctionHours != null && item.auctionHours > 0 && item.bids.length >= 2, `${item.id} live bids`);
    const resolved = resolveAuction(
      item.startPrice ?? 0,
      item.bids.map((bid) => ({ bidderId: bid.bidderId, maxAmount: bid.maxAmount, updatedAt: new Date(bid.at) })),
    );
    assert(resolved.leaderId && resolved.price >= (item.startPrice ?? 0), `${item.id} unresolved`);
  }
}

const byId = new Map(demoListings.map((item) => [item.id, item]));
for (const offer of demoOffers) {
  const listing = byId.get(offer.listingId);
  assert(listing && listing.offersEnabled && listing.sellerId !== offer.buyerId, offer.id);
  if (offer.status === "PENDING" || offer.status === "COUNTERED") {
    assert(listing.price != null && offer.amount >= (listing.minOffer ?? 0) && offer.amount < listing.price, offer.id);
    assert(offer.hours > 0, `${offer.id} should still be open`);
  }
  if (offer.status === "COUNTERED") {
    assert(offer.counterAmount != null && listing.price != null && offer.counterAmount < listing.price, offer.id);
  }
}
for (const row of demoCart) {
  const listing = byId.get(row.listingId);
  assert(listing && listing.status === "ACTIVE" && listing.price != null && listing.saleType !== "AUCTION", row.id);
  assert(listing.sellerId !== row.userId && row.quantity <= listing.quantityAvailable, row.id);
}
for (const thread of demoThreads) {
  assert(thread.buyerId !== thread.sellerId, thread.id);
  assert(demoMessages.filter((message) => message.threadId === thread.id).length >= 2, thread.id);
}
assert(demoThreads.length >= 4 && demoNotifications.length >= 8 && demoFavorites.length >= 8 && demoFollows.length >= 8, "social");

const back = readFileSync(new URL("../public/demo/back.svg", import.meta.url), "utf8");
assert(back.includes("卡背") && back.includes("#f7f1e8") && back.includes("#fffaf6") && back.includes("#1b1418"), "card back should stay readable");
const face = readFileSync(new URL("../public/demo/cards/seed_pikachu.svg", import.meta.url), "utf8");
assert(face.includes("<path") && face.includes("#1b1418"), "card face has a drawn motif");

assert(authorizedBearer("Bearer demo-secret", "demo-secret"), "bearer matches");
assert(!authorizedBearer("Bearer demo-secret", "other-secret"), "bearer rejects a mismatch");
assert(!authorizedBearer("demo-secret", "demo-secret"), "bearer requires the scheme");
assert(!authorizedBearer("Bearer ", "demo-secret"), "empty bearer is refused");
assert(!authorizedBearer("Bearer demo-secret", undefined), "missing secret is refused");
assert(!authorizedBearer("Bearer demo-secret", ""), "blank secret is refused");
const sweepRoute = readFileSync(new URL("../app/api/cron/sweep/route.ts", import.meta.url), "utf8");
assert(sweepRoute.includes("authorizedBearer") && sweepRoute.includes("CRON_SECRET") && sweepRoute.includes("BOOTSTRAP_SECRET"), "cron sweep checks a bearer secret");
assert(sweepRoute.includes("unconfigured") && sweepRoute.includes("unauthorized"), "cron sweep refuses a missing or wrong secret");
assert(!/export async function GET\(\)\s*\{/.test(sweepRoute), "cron sweep is not an open handler");
const cron = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
assert(cron.includes("0 16 * * *") && cron.includes("/api/cron/sweep") && !cron.includes("*/10"), "publish sweep runs once per day (Hobby cron limit)");

const showcase = demoUsers.find((user) => user.id === DEMO_SHOWCASE_USER_ID);
assert(showcase && showcase.nickname === DEMO_SHOWCASE_NICKNAME && showcase.role === "USER", "showcase user");
assert("email" in showcase && showcase.email === "showcase@tysm.hk", "showcase email stays off the 123 path");
const avatar = "avatarUrl" in showcase ? showcase.avatarUrl : undefined;
assert(typeof avatar === "string" && avatar.startsWith("https://") && !avatar.includes("/demo/cards/"), "showcase avatar");
const mei = demoUsers.find((user) => user.id === "user_mei");
const ming = demoUsers.find((user) => user.id === "user_ming");
assert(mei && "email" in mei && mei.email === "mei@tysm.hk", "mei login unchanged");
assert(ming && "email" in ming && ming.email === "ming@tysm.hk" && ming.phone === "+85291111111", "ming login unchanged");

const userIds = new Set(demoUsers.map((user) => user.id));
const showcaseListingIds = new Set(demoListings.map((item) => item.id));
unique(demoShowcaseListings.map((item) => item.id), "showcase listing");
unique(demoShowcaseCollections.map((item) => item.id), "showcase collection");
unique(demoShowcasePosts.map((item) => item.id), "showcase post");
unique(demoShowcaseReviews.map((item) => item.id), "showcase review");
unique(demoShowcaseReviews.map((item) => item.orderId), "showcase order");
assert(demoShowcasePosts.length >= 12, "showcase posts");
assert(demoShowcaseCollections.length >= 12, "showcase collections");
assert(demoShowcaseListings.length >= 9, "showcase shop");
assert(demoShowcaseReviews.length >= 6, "showcase reviews");
const publicCollections = demoShowcaseCollections.filter((item) => item.visibility === "PUBLIC");
assert(publicCollections.length >= 10 && publicCollections.length > demoShowcaseCollections.length / 2, "collections are mostly public");
const shown = demoShowcasePosts.map((post) => showcasePostPhotos(post));
assert(shown.some((photos) => photos.length === 1) && shown.some((photos) => photos.length > 1), "posts mix one and many photos");
for (const post of demoShowcasePosts) {
  const item = demoShowcaseCollections.find((row) => row.id === post.collectionId);
  assert(item, post.id);
  assert(post.body.trim().length > 0, post.id);
}
for (const url of [
  avatar,
  ...demoShowcaseListings.flatMap((item) => item.photos),
  ...demoShowcaseCollections.flatMap((item) => item.photos),
  ...shown.flat(),
]) {
  assert(url.startsWith("https://images.unsplash.com/") || url.startsWith("https://images.pexels.com/"), url);
  assert(!url.includes("/demo/cards/") && !url.endsWith(".svg"), url);
}
for (const item of demoShowcaseListings) {
  assert(!showcaseListingIds.has(item.id), item.id);
  assert(item.photos.length >= 1 && item.priceCents > 0, item.id);
}
for (const review of demoShowcaseReviews) {
  assert(review.authorId !== DEMO_SHOWCASE_USER_ID && userIds.has(review.authorId), review.id);
  assert(demoShowcaseListings.some((item) => item.id === review.listingId), review.id);
  assert(review.stars >= 1 && review.stars <= 5 && review.comment.length > 0, review.id);
}
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
assert(auth.includes("demoShowcaseLogin") && auth.includes("DEMO_SHOWCASE_CODE") && auth.includes("DEMO_SHOWCASE_USER_ID"), "123 signs into the showcase user");
const loginForm = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
assert(loginForm.includes("DEMO_SHOWCASE_TARGET") && loginForm.includes("DEMO_SHOWCASE_CODE"), "login details show 123 / 123");
const reseed = readFileSync(new URL("../app/api/internal/reseed/route.ts", import.meta.url), "utf8");
assert(reseed.includes("export const maxDuration = 120"), "reseed maxDuration is 120");

console.log("demo catalog ok", {
  listings: demoListings.length,
  active: active.length,
  users: demoUsers.length,
});
