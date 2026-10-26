import { prisma } from "./db";
import { cardInclude } from "./feed";
import { sellingAsk, toPostCard, type PostCardModel } from "./posts";
import { conditionLabel } from "./rules";

const postInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true } },
  photos: { orderBy: { position: "asc" as const } },
  likes: { select: { userId: true } },
  _count: { select: { comments: true, likes: true } },
  collectionItem: {
    include: {
      photos: { orderBy: { position: "asc" as const } },
      post: { select: { id: true } },
      listing: {
        select: {
          id: true,
          status: true,
          quantityAvailable: true,
          saleType: true,
          price: true,
          currentBid: true,
          startPrice: true,
          auctionSettled: true,
          cardName: true,
          personName: true,
          title: true,
          catalogCardId: true,
        },
      },
    },
  },
} as const;

export async function profileContent(ownerId: string, viewerId: string | null) {
  const isSelf = viewerId === ownerId;
  const [postRows, itemRows, listings, reviewRows, drafts, followers, following, favs] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: ownerId,
        ...(isSelf ? {} : { OR: [{ collectionItemId: null }, { collectionItem: { visibility: "PUBLIC" } }] }),
      },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.collectionItem.findMany({
      where: { ownerId, ...(isSelf ? {} : { visibility: "PUBLIC" }) },
      include: {
        photos: { orderBy: { position: "asc" }, take: 1 },
        post: { select: { id: true } },
        listing: {
          select: {
            id: true,
            status: true,
            quantityAvailable: true,
            saleType: true,
            price: true,
            currentBid: true,
            startPrice: true,
            auctionSettled: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    }),
    prisma.listing.findMany({
      where: { sellerId: ownerId, status: "ACTIVE", quantityAvailable: { gt: 0 } },
      include: cardInclude,
      orderBy: { publishedAt: "desc" },
      take: 24,
    }),
    prisma.review.findMany({
      where: { subjectId: ownerId },
      include: { author: { select: { nickname: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    isSelf
      ? prisma.listing.findMany({
          where: { sellerId: ownerId, status: { in: ["DRAFT", "SCHEDULED"] } },
          select: { id: true, title: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.follow.count({ where: { sellerId: ownerId } }),
    prisma.follow.count({ where: { followerId: ownerId } }),
    viewerId ? prisma.favorite.findMany({ where: { userId: viewerId, listing: { sellerId: ownerId } }, select: { listingId: true } }) : Promise.resolve([]),
  ]);

  const posts: PostCardModel[] = postRows.map((row) =>
    toPostCard({
      postId: row.id,
      body: row.body,
      author: row.author,
      photos: row.photos,
      item: row.collectionItem,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      liked: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
    }),
  );

  const items = itemRows.map((item) => ({
    id: item.id,
    cardName: item.title || item.cardName || "",
    condition: conditionLabel(item),
    visibility: item.visibility,
    photo: item.photos[0]?.url ?? null,
    priceCents: sellingAsk(item.listing),
    href: item.post ? `/post/${item.post.id}` : item.listing && sellingAsk(item.listing) != null ? `/listing/${item.listing.id}` : null,
    catalogCardId: item.catalogCardId,
    listingId: item.listingId,
  }));

  return {
    posts,
    items,
    listings,
    reviews: reviewRows.map((review) => ({
      id: review.id,
      nickname: review.author.nickname,
      stars: review.stars,
      comment: review.comment,
      reply: review.reply,
    })),
    drafts,
    followers,
    following,
    favIds: favs.map((row) => row.listingId),
  };
}

const HOME_BUCKET = 8;

function homePostInclude(viewerId: string | null) {
  return {
    author: { select: { id: true, nickname: true, avatarUrl: true } },
    photos: { orderBy: { position: "asc" as const }, take: 1 },
    likes: {
      where: viewerId ? { userId: viewerId } : { userId: { in: [] as string[] } },
      select: { userId: true },
      take: 1,
    },
    _count: { select: { comments: true, likes: true } },
    collectionItem: {
      select: {
        title: true,
        cardName: true,
        catalogCardId: true,
        conditionTrack: true,
        rawGrade: true,
        grader: true,
        gradeValue: true,
        photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
        listing: {
          select: {
            id: true,
            status: true,
            quantityAvailable: true,
            saleType: true,
            price: true,
            currentBid: true,
            startPrice: true,
            auctionSettled: true,
            cardName: true,
            personName: true,
            title: true,
            catalogCardId: true,
          },
        },
      },
    },
  };
}

function homeVisible(viewerId: string | null, hidden: string[]) {
  return {
    ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
    OR: [
      { collectionItemId: null },
      { collectionItem: { visibility: "PUBLIC" as const } },
      ...(viewerId ? [{ authorId: viewerId }] : []),
    ],
  };
}

/**
 * Following first, then a short suggestion bucket.
 * ponytail: 8 + 8 posts, one photo, the viewer's like row only. Upgrade path: cursor pagination.
 */
export async function loadHomeFeed(viewerId: string | null, hidden: string[]) {
  const follows = viewerId
    ? await prisma.follow.findMany({ where: { followerId: viewerId }, select: { sellerId: true } })
    : [];
  const hiddenSet = new Set(hidden);
  const followedIds = follows.map((row) => row.sellerId).filter((id) => !hiddenSet.has(id));
  const include = homePostInclude(viewerId);
  const exclude = [...new Set([...hidden, ...(viewerId ? [viewerId] : []), ...followedIds])];
  const [primaryRows, suggestedRows] = await Promise.all([
    viewerId
      ? prisma.post.findMany({
          where: { AND: [homeVisible(viewerId, hidden), { authorId: { in: [viewerId, ...followedIds] } }] },
          include,
          orderBy: { createdAt: "desc" },
          take: HOME_BUCKET,
        })
      : Promise.resolve([]),
    prisma.post.findMany({
      where: {
        AND: [
          {
            OR: [{ collectionItemId: null }, { collectionItem: { visibility: "PUBLIC" } }],
          },
          ...(exclude.length ? [{ authorId: { notIn: exclude } }] : []),
        ],
      },
      include,
      orderBy: { createdAt: "desc" },
      take: HOME_BUCKET,
    }),
  ]);
  const rows = [...primaryRows, ...suggestedRows];
  function toCard(row: (typeof rows)[number]) {
    return toPostCard({
      postId: row.id,
      body: row.body,
      author: row.author,
      photos: row.photos,
      item: row.collectionItem,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      liked: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
    });
  }
  const primary = primaryRows.map(toCard);
  const suggested = suggestedRows.map(toCard);
  const linkedListings = new Set(rows.map((row) => row.collectionItem?.listing?.id).filter((id): id is string => Boolean(id)));
  return { primary, suggested, linkedListings };
}
