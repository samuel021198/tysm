import { readFileSync } from "fs";
import { parseHiddenPostIds, splitHiddenKeys, withHiddenPost } from "./hide-posts";
import { cardDisplayName, collectionVisibility, listingSuggestionCard, ownedPostId, sellingAsk, shouldPublishPost, toPostCard } from "./posts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(collectionVisibility(null) === "PUBLIC", "collection defaults to public");
assert(collectionVisibility("PUBLIC") === "PUBLIC", "public stays public");
assert(collectionVisibility("PRIVATE") === "PRIVATE", "private is explicit");
assert(collectionVisibility("nope") === "PUBLIC", "unknown visibility is public");

assert(ownedPostId(null, "user_mei") === null, "missing post cannot be deleted");
assert(ownedPostId({ id: "p1", authorId: "user_ming" }, "user_mei") === null, "only the author can delete");
assert(ownedPostId({ id: "p1", authorId: "user_mei" }, "user_mei") === "p1", "the author can delete their post");

assert(shouldPublishPost({ forSale: true, listingPublished: true, publishToFeed: false }), "a live sale posts");
assert(!shouldPublishPost({ forSale: true, listingPublished: false, publishToFeed: false }), "a draft sale does not post");
assert(shouldPublishPost({ forSale: false, listingPublished: false, publishToFeed: true }), "collect-only can opt into a post");
assert(!shouldPublishPost({ forSale: false, listingPublished: false, publishToFeed: false }), "collect-only stays off the feed");
assert(shouldPublishPost({ forSale: true, listingPublished: true, publishToFeed: true }), "sale plus checkbox still posts once");

const quiet = { currentBid: null, startPrice: null, auctionSettled: false, quantityAvailable: 1, status: "ACTIVE" as const };
assert(sellingAsk(null) === null, "missing listing has no price");
assert(sellingAsk({ ...quiet, saleType: "BUY_NOW", price: 100, status: "DRAFT" }) === null, "draft is not selling");
assert(sellingAsk({ ...quiet, saleType: "BUY_NOW", price: 100, quantityAvailable: 0 }) === null, "sold out has no price");
assert(sellingAsk({ ...quiet, saleType: "BUY_NOW", price: 128000 }) === 128000, "buy now shows the price");
assert(
  sellingAsk({ ...quiet, saleType: "AUCTION", price: null, currentBid: 5000, startPrice: 2000 }) === 5000,
  "live auction shows the bid",
);
assert(
  sellingAsk({ ...quiet, saleType: "AUCTION", price: null, startPrice: 2000 }) === 2000,
  "auction with no bids shows the start",
);
assert(
  sellingAsk({ ...quiet, saleType: "AUCTION", price: null, currentBid: 5000, auctionSettled: true }) === null,
  "ended auction is not selling",
);
assert(
  sellingAsk({ ...quiet, saleType: "BOTH", price: 9000, currentBid: 4000, auctionSettled: true }) === 9000,
  "settled mixed listing falls back to buy now",
);

assert(cardDisplayName({ cardName: "噴火龍", title: "其他" }) === "噴火龍", "card name wins");
assert(cardDisplayName({ personName: "美斯", title: "卡" }) === "美斯", "person name is the card");
assert(cardDisplayName({ body: "  今日收卡  " }) === "今日收卡", "standalone post uses the caption");

const card = toPostCard({
  postId: "p1",
  body: "",
  author: { id: "u", nickname: "阿明", avatarUrl: null },
  photos: [],
  item: {
    title: "噴火龍 VMAX",
    cardName: "噴火龍",
    catalogCardId: "demo_card_charizard",
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
    photos: [{ url: "/demo/cards/seed_charizard.svg" }],
    listing: {
      id: "seed_charizard",
      status: "ACTIVE",
      quantityAvailable: 1,
      saleType: "BUY_NOW",
      price: 128000,
      currentBid: null,
      startPrice: null,
      auctionSettled: false,
      cardName: "噴火龍",
      personName: null,
      title: "噴火龍 VMAX",
    },
  },
  likeCount: 2,
  commentCount: 1,
  liked: false,
});
assert(card.priceCents === 128000, "selling post keeps the price");
assert(card.priceHref === "/listing/seed_charizard", "the price opens the listing");
assert(card.condition === "Raw A", "condition is on the card");
assert(card.commentHref === "/post/p1#comments", "comments go to the post");
assert(!card.href.includes("checkout"), "the card does not link to checkout");
assert(card.dexHref === "/dex/demo_card_charizard", "a linked card opens the dex");

const held = toPostCard({
  ...{
    postId: "p2",
    body: "",
    author: card.author,
    photos: [{ url: "/demo/a.svg" }],
    likeCount: 0,
    commentCount: 0,
    liked: false,
  },
  item: {
    title: "舊卡",
    cardName: "皮卡丘",
    conditionTrack: "RAW",
    rawGrade: "B",
    photos: [{ url: "/demo/a.svg" }],
    listing: null,
  },
});
assert(held.priceCents === null, "collect-only card has no price");
assert(held.priceHref === null, "a post without a sale has no price link");
assert(held.dexHref === null, "no catalog id means no dex link");

const suggestion = listingSuggestionCard({
  liked: true,
  listing: {
    id: "seed_luffy",
    title: "路飛",
    cardName: "路飛",
    personName: null,
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
    favoriteCount: 3,
    catalogCardId: "demo_card_luffy",
    status: "ACTIVE",
    quantityAvailable: 1,
    saleType: "BUY_NOW",
    price: 100,
    currentBid: null,
    startPrice: null,
    auctionSettled: false,
    photos: [{ url: "/demo/cards/seed_luffy.svg" }],
    seller: { id: "user_ming", nickname: "卡牌阿明", avatarUrl: null },
  },
});
assert(suggestion.commentHref === null, "listing suggestions do not invent a thread");
assert(suggestion.likeListingId === "seed_luffy", "suggestion likes reuse favorites");
assert(suggestion.priceCents === 100, "suggestion can show a price");
assert(suggestion.priceHref === "/listing/seed_luffy", "suggestion price opens the listing");
assert(suggestion.dexHref === "/dex/demo_card_luffy", "a suggested listing opens its dex card");

const collect = readFileSync(new URL("../actions/collect.ts", import.meta.url), "utf8");
const deleteStart = collect.indexOf("export async function deletePost");
const deleteEnd = collect.indexOf("export async function", deleteStart + 1);
const deletePost = collect.slice(deleteStart, deleteEnd);
assert(deletePost.includes("ownedPostId"), "delete checks the author");
assert(deletePost.includes("authorId: user.id"), "the delete query is scoped to the viewer");
assert(!deletePost.includes("collectionItem.delete") && !deletePost.includes("listing.delete"), "delete leaves the collection and listing");

assert(withHiddenPost(["post_a"], "post_b").join() === "post_a,post_b", "hide appends a post");
assert(withHiddenPost(["post_a", "post_b"], "post_a").join() === "post_b,post_a", "hiding again moves it to the end");
assert(withHiddenPost(["post_a"], "bad id").join() === "post_a", "hide ignores a bad id");
assert(parseHiddenPostIds("post_a,,post_b,post_a").join() === "post_a,post_b", "hide cookie drops blanks and dupes");
assert(parseHiddenPostIds(Array.from({ length: 70 }, (_, i) => `p${i}`).join(",")).length === 60, "hide cookie keeps the latest 60");
const split = splitHiddenKeys(["post_a", "listing-seed", "post_b"]);
assert(split.posts.join() === "post_a,post_b" && split.listings.join() === "listing-seed", "listing suggestions hide separately from posts");

const menu = readFileSync(new URL("../components/post-menu.tsx", import.meta.url), "utf8");
assert(menu.includes("剷除") && menu.includes("分享") && menu.includes("隱藏"), "post menu actions");
assert(menu.includes("deletePost") && menu.includes("hidePost") && menu.includes("shareUrl"), "menu reuses delete, hide, and share");
assert(menu.includes("deleteId ?"), "delete is omitted when the post is not yours");

console.log("posts.test.ts ok");
