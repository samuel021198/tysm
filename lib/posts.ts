import { dexPath } from "./dex";
import { conditionLabel } from "./rules";

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
  priceHref: string | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  likePostId: string | null;
  likeListingId: string | null;
  sharePath: string;
  commentHref: string | null;
  dexHref: string | null;
};

export const POST_MENU_ORDER = ["delete", "share", "hide", "report", "edit"] as const;
export type PostMenuAction = (typeof POST_MENU_ORDER)[number];

/** Which long-press actions are enabled. The menu still shows every action. */
export function postMenuFlags(input: {
  own: boolean;
  loggedIn: boolean;
  postId: string | null;
  listingId: string | null;
}): Record<PostMenuAction, boolean> {
  const target = Boolean(input.postId || input.listingId);
  return {
    delete: input.own && Boolean(input.postId),
    share: true,
    hide: input.loggedIn && target,
    report: input.loggedIn && !input.own && target,
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
    });
  });
  likeCount: number;
  commentCount: number;
  liked: boolean;
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
  return {
    id: input.postId,
    postId: input.postId,
    listingId: listing?.id ?? null,
    href: `/post/${input.postId}`,
    author: input.author,
    photos,
    cardName,
    condition: input.item ? conditionLabel(input.item) : null,
    priceCents: sellingAsk(listing),
    priceHref: sellingAsk(listing) != null && listing ? `/listing/${listing.id}` : null,
    likeCount: input.likeCount,
    commentCount: input.commentCount,
    liked: input.liked,
    likePostId: input.postId,
    likeListingId: null,
    sharePath: `/post/${input.postId}`,
    commentHref: `/post/${input.postId}#comments`,
    dexHref: dexPath(input.item?.catalogCardId || input.item?.listing?.catalogCardId),
  };
}

/** Active listings that do not have a post yet. Same card chrome, no buy button, comment is not wired. */
export function listingSuggestionCard(input: {
  listing: AskListing & {
    id: string;
    title: string;
    cardName: string | null;
    personName: string | null;
    conditionTrack: "RAW" | "GRADED";
    rawGrade: string | null;
    grader: string | null;
    gradeValue: number | null;
    favoriteCount: number;
    catalogCardId?: string | null;
    photos: { url: string }[];
    seller: { id: string; nickname: string; avatarUrl?: string | null };
  };
  liked: boolean;
}): PostCardModel {
  const listing = input.listing;
  return {
    id: `listing-${listing.id}`,
    postId: null,
    listingId: listing.id,
    href: `/listing/${listing.id}`,
    author: {
      id: listing.seller.id,
      nickname: listing.seller.nickname,
      avatarUrl: listing.seller.avatarUrl ?? null,
    },
    photos: listing.photos.map((photo) => photo.url),
    cardName: cardDisplayName({ cardName: listing.cardName, personName: listing.personName, title: listing.title }),
    condition: conditionLabel(listing),
    priceCents: sellingAsk(listing),
    priceHref: sellingAsk(listing) != null ? `/listing/${listing.id}` : null,
    likeCount: listing.favoriteCount,
    commentCount: 0,
    liked: input.liked,
    likePostId: null,
    likeListingId: listing.id,
    sharePath: `/listing/${listing.id}`,
    commentHref: null,
    dexHref: dexPath(listing.catalogCardId),
  };
}
