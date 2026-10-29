import { safeNext } from "./format";
import { conditionLabel } from "./rules";
import { displayCaption, mergeTags, tagsFromCaption } from "./tags";

export type CollectionVisibility = "PUBLIC" | "PRIVATE";

export type AskListing = {
  status: string;
  quantityAvailable: number;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  currentBid: number | null;
  startPrice: number | null;
  auctionSettled: boolean;
};

/** Missing or unknown values stay public. The binder is public unless the owner switches it. */
export function collectionVisibility(value: string | null | undefined): CollectionVisibility {
  return value === "PRIVATE" ? "PRIVATE" : "PUBLIC";
}

/** Stay on /me or /shop/[id] after a collection action. Anything else goes back to the box tab. */
export function collectionBoardNext(value: unknown): string {
  const url = new URL(safeNext(value).split("#")[0], "http://local");
  if (url.pathname !== "/me" && !/^\/shop\/[^/]+$/.test(url.pathname)) return "/me?tab=box";
  url.searchParams.delete("ok");
  url.searchParams.delete("err");
  if (!url.searchParams.has("tab")) url.searchParams.set("tab", "box");
  return `${url.pathname}${url.search}`;
}

/** A saved post stays on the wishlist unless the author blocked the viewer or hid the card. */
export function wishlistPostVisible(
  post: { authorId: string; collectionItem: { visibility: CollectionVisibility; ownerId: string } | null },
  viewerId: string,
  hiddenAuthorIds: ReadonlySet<string>,
): boolean {
  if (hiddenAuthorIds.has(post.authorId)) return false;
  const item = post.collectionItem;
  if (item?.visibility === "PRIVATE" && item.ownerId !== viewerId) return false;
  return true;
}

/** The signed-in author is the only person who can delete this post. */
export function ownedPostId(
  post: { id: string; authorId: string } | null | undefined,
  viewerId: string,
): string | null {
  if (!post || post.authorId !== viewerId) return null;
  return post.id;
}

/**
 * A live sale always gets a feed post. Collect-only posts only when the owner opts in.
 * A draft or scheduled listing does not post yet.
 */
export function shouldPublishPost(input: { forSale: boolean; listingPublished: boolean; publishToFeed: boolean }): boolean {
  if (input.forSale && input.listingPublished) return true;
  return input.publishToFeed;
}

/** Cents to show on a feed card. Null when the card is not currently for sale. */
export function sellingAsk(listing: AskListing | null | undefined): number | null {
  if (!listing || listing.status !== "ACTIVE" || listing.quantityAvailable < 1) return null;
  const auctionLive = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  if (auctionLive) return listing.currentBid ?? listing.startPrice;
  if (listing.saleType === "AUCTION") return null;
  return listing.price;
}

export type PostBuy =
  | { kind: "deal"; listingId: string }
  | { kind: "contact"; listingId: string };

/**
 * A priced listing opens a seller thread with one 傾交收 chat mark. Auction-only sales do the same.
 * A showcase post (#PC, no live ask) buys nothing.
 */
export function postBuy(listing: (AskListing & { id: string }) | null | undefined): PostBuy | null {
  if (!listing || sellingAsk(listing) == null) return null;
  if (listing.saleType !== "AUCTION" && listing.price != null) {
    return { kind: "deal", listingId: listing.id };
  }
  return { kind: "contact", listingId: listing.id };
}

const OPEN_LISTING_STATUS = new Set(["ACTIVE", "ENDED", "SOLD"]);

/**
 * Specs, 收藏, and the seller card stay on the listing page.
 * Drafts and unlisted sales stay hidden unless the viewer can already open that page.
 */
export function listingPageHref(
  listing: { id: string; status: string } | null | undefined,
  canOpenHidden = false,
): string | null {
  if (!listing) return null;
  if (!canOpenHidden && !OPEN_LISTING_STATUS.has(listing.status)) return null;
  return `/listing/${listing.id}`;
}

function postPrice(listing: (AskListing & { id: string }) | null): {
  cents: number | null;
  href: string | null;
  buy: PostBuy | null;
  auction: boolean;
} {
  const buy = postBuy(listing);
  if (!listing || !buy) return { cents: null, href: null, buy: null, auction: false };
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  return {
    cents: sellingAsk(listing),
    href: buy.kind === "deal" ? null : `/listing/${listing.id}`,
    buy,
    auction,
  };
}

export function cardDisplayName(parts: {
  cardName?: string | null;
  personName?: string | null;
  title?: string | null;
  body?: string | null;
}): string {
  return (parts.cardName || parts.personName || parts.title || parts.body || "").trim();
}

export type PostCardModel = {
  id: string;
  /** Real post id. Null on a listing suggestion that has no post yet. */
  postId: string | null;
  listingId: string | null;
  href: string;
  author: { id: string; nickname: string; avatarUrl: string | null };
  photos: string[];
  cardName: string;
  condition: string | null;
  priceCents: number | null;
  /** Live auction. The cents are the current bid, or the start price when nobody has bid. */
  auction: boolean;
  priceHref: string | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  likePostId: string | null;
  likeListingId: string | null;
  /** Wishlist. A post save, or a listing favorite when the card has no post. */
  saved: boolean;
  savePostId: string | null;
  saveListingId: string | null;
  sharePath: string;
  commentHref: string | null;
  /** Checkout when the listing can be carted. Contact when it is auction-only. Null on a showcase post. */
  buy: PostBuy | null;
  tags: string[];
  /** Body with topic tokens removed. Empty when the post has no sentence to preview. */
  caption: string;
  /** ISO publish time. Null when the caller did not load it. */
  createdAt: string | null;
  /** ISO listing updatedAt when the card has a sale. The line decides if that write is meaningful. */
  updatedAt: string | null;
};

function isoStamp(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const POST_MENU_ORDER = ["delete", "share", "hide", "report", "block", "edit"] as const;
export type PostMenuAction = (typeof POST_MENU_ORDER)[number];

/** Which long-press actions are enabled. The menu still shows every action. */
export function postMenuFlags(input: {
  own: boolean;
  loggedIn: boolean;
  postId: string | null;
  listingId: string | null;
  userId?: string | null;
}): Record<PostMenuAction, boolean> {
  const target = Boolean(input.postId || input.listingId);
  return {
    delete: input.own && Boolean(input.postId),
    share: true,
    hide: input.loggedIn && target,
    report: input.loggedIn && !input.own && target,
    block: input.loggedIn && !input.own && Boolean(input.userId),
    edit: input.own && postEditHref(input.postId, input.listingId) != null,
  };
}

/** A listed post edits the sale. A caption-only post edits the caption. */
export function postEditHref(postId: string | null, listingId: string | null): string | null {
  if (listingId) return `/sell/${listingId}`;
  if (postId) return `/post/${postId}/edit`;
  return null;
}

export function reportTarget(postId: string | null, listingId: string | null): { type: "POST" | "LISTING"; id: string } | null {
  if (postId) return { type: "POST", id: postId };
  if (listingId) return { type: "LISTING", id: listingId };
  return null;
}

export function hideTarget(postId: string | null, listingId: string | null): { type: "POST" | "LISTING"; id: string } | null {
  if (postId) return { type: "POST", id: postId };
  if (listingId) return { type: "LISTING", id: listingId };
  return null;
}

type ConditionBits = {
  conditionTrack: "RAW" | "GRADED";
  rawGrade?: string | null;
  grader?: string | null;
  gradeValue?: number | null;
};

export function toPostCard(input: {
  postId: string;
  body: string;
  author: { id: string; nickname: string; avatarUrl: string | null };
  photos: { url: string }[];
  item: null | (ConditionBits & {
    title: string;
    cardName: string | null;
    catalogCardId?: string | null;
    photos: { url: string }[];
    listing: null | (AskListing & {
      id: string;
      cardName: string | null;
      personName: string | null;
      title: string;
      catalogCardId?: string | null;
      updatedAt?: Date | string | null;
    });
  });
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  tags?: string[];
  createdAt?: Date | string | null;
}): PostCardModel {
  const listing = input.item?.listing ?? null;
  const photos = (input.item?.photos.length ? input.item.photos : input.photos).map((photo) => photo.url);
  const cardName = input.item
    ? cardDisplayName({
        cardName: input.item.cardName || listing?.cardName,
        personName: listing?.personName,
        title: input.item.title || listing?.title,
      })
    : cardDisplayName({ body: input.body });
  const price = postPrice(listing);
  return {
    id: input.postId,
    postId: input.postId,
    listingId: listing?.id ?? null,
    href: `/post/${input.postId}`,
    author: input.author,
    photos,
    cardName,
    condition: input.item ? conditionLabel(input.item) : null,
    priceCents: price.cents,
    auction: price.auction,
    // Feed taps stay on the post. The listing opens from 睇貨頁.
    priceHref: null,
    likeCount: input.likeCount,
    commentCount: input.commentCount,
    liked: input.liked,
    likePostId: input.postId,
    likeListingId: null,
    saved: input.saved,
    savePostId: input.postId,
    saveListingId: null,
    sharePath: `/post/${input.postId}`,
    commentHref: `/post/${input.postId}#comments`,
    buy: price.buy,
    tags: mergeTags(input.tags ?? [], tagsFromCaption(input.body)),
    caption: displayCaption(input.body),
    createdAt: isoStamp(input.createdAt),
    updatedAt: isoStamp(input.item?.listing?.updatedAt),
  };
}

/** Active listings that do not have a post yet. Same card chrome. Pass postId when the sale already has a post so the feed opens that post. */
export function listingSuggestionCard(input: {
  postId?: string | null;
  listing: AskListing & {
    id: string;
    title: string;
    cardName: string | null;
    personName: string | null;
    conditionTrack: "RAW" | "GRADED";
    rawGrade: string | null;
    grader: string | null;
    gradeValue: number | null;
    catalogCardId?: string | null;
    photos: { url: string }[];
    seller: { id: string; nickname: string; avatarUrl?: string | null };
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  };
  saved: boolean;
}): PostCardModel {
  const listing = input.listing;
  const postId = input.postId || null;
  const price = postPrice(listing);
  const href = postId ? `/post/${postId}` : `/listing/${listing.id}`;
  return {
    id: `listing-${listing.id}`,
    postId,
    listingId: listing.id,
    href,
    author: {
      id: listing.seller.id,
      nickname: listing.seller.nickname,
      avatarUrl: listing.seller.avatarUrl ?? null,
    },
    photos: listing.photos.map((photo) => photo.url),
    cardName: cardDisplayName({ cardName: listing.cardName, personName: listing.personName, title: listing.title }),
    condition: conditionLabel(listing),
    priceCents: price.cents,
    auction: price.auction,
    priceHref: postId ? null : price.href,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    likePostId: null,
    likeListingId: null,
    saved: input.saved,
    savePostId: null,
    saveListingId: listing.id,
    sharePath: href,
    commentHref: postId ? `/post/${postId}#comments` : null,
    buy: price.buy,
    tags: [],
    caption: "",
    createdAt: isoStamp(listing.createdAt),
    updatedAt: isoStamp(listing.updatedAt),
  };
}
