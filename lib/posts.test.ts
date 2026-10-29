import { readFileSync } from "fs";
import { cleanComment, cleanCommentImage, commentWrite, COMMENT_REACTS, replyDraft, tenorGif } from "./comments";
import { EDGE_GUARD, gestureEnd, HOLD_MS, lockAxis, SWIPE_DOWN, SWIPE_X } from "./gesture";
import { cardDisplayName, collectionBoardNext, collectionVisibility, hideTarget, listingPageHref, listingSuggestionCard, ownedPostId, postBuy, postEditHref, postMenuFlags, POST_MENU_ORDER, reportTarget, sellingAsk, shouldPublishPost, toPostCard, wishlistPostVisible } from "./posts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(collectionVisibility(null) === "PUBLIC", "collection defaults to public");
assert(collectionVisibility("PUBLIC") === "PUBLIC", "public stays public");
assert(collectionVisibility("PRIVATE") === "PRIVATE", "private is explicit");
assert(collectionVisibility("nope") === "PUBLIC", "unknown visibility is public");
assert(collectionBoardNext("/me?tab=box&ok=saved") === "/me?tab=box", "toggling on /me stays on the box tab");
assert(collectionBoardNext("/shop/user_tyu?tab=box") === "/shop/user_tyu?tab=box", "toggling on a shop stays on that shop");
assert(collectionBoardNext("/shop/user_tyu") === "/shop/user_tyu?tab=box", "a shop without a tab returns to the box");
assert(collectionBoardNext("https://evil.example/admin") === "/me?tab=box", "a foreign path does not leave the profile");
assert(collectionBoardNext("/me/settings") === "/me?tab=box", "settings is not a collection board");

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
  saved: true,
});
assert(card.postId === "p1" && card.listingId === "seed_charizard", "selling post keeps both ids");
assert(card.savePostId === "p1" && card.saved && card.saveListingId === null, "a post saves into the wishlist");
assert(card.priceCents === 128000, "selling post keeps the price");
assert(card.priceHref === null && card.buy?.kind === "deal" && card.buy.listingId === "seed_charizard", "a priced post hands over in chat, not checkout");
assert(card.condition === "Raw A", "condition is on the card");
assert(card.commentHref === "/post/p1#comments", "a post keeps its comment thread");
assert(cleanComment("  你好  ") === "你好", "a comment trims");
assert(cleanComment("   ") === null && cleanComment("a".repeat(301)) === null, "empty and oversized comments are dropped");
assert(cleanComment("a".repeat(300))?.length === 300, "300 characters still fit");
const jpeg = `data:image/jpeg;base64,${"a".repeat(40)}`;
const tenorGifUrl = "https://media.tenor.com/images/example1/tenor.gif";
assert(cleanCommentImage(jpeg) === jpeg, "a jpeg upload is a comment photo");
assert(cleanCommentImage(`data:image/gif;base64,${"a".repeat(40)}`) === null, "gif data urls stay off the photo path");
assert(cleanCommentImage(tenorGifUrl) === tenorGifUrl, "a tenor gif link is kept");
assert(cleanCommentImage("https://media.giphy.com/media/abc/giphy.gif")?.endsWith("giphy.gif"), "a giphy link is kept");
assert(cleanCommentImage("https://c.tenor.com/clip.gif") === "https://c.tenor.com/clip.gif", "tenor content host is kept");
assert(cleanCommentImage("https://tenor.com/view/excited-gif-1") === null, "a tenor page is not an image");
assert(cleanCommentImage("https://evil.example/a.gif") === null, "an unknown gif host is dropped");
assert(cleanCommentImage("http://media.tenor.com/a.gif") === null && cleanCommentImage("") === null, "http and blank images are dropped");
const textOnly = commentWrite("  你好  ", "");
const gifOnly = commentWrite("", tenorGifUrl);
const photoOnly = commentWrite("", jpeg);
const emptyComment = commentWrite("", "");
const oversizedComment = commentWrite("a".repeat(301), tenorGifUrl);
const badHost = commentWrite("hi", "https://evil.example/a.gif");
assert(textOnly.ok && textOnly.body === "你好" && textOnly.imageUrl === null, "text comments stay text");
assert(gifOnly.ok && gifOnly.imageUrl === tenorGifUrl && gifOnly.body === "", "a gif can be the whole comment");
assert(photoOnly.ok && photoOnly.imageUrl === jpeg, "a photo can be the whole comment");
assert(!emptyComment.ok && emptyComment.error === "comment", "an empty composer is rejected");
assert(!oversizedComment.ok && oversizedComment.error === "comment", "oversized text is rejected even with a gif");
assert(!badHost.ok && badHost.error === "photo_url", "a bad attachment is rejected");
const picked = tenorGif({ id: "16716839537051746769", media_formats: { gif: { url: tenorGifUrl }, tinygif: { url: "https://media.tenor.com/images/example1/tenor-small.gif" } } });
assert(picked?.url === tenorGifUrl && picked.previewUrl.endsWith("tenor-small.gif"), "a tenor row keeps the preview and the gif");
assert(tenorGif({ id: "1", media_formats: { gif: { url: "https://evil.example/a.gif" } } }) === null, "a tenor row drops an unknown host");
assert(replyDraft("阿明", "hello") === "@阿明 hello", "reply prefixes the nickname");
assert(replyDraft("阿明", "@舊 hello") === "@阿明 hello", "a new reply replaces the previous mention");
assert(COMMENT_REACTS.includes("❤️") && COMMENT_REACTS.length === 8, "quick reacts stay a short row");
assert(!card.href.includes("checkout"), "the photo still opens the post");
assert(!("dexHref" in card) && card.priceHref == null && !card.href.includes("/dex"), "a post does not link into the dex");

const held = toPostCard({
  ...{
    postId: "p2",
    body: "#PC",
    author: card.author,
    photos: [{ url: "/demo/a.svg" }],
    likeCount: 0,
    commentCount: 0,
    liked: false,
    saved: false,
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
assert(held.postId === "p2" && held.listingId === null, "collect post has no listing");
assert(held.priceCents === null && held.priceHref === null && held.buy === null, "a #PC showcase post has no price and no buy");
assert(held.caption === "", "a topic-only #PC post does not invent a caption line");
assert(postBuy(null) === null, "no listing is not for sale");

const suggestion = listingSuggestionCard({
  saved: true,
  listing: {
    id: "seed_luffy",
    title: "路飛",
    cardName: "路飛",
    personName: null,
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
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
assert(suggestion.postId === null && suggestion.listingId === "seed_luffy", "suggestion is a listing, not a post");
assert(suggestion.commentHref === null, "listing suggestions do not invent a thread");
assert(suggestion.saveListingId === "seed_luffy" && suggestion.saved, "suggestion saves reuse favorites");
assert(suggestion.likeListingId === null && suggestion.likePostId === null, "a suggestion does not pretend a favorite is a like");
assert(wishlistPostVisible({ authorId: "a", collectionItem: null }, "me", new Set()), "a plain post stays on the wishlist");
assert(!wishlistPostVisible({ authorId: "a", collectionItem: null }, "me", new Set(["a"])), "a blocked author leaves the wishlist");
assert(
  !wishlistPostVisible({ authorId: "a", collectionItem: { visibility: "PRIVATE", ownerId: "a" } }, "me", new Set()),
  "someone else's private card leaves the wishlist",
);
assert(
  wishlistPostVisible({ authorId: "me", collectionItem: { visibility: "PRIVATE", ownerId: "me" } }, "me", new Set()),
  "the owner still sees their own private card",
);
assert(suggestion.caption === "", "a listing suggestion has no post caption");
assert(suggestion.priceCents === 100, "suggestion can show a price");
assert(suggestion.priceHref === null && suggestion.buy?.kind === "deal" && suggestion.buy.listingId === "seed_luffy", "suggestion price does not open checkout");
assert(suggestion.href === "/listing/seed_luffy", "a listing with no post still opens the listing");
const linkedSuggestion = listingSuggestionCard({
  saved: false,
  postId: "post_luffy",
  listing: {
    id: "seed_luffy",
    title: "路飛",
    cardName: "路飛",
    personName: null,
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
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
assert(linkedSuggestion.href === "/post/post_luffy" && linkedSuggestion.sharePath === "/post/post_luffy" && linkedSuggestion.priceHref === null, "a feed card for a sell post opens the post");
assert(listingPageHref(null) === null, "a post with no listing has no 睇貨頁");
assert(listingPageHref({ id: "seed_luffy", status: "ACTIVE" }) === "/listing/seed_luffy", "a live listing opens from the post");
assert(listingPageHref({ id: "sold1", status: "SOLD" }) === "/listing/sold1", "a sold listing still opens for specs and 收藏");
assert(listingPageHref({ id: "draft1", status: "DRAFT" }) === null, "a draft listing stays off the post");
assert(listingPageHref({ id: "draft1", status: "UNLISTED" }, true) === "/listing/draft1", "the owner can still open an unlisted sale");

const auction = toPostCard({
  postId: "p3",
  body: "#FS",
  author: card.author,
  photos: [],
  item: {
    title: "拍賣卡",
    cardName: "皮卡丘",
    conditionTrack: "RAW",
    rawGrade: "A",
    photos: [],
    listing: {
      id: "auc1",
      status: "ACTIVE",
      quantityAvailable: 1,
      saleType: "AUCTION",
      price: null,
      currentBid: 5000,
      startPrice: 2000,
      auctionSettled: false,
      cardName: "皮卡丘",
      personName: null,
      title: "拍賣卡",
    },
  },
  likeCount: 0,
  commentCount: 0,
  liked: false,
  saved: false,
});
assert(auction.priceCents === 5000 && auction.priceHref === null && auction.href === "/post/p3", "an auction on a post stays on the post");
assert(auction.buy?.kind === "contact" && auction.buy.listingId === "auc1", "an auction that cannot be carted contacts the seller");
assert(
  postBuy({ id: "gone", ...{ status: "ACTIVE", quantityAvailable: 0, saleType: "BUY_NOW", price: 100, currentBid: null, startPrice: null, auctionSettled: false } }) === null,
  "a sold-out post is not a buy",
);

const collect = readFileSync(new URL("../actions/collect.ts", import.meta.url), "utf8");
const saveStart = collect.indexOf("export async function togglePostSave");
const saveFn = collect.slice(saveStart, collect.indexOf("export async function", saveStart + 1));
assert(saveFn.includes("prisma.postSave") && saveFn.includes("readablePost"), "saving a post checks the viewer can read it");
assert(saveFn.includes('revalidatePath("/me/favorites")'), "a post save refreshes the wishlist");
const deleteStart = collect.indexOf("export async function deletePost");
const deleteEnd = collect.indexOf("export async function", deleteStart + 1);
const deletePost = collect.slice(deleteStart, deleteEnd);
assert(deletePost.includes("ownedPostId"), "delete checks the author");
assert(deletePost.includes("authorId: user.id"), "the delete query is scoped to the viewer");
assert(!deletePost.includes("collectionItem.delete") && !deletePost.includes("listing.delete"), "delete leaves the collection and listing");

const updateStart = collect.indexOf("export async function updatePost");
const updatePost = collect.slice(updateStart, collect.indexOf("export async function", updateStart + 1));
assert(updatePost.includes("ownedPostId"), "edit checks the author");
assert(updatePost.includes("authorId: user.id"), "edit is scoped to the viewer");

const hideStart = collect.indexOf("export async function hideFromFeed");
const hidePost = collect.slice(hideStart, collect.indexOf("export async function", hideStart + 1));
assert(hidePost.includes("feedHide"), "hide stores a viewer-only row");
assert(!hidePost.includes("post.delete"), "hide does not delete");

assert(POST_MENU_ORDER.join() === "delete,share,hide,report,block,edit", "menu order");
const own = postMenuFlags({ own: true, loggedIn: true, postId: "p", listingId: null, userId: "u" });
const other = postMenuFlags({ own: false, loggedIn: true, postId: "p", listingId: "l", userId: "u" });
const guest = postMenuFlags({ own: false, loggedIn: false, postId: "p", listingId: null });
assert(own.delete && own.edit && own.hide && !own.report && !own.block, "author gets delete, edit, hide");
assert(!other.delete && !other.edit && other.report && other.block && other.hide && other.share, "others get report, block, hide, share");
assert(!guest.hide && !guest.report && !guest.block && guest.share, "guests can share");
assert(postEditHref("p", "l") === "/sell/l", "a listed post edits the listing");
assert(postEditHref("p", null) === "/post/p/edit", "a caption post edits the caption");
assert(postEditHref(null, null) === null, "nothing to edit");
assert(reportTarget("p", "l")?.type === "POST", "a post is reported as a post");
assert(hideTarget(null, "l")?.type === "LISTING", "a listing card hides the listing");

const menu = readFileSync(new URL("../components/post-menu.tsx", import.meta.url), "utf8");
assert(["剷除", "分享", "隱藏", "舉報", "封鎖", "編輯"].every((label) => menu.includes(label)), "menu labels");
assert(menu.includes("deletePost") && menu.includes("hideFromFeed") && menu.includes("ReportSheet") && menu.includes("BlockButton"), "menu reuses delete, hide, report, and block");
assert(menu.includes("ShareSheet") && menu.includes("內部分享"), "menu share opens the in-app sheet");
assert(menu.includes("button = true") && menu.includes("useHoldSwipe") && menu.includes("onLongPress") && menu.includes("onSwipeLeft") && menu.includes("onContextMenu"), "the ellipsis can be omitted; long-press, swipe-left, and the context menu stay");
assert(menu.includes("swipeRightFormId") && menu.includes("requestSubmit"), "swipe right submits the existing like form");
const profileBoard = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
const postCard = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
assert(profileBoard.includes("button={false}") && !profileBoard.includes("⋯"), "profile thumbnails hide the ellipsis");
const collectionMenu = readFileSync(new URL("../components/collection-menu.tsx", import.meta.url), "utf8");
assert(collectionMenu.includes("useHoldSwipe") && collectionMenu.includes("onSwipeLeft") && collectionMenu.includes("onContextMenu"), "collection thumbs swipe left into the same menu");
assert(HOLD_MS === 480 && SWIPE_X === 64 && SWIPE_DOWN === 72, "hold and swipe thresholds stay intentional");
const base = { startX: 80, allowRight: true, allowDown: false, edgeGuard: true };
assert(gestureEnd({ ...base, dx: -SWIPE_X, dy: 8, axis: "x" }) === "left", "a horizontal left swipe opens the menu");
assert(gestureEnd({ ...base, dx: -40, dy: 4, axis: "x" }) === null, "a short drag is not a swipe");
assert(gestureEnd({ ...base, dx: -80, dy: 100, axis: "y" }) === null, "a vertical drag does not open the menu");
assert(gestureEnd({ ...base, dx: SWIPE_X, dy: 6, axis: "x", startX: EDGE_GUARD }) === "right", "swipe right likes once clear of the edge");
assert(gestureEnd({ ...base, dx: SWIPE_X, dy: 6, axis: "x", startX: EDGE_GUARD - 1 }) === null, "the screen edge stays a browser back gesture");
assert(gestureEnd({ ...base, dx: 8, dy: SWIPE_DOWN, axis: "y", allowDown: true }) === "down", "swipe down closes a story");
assert(lockAxis(4, 3) === null && lockAxis(20, 4) === "x" && lockAxis(4, 20) === "y", "axis locks only after the finger commits");
assert(collectionMenu.includes("放賣") && collectionMenu.includes("改為私人") && collectionMenu.includes("改為公開") && collectionMenu.includes("toggleCollectionVisibility"), "sell and privacy stay on the collection menu");
assert(!profileBoard.includes("<CollectionMenu") && !profileBoard.includes("sellHref") && !profileBoard.includes("collectionItemId"), "the profile does not show the owned-card grid");
assert(profileBoard.includes("savedListings") && profileBoard.includes("savedPosts") && profileBoard.includes("貨品") && profileBoard.includes("貼文"), "收藏 tab shows saved products and posts");
assert(
  profileBoard.includes("aria-label={label}") &&
    profileBoard.includes("title={label}") &&
    !profileBoard.includes(">{label}</span>") &&
    profileBoard.includes("strokeWidth={on ? 2.15 : 1.6}") &&
    profileBoard.includes("h-0.5 w-1/4 bg-ink"),
  "profile content tabs are icon-only; the selected tab keeps a deeper stroke and underline",
);
assert(profileBoard.includes("貨品同貼文的收藏會喺呢度"), "empty 收藏 says products and posts land here");
assert(!profileBoard.includes("text-link"), "sell and privacy are not green captions under the thumb");
assert(!profileBoard.includes("toggleCollectionVisibility"), "the board does not render the privacy form itself");
assert(menu.includes('if (own) return null'), "own posts do not offer report");
const postPage = readFileSync(new URL("../app/post/[id]/page.tsx", import.meta.url), "utf8");
assert(!postPage.includes("DeletePostForm") && !postPage.includes("刪除貼文"), "the post page delete stays in the long-press menu");
assert(!postPage.includes("睇圖鑑") && !postPage.includes("/dex") && !postPage.includes("喺賣場查看"), "post detail does not send people to the dex or back through the market");
assert(postPage.includes("睇貨頁") && postPage.includes("listingPageHref"), "a post with a listing offers 睇貨頁");
assert(!postPage.includes("addComment"), "the post page does not submit comments through a navigation");
assert(!postCard.includes("button={false}"), "feed cards keep the ellipsis button");
assert(postCard.includes('name="messages"') && postCard.includes("aria-label={commentLabel}"), "comments are an icon with a label");
assert(!postCard.includes("睇圖鑑") && !postCard.includes("/dex") && !postCard.includes('name="book"') && !postCard.includes("dexHref"), "posts do not offer the dex");
const handover = readFileSync(new URL("../components/handover-form.tsx", import.meta.url), "utf8");
const handoverButton = handover.slice(handover.indexOf("<button"), handover.indexOf("</button>"));
assert(postCard.includes("HandoverForm") && postCard.includes("gallery && buy") && handover.includes("傾交收") && handoverButton.includes('aria-label={label}') && handoverButton.includes('title={label}') && handoverButton.includes('name="messages"') && !handoverButton.includes('name="check"') && !handoverButton.replaceAll("{label}", "").includes("{label}"), "detail shows one icon-only handover chat mark, not checkout");
assert(!handover.includes("議價") && !handover.includes("bargain") && !handover.includes("DEAL_ACK") && !handover.includes("checkbox") && handover.split("<button").length === 2 && !handoverButton.includes("w-full"), "the handover control is a single chat mark, with no risk strip");
assert(!postCard.includes("bargain") && !postCard.includes("議價"), "the price row has no bargain button");
const purchase = readFileSync(new URL("../components/purchase-panel.tsx", import.meta.url), "utf8");
const listingPage = readFileSync(new URL("../app/listing/[id]/page.tsx", import.meta.url), "utf8");
assert(
  purchase.includes(">議價</button>") &&
    purchase.includes(">聯絡賣家</button>") &&
    purchase.split("grid-cols-2").length === 3 &&
    purchase.includes('value="offer"') &&
    purchase.includes('value="compose"') &&
    purchase.includes("openThread") &&
    !purchase.includes("HandoverForm") &&
    !purchase.includes("聯絡買家") &&
    !purchase.includes("瀏覽賣家") &&
    !purchase.includes("送出議價"),
  "listing price row is 議價 and 聯絡賣家, on the page and in the mobile dock",
);
assert(!listingPage.includes("再議價") && !listingPage.includes("聯絡買家") && !listingPage.includes("btn btn-ghost w-full"), "listing bookmark is not the wide primary");
assert(!postCard.includes("/checkout") && !handover.includes("/checkout") && !postCard.includes("立即購買"), "posts do not open platform checkout");
assert(postCard.includes("post.author.id"), "the author does not get a buy bar");
assert(postCard.includes("formatHkd") && postCard.includes("internalLabel"), "the price stays text and share opens the sheet");
assert(postCard.includes("swipeRightFormId") && postCard.includes("like-") && postCard.includes("PhotoStrip"), "feed cards like on swipe right and swipe multi-photo strips");
assert(postCard.includes("togglePostSave") && postCard.includes("toggleFavorite") && postCard.includes('tx(locale, "收藏", "Favorite")'), "posts and listing cards can be saved to 收藏");
const listingCard = readFileSync(new URL("../components/listing-card.tsx", import.meta.url), "utf8");
const bookmark = 'name="bookmark"';
assert(postCard.includes(bookmark) && postCard.includes("filled={post.saved}") && !postCard.includes("M7.2 5h9.6"), "post save uses the shared bookmark");
assert(listingCard.includes(bookmark) && listingCard.includes("filled={favorited}") && !listingCard.includes("♥") && !listingCard.includes("♡"), "listing favorite uses the shared bookmark");
assert(listingPage.includes(bookmark) && listingPage.includes("filled={Boolean(favored)}") && !listingPage.includes("♥") && !listingPage.includes("♡"), "listing page favorite uses the shared bookmark");
assert(profileBoard.includes('icon: "bookmark"') && !profileBoard.includes("♥") && !profileBoard.includes("♡"), "profile 收藏 tab uses the same bookmark");
assert(postCard.includes("post.postId ? null : post.priceHref"), "a post price does not open the listing");
const favPage = readFileSync(new URL("../app/me/favorites/page.tsx", import.meta.url), "utf8");
assert(favPage.includes('redirect("/me?tab=saved")') && !favPage.includes("prisma.postSave") && !favPage.includes("<PostCard") && !favPage.includes("<ListingCard"), "/me/favorites redirects to the profile 收藏 tab");
const settingsPage = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
assert(!settingsPage.includes("/me/favorites") && !settingsPage.includes("我的收藏"), "settings does not add a second favorites list");
assert(postCard.includes("aspect-[4/5]") && postCard.includes("object-cover"), "feed photos keep the 4:5 cover frame");
assert(postCard.includes("object-contain"), "detail photos show the whole image");
assert(postCard.includes("h-10 min-w-10") && postCard.includes("strokeWidth={2.25}"), "actions are at least 40px with a deeper stroke");
const actionsAt = postCard.indexOf("border-t border-line");
const shareAt = postCard.indexOf("<ShareButton");
const saveAt = postCard.indexOf("ml-auto");
const titleAt = postCard.indexOf("post.cardName");
const priceAt = postCard.indexOf("{price}");
const actionRow = postCard.slice(actionsAt, titleAt);
assert(actionsAt >= 0 && shareAt > actionsAt && saveAt > shareAt && titleAt > saveAt && priceAt > titleAt, "share stays on the action row; price is under the title");
assert(!actionRow.includes("{price}") && !actionRow.includes("formatHkd") && !actionRow.includes(">{post.likeCount}<"), "the action row is icons, without the price or a like count");
assert(postCard.includes("ml-auto") && !postCard.includes("mt-1 flex h-9 items-center"), "bookmark stays on the action row; price is not the old strip");
assert(!postCard.includes(">讚<") && !postCard.includes(">留言<") && !postCard.includes(">分享<"), "action icons do not grow text labels");
const market = readFileSync(new URL("../app/market/page.tsx", import.meta.url), "utf8");
assert(market.includes('permanentRedirect("/find")') && !market.includes("熱門／最新"), "the market route opens search");
const shop = readFileSync(new URL("../app/shop/[id]/page.tsx", import.meta.url), "utf8");
assert(!shop.includes("返回主頁") && !shop.includes('href="/faq"') && !shop.includes('href="/terms"'), "profile content does not repeat home or the site footer");
assert(!postCard.includes("justify-center"), "actions sit with the content");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
assert(!home.includes("FollowRail") && !home.includes("loadFollowRail") && !home.includes("StoryRail"), "home feed does not mount the following avatar rail");
assert(home.indexOf("primary.map") < home.indexOf("suggested.map"), "following posts still lead the home feed");
assert(home.includes("postByListing.get(listing.id)"), "feed listing cards open the linked post");
assert(!home.includes("寫貼文") && !home.includes("關注中"), "home has no write-post or following label");
const strip = readFileSync(new URL("../components/photo-strip.tsx", import.meta.url), "utf8");
assert(strip.includes("snap-x") && strip.includes("stopPropagation") && !strip.includes("touch-pan-x"), "photo swipe does not lock the page to horizontal");
assert(strip.includes("object-contain"), "a detail strip shows the whole photo");
assert(strip.includes("aria-current") && strip.includes("data-gesture"), "dots mark the page and the strip keeps the card menu");
assert(strip.includes("h-2.5 w-2.5") && strip.includes("bg-white") && strip.includes("shadow-[0_0_0_1px_rgba(15,23,42,0.92)]") && strip.includes("bg-accent"), "carousel dots are 10px; inactive white with a dark stroke; active accent");
const carouselAt = postCard.indexOf("photos.length > 1");
const carouselBranch = postCard.slice(carouselAt, postCard.indexOf(": (", carouselAt));
assert(carouselBranch.includes("PhotoStrip") && !carouselBranch.includes("<Link"), "feed and detail carousels are not one link");
const sheet = readFileSync(new URL("../components/comment-sheet.tsx", import.meta.url), "utf8");
const commentRoute = readFileSync(new URL("../app/api/posts/[id]/comments/route.ts", import.meta.url), "utf8");
assert(postCard.includes("CommentSheet") && !postCard.includes("href={post.commentHref}"), "the comment icon opens a sheet");
assert(sheet.includes("回應") && sheet.includes("加入對話……") && sheet.includes('role="dialog"'), "the sheet is a reply tray with the conversation field");
assert(sheet.includes("/api/posts/") && sheet.includes("/api/gifs") && !sheet.includes("router.refresh") && !sheet.includes("location.reload"), "sending a comment stays in the sheet");
assert(sheet.includes('aria-label="GIF"') && sheet.includes('aria-label={tx(locale, "相片", "Photo")}') && sheet.includes('aria-label={tx(locale, "移除", "Remove")}'), "photo and gif attach are icons, with remove");
assert(sheet.includes("fileToDataUrl") && sheet.includes("imageUrl") && sheet.includes("cleanCommentImage"), "the composer previews a photo or gif before send");
assert(commentRoute.includes("prisma.postComment") && commentRoute.includes("commentWrite") && commentRoute.includes("storeUploadedImage") && commentRoute.includes("uploads/comments") && !commentRoute.includes("redirect("), "comment photos reuse the upload store without a redirect");
const gifRoute = readFileSync(new URL("../app/api/gifs/route.ts", import.meta.url), "utf8");
assert(gifRoute.includes("TENOR_API_KEY") && gifRoute.includes("tenor.googleapis.com") && gifRoute.includes("tenorGif") && !gifRoute.includes("redirect("), "gif search stays behind the tenor key");
const commentImageMigration = readFileSync(new URL("../prisma/migrations/20261027143000_post_comment_image/migration.sql", import.meta.url), "utf8");
assert(commentImageMigration.includes('ADD COLUMN "imageUrl" TEXT') && !commentImageMigration.includes("NOT NULL"), "older text-only comments stay valid");
const gallery = readFileSync(new URL("../components/gallery.tsx", import.meta.url), "utf8");
assert(gallery.includes("onSwipeLeft") && gallery.includes("onSwipeRight"), "listing photos swipe between frames");

console.log("posts.test.ts ok");
