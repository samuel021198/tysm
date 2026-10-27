import { existsSync, readFileSync } from "fs";
import { authorizedBearer } from "../lib/bootstrap";
import { DEMO_CARDS } from "../lib/demo-dex";
import { DEMO_ACCOUNTS, DEMO_CODE, TRIAL_ACCOUNTS } from "../lib/demo-login";
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

assert(demoUsers.filter((user) => user.role === "USER").length === DEMO_ACCOUNTS.length + TRIAL_ACCOUNTS.length, "three locked demos plus ten traders");
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
assert(demoThreads.length >= 4 && demoNotifications.length >= 8 && demoFavorites.length >= 8, "social fixtures stay in the art catalog");

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

const people = demoUsers.filter((user) => user.role === "USER");
assert(people.slice(0, 3).map((user) => user.nickname).join() === "Mars,Tyu,MueL", "locked display names stay exact");
assert(people.slice(0, 3).every((user, index) => user.id === DEMO_ACCOUNTS[index].id && user.nickname === DEMO_ACCOUNTS[index].nickname), "seed users match the login accounts");
assert(people.slice(3).every((user, index) => user.id === TRIAL_ACCOUNTS[index].id && user.nickname === TRIAL_ACCOUNTS[index].nickname), "trial traders keep their handles");
const admin = demoUsers.find((user) => user.role === "ADMIN");
assert(admin && admin.id === "user_admin" && !("email" in admin), "admin stays a system account, not a login-page demo");
for (const person of people) {
  const avatar = "avatarUrl" in person ? person.avatarUrl : undefined;
  assert(typeof avatar === "string" && avatar.startsWith("https://") && !avatar.includes("/demo/cards/"), person.id);
}
assert(!demoUsers.some((user) => user.nickname === "卡桌阿傑" || user.id === "user_showcase" || user.id === "user_mei"), "old demo accounts are gone");

const demoIds = new Set<string>(people.map((user) => user.id));
const lockedIds = DEMO_ACCOUNTS.map((row) => row.id);
const traderIds = TRIAL_ACCOUNTS.map((row) => row.id);
for (const a of lockedIds) {
  for (const b of lockedIds) {
    if (a === b) continue;
    assert(demoFollows.some((row) => row.followerId === a && row.sellerId === b), `${a} follows ${b}`);
  }
  for (const b of traderIds) assert(demoFollows.some((row) => row.followerId === a && row.sellerId === b), `${a} follows ${b}`);
}
const mutualTraders = traderIds.filter((id) =>
  traderIds.some(
    (other) =>
      other !== id &&
      demoFollows.some((row) => row.followerId === id && row.sellerId === other) &&
      demoFollows.some((row) => row.followerId === other && row.sellerId === id),
  ),
);
assert(mutualTraders.length >= 8, "some traders follow each other");

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
assert(shown.every((photos) => photos.length >= 2 && photos.length <= 4), "posts carry two to four photos");
assert(shown.some((photos) => photos.length >= 3), "some posts are longer carousels");
for (const post of demoShowcasePosts) {
  const item = demoShowcaseCollections.find((row) => row.id === post.collectionId);
  assert(item && item.ownerId === post.ownerId && demoIds.has(post.ownerId), post.id);
  assert(post.body.trim().length > 0, post.id);
  assert(post.tags.length >= 1 && post.tags.length <= 3, post.id);
  const sentences = post.body
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .split(/[。！？]/)
    .map((part) => part.trim())
    .filter(Boolean);
  assert(sentences.length >= 2 && sentences.length <= 4, `${post.id} captions`);
  if (item.listingId) assert(post.tags.some((tag) => tag === "FS" || tag === "賣"), `${post.id} selling topic`);
  else assert(post.tags.includes("PC"), `${post.id} collection topic`);
}
for (const person of people) {
  assert(demoShowcasePosts.filter((post) => post.ownerId === person.id).length >= 3, `${person.id} posts`);
}
const publicPosts = demoShowcasePosts.filter((post) => demoShowcaseCollections.find((item) => item.id === post.collectionId)?.visibility === "PUBLIC");
const sellingPosts = publicPosts.filter((post) => demoShowcaseCollections.find((item) => item.id === post.collectionId)?.listingId);
const showcaseShare = (publicPosts.length - sellingPosts.length) / publicPosts.length;
assert(showcaseShare >= 0.55 && showcaseShare <= 0.65, "feed is mostly showcase");
for (const item of demoShowcaseListings) assert(demoIds.has(item.ownerId), item.id);
for (const item of demoShowcaseCollections) assert(demoIds.has(item.ownerId), item.id);
for (const url of [
  ...people.flatMap((person) => ("avatarUrl" in person && person.avatarUrl ? [person.avatarUrl] : [])),
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
  const listing = demoShowcaseListings.find((item) => item.id === review.listingId);
  assert(listing && review.authorId !== listing.ownerId && userIds.has(review.authorId), review.id);
  assert(review.stars >= 1 && review.stars <= 5 && review.comment.length > 0, review.id);
}
for (const item of demoShowcaseCollections) {
  const owned = demoShowcaseListings.filter((row) => row.ownerId === item.ownerId);
  const match =
    owned.find((row) => row.title === item.title) ||
    owned.find((row) => row.photos.join("|") === item.photos.join("|"));
  assert((item.listingId ?? null) === (match?.id ?? null), `${item.id} should link the matching listing`);
}
const dexIds = new Set(DEMO_CARDS.map((card) => card.id));
const tagged = [...demoShowcaseCollections, ...demoShowcaseListings].filter((item) => item.catalogCardId);
assert(tagged.length >= 4, "a few showcase rows open the dex");
for (const item of tagged) assert(item.catalogCardId && dexIds.has(item.catalogCardId), item.id);
assert(demoShowcaseCollections.some((item) => item.catalogCardId && !item.listingId), "an unlisted card keeps a dex id for 放賣");
assert(demoShowcaseListings.some((item) => item.catalogCardId), "a live listing can open the dex");
for (const thread of demoThreads) {
  assert(userIds.has(thread.buyerId) && userIds.has(thread.sellerId), thread.id);
  const listing = demoShowcaseListings.find((item) => item.id === thread.listingId);
  assert(listing && listing.ownerId === thread.sellerId, `${thread.id} listing`);
}
for (const message of demoMessages) assert(userIds.has(message.senderId), message.id);
for (const note of demoNotifications) assert(userIds.has(note.userId), note.id);
for (const row of demoFavorites) {
  assert(userIds.has(row.userId), row.id);
  const listing = demoShowcaseListings.find((item) => item.id === row.listingId);
  assert(listing && listing.ownerId !== row.userId, row.id);
}
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
assert(auth.includes("demoAccountByHandle") && auth.includes("DEMO_CODE") && auth.includes("enterDemo"), "handle plus 123, and a one-tap action");
const loginPage = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const loginForm = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
assert(loginPage.indexOf("<LoginForm") < loginPage.indexOf("DEMO_ACCOUNTS.map"), "demo accounts sit below the login form");
assert(loginPage.includes("fixed") && loginPage.includes("bottom-[var(--tab-h)]") && loginPage.includes("enterDemo") && loginPage.includes("DEMO_CODE"), "one-tap demos are pinned to the bottom");
const demoLogin = readFileSync(new URL("../lib/demo-login.ts", import.meta.url), "utf8");
for (const name of ["Mars", "Tyu", "MueL"]) assert(demoLogin.includes(`nickname: "${name}"`), name);
assert(loginPage.includes("account.nickname"), "buttons show the demo display names");
assert(loginPage.includes("DEMO_ACCOUNTS.map") && !loginPage.includes("TRIAL_ACCOUNTS"), "one-tap buttons stay Mars, Tyu, and MueL");
assert(!loginPage.includes("卡桌阿傑") && !loginForm.includes("卡桌阿傑") && !loginForm.includes("mei@tysm.hk"), "old demos are off the login page");
assert(DEMO_CODE === "123", "shared demo code");
const reseed = readFileSync(new URL("../app/api/internal/reseed/route.ts", import.meta.url), "utf8");
assert(reseed.includes("export const maxDuration = 120"), "reseed maxDuration is 120");
const seed = readFileSync(new URL("../lib/seed-demo.ts", import.meta.url), "utf8");
assert(seed.includes("wipeUserContent") && seed.includes("user.deleteMany") && seed.includes("post.deleteMany") && seed.includes("listing.deleteMany"), "reseed wipes users and posts");
assert(!seed.includes("catalogCard.deleteMany") && !seed.includes("catalogSet.deleteMany"), "reseed does not wipe the dex");
assert(!seed.includes("user_mei") && !seed.includes("user_showcase") && !seed.includes("卡桌阿傑"), "reseed does not recreate the old demo set");
assert(seed.includes("demoThreads") && seed.includes("demoMessages") && seed.includes("demoNotifications") && seed.includes("demoFavorites"), "reseed writes chat, the bell, and favorites");
assert(seed.includes("item.listingId") && seed.includes("attachShowcaseDex"), "reseed links collection rows to listings and the dex");

console.log("demo catalog ok", {
  listings: demoListings.length,
  active: active.length,
  users: demoUsers.length,
});
