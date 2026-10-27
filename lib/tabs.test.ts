import { readFileSync } from "fs";
import { EDGE_GUARD, gestureEnd, SWIPE_X } from "./gesture";
import { shareLabel, shareTarget } from "./share";
import { adjacentTab, profileSwipeDirection, profileTabHref, profileTabStep, tabAxis, tabPagerIndex, tabSwipeDirection } from "./tabs";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(adjacentTab("/", 1, true) === "/news", "home swipe left opens news");
assert(adjacentTab("/news", -1, true) === "/", "news swipe right opens home");
assert(adjacentTab("/news", 1, true) === "/find", "news swipe left opens search");
assert(adjacentTab("/find", 1, true) === "/market", "search swipe left opens the market");
assert(adjacentTab("/market", -1, true) === "/find", "market swipe right opens search");
assert(adjacentTab("/market", 1, true) === "/me", "market swipe left opens profile");
assert(adjacentTab("/market", 1, false) === "/login", "logged-out profile tab is login");
assert(adjacentTab("/me", -1, true) === "/market", "profile swipe right opens the market");
assert(adjacentTab("/login", -1, false) === "/market", "login swipe right opens the market");
assert(adjacentTab("/", -1, true) === null && adjacentTab("/me", 1, true) === null, "the pager stops at the ends");
assert(tabPagerIndex("/listing/abc") === null && adjacentTab("/dex/card", 1, true) === null, "nested pages are not the pager");
assert(tabPagerIndex("/find") === 2 && tabPagerIndex("/me") === 4, "roots map onto the five tabs");

const page = { dy: 4, axis: "x" as const, viewportWidth: 390, owner: null };
assert(tabSwipeDirection({ ...page, dx: -SWIPE_X, startX: 180 }) === 1, "a horizontal swipe left moves forward");
assert(tabSwipeDirection({ ...page, dx: SWIPE_X, startX: 180 }) === -1, "a horizontal swipe right moves back");
assert(tabSwipeDirection({ ...page, dx: SWIPE_X, startX: EDGE_GUARD - 1 }) === null, "left-edge swipe right stays browser back");
assert(tabSwipeDirection({ ...page, dx: -40, startX: 180 }) === null, "a short drag does not change tabs");
assert(tabSwipeDirection({ ...page, dx: -80, dy: 90, axis: "y", startX: 180 }) === null, "vertical scroll does not change tabs");
assert(tabSwipeDirection({ ...page, dx: -SWIPE_X, startX: 180, owner: "carousel" }) === null, "a carousel keeps the swipe");
assert(tabSwipeDirection({ ...page, dx: -SWIPE_X, startX: 180, owner: "card" }) === null, "a feed card swipe stays the action menu");
assert(tabSwipeDirection({ ...page, dx: SWIPE_X, startX: 200, owner: "card" }) === null, "swipe right on a card stays the like");
assert(
  tabSwipeDirection({ ...page, dx: -SWIPE_X, startX: 390 - EDGE_GUARD + 1, owner: "card" }) === 1,
  "the right screen edge of a card moves to the next tab",
);
assert(profileTabStep("posts", 1) === "saved" && profileTabStep("saved", 1) === "selling", "profile tabs move My Binder, 收藏, 商店");
assert(profileTabStep("selling", 1) === "reviews" && profileTabStep("reviews", 1) === null, "評價 is the last profile tab");
assert(profileTabStep("posts", -1) === null && profileTabStep("saved", -1) === "posts", "the profile pager stops on My Binder");
assert(profileTabStep("drafts", 1) === "posts" && profileTabStep("drafts", -1) === null, "drafts swipe back onto My Binder");
assert(profileTabHref("/me?tab=posts&ok=saved", "reviews") === "/me?tab=reviews", "switching tabs drops the flash query");
assert(profileTabHref("/shop/user_tyu", "selling") === "/shop/user_tyu?tab=selling", "a shop board keeps its path");
assert(profileSwipeDirection({ ...page, dx: -SWIPE_X, startX: 180 }) === 1, "a profile swipe left moves forward");
assert(profileSwipeDirection({ ...page, dx: SWIPE_X, startX: EDGE_GUARD - 1 }) === null, "the profile board leaves the left edge for back");
assert(tabAxis(4, 3) === null && tabAxis(22, 4) === "x" && tabAxis(6, 20) === "y", "the pager waits for a clear axis");
assert(tabAxis(20, 18) === null, "a diagonal flick is not yet a tab swipe");

assert(
  gestureEnd({ dx: -SWIPE_X, dy: 4, startX: 390 - 8, axis: "x", allowRight: true, allowDown: false, edgeGuard: true, viewportWidth: 390 }) === null,
  "card menus yield a left swipe that starts on the right edge",
);
assert(
  gestureEnd({ dx: -SWIPE_X, dy: 4, startX: 180, axis: "x", allowRight: true, allowDown: false, edgeGuard: true, viewportWidth: 390 }) === "left",
  "a left swipe on the card body still opens the menu",
);

assert(shareTarget("/post/abc") === "/post/abc", "a post path can be shared inside");
assert(shareTarget("/listing/seed_charizard") === "/listing/seed_charizard", "a listing path can be shared inside");
assert(shareTarget("/dex/sv03.5-001") === "/dex/sv03.5-001", "a dex id can be shared inside");
assert(shareTarget("https://evil.example/post/abc") === null && shareTarget("//evil/post/a") === null, "off-site targets are dropped");
assert(shareTarget("/post/../admin") === null && shareTarget("/messages/thread") === null, "only post, listing, and dex paths");
assert(shareLabel("/listing/a", "zh-HK") === "貨品" && shareLabel("/dex/a", "en") === "Dex", "a shared card reads as a link");

const swipe = readFileSync(new URL("../components/tab-swipe.tsx", import.meta.url), "utf8");
const bar = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
assert(layout.includes("<TabSwipe") && layout.includes("loggedIn={Boolean(viewer)}"), "the pager wraps the page");
assert(swipe.includes("data-gesture") && swipe.includes("data-card-swipe") && swipe.includes('role="dialog"') && swipe.includes("pointerType"), "carousels, cards, and overlays keep their gestures");
assert(swipe.includes("setTabIntent") && bar.includes("subscribeTabIntent"), "the tab highlight follows the swipe");
const profileBoard = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
const hold = readFileSync(new URL("../components/use-hold-swipe.ts", import.meta.url), "utf8");
assert(profileBoard.includes("replaceState") && profileBoard.includes("data-profile-pager") && profileBoard.includes("data-gesture"), "profile tabs swap without a page load and keep the back gesture");
assert(profileBoard.includes("profileSwipeDirection") && profileBoard.includes("bg-ink"), "the profile underline follows the swipe");
assert(hold.includes("data-profile-pager") && hold.includes("data-gesture"), "profile tabs and photo carousels keep the post menu swipe");
assert(swipe.includes('document.getElementById("main")'), "the swipe starts on the page, not the tab bar");

const shareButton = readFileSync(new URL("../components/share-button.tsx", import.meta.url), "utf8");
const postCard = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
const messages = readFileSync(new URL("../app/messages/page.tsx", import.meta.url), "utf8");
const social = readFileSync(new URL("../actions/social.ts", import.meta.url), "utf8");
assert(shareButton.includes("internalLabel") && shareButton.includes("navigator.share") && shareButton.includes("clipboard"), "the sheet offers in-app share and the system share");
assert(postCard.includes("內部分享") && postCard.includes('name="messages"') && postCard.includes('name="book"'), "feed actions are icons, including in-app share");
assert(messages.includes("shareIntoThread") && messages.includes("內部分享"), "in-app share picks an existing thread");
assert(social.includes("export async function shareIntoThread") && social.includes("shareTarget"), "a shared card is sent as a message");

console.log("tabs.test.ts ok");
