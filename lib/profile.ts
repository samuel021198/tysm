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

/** Following first, then everyone else. ponytail: ranks at most 40 posts in memory. Upgrade path: a SQL union on follow. */
export async function loadHomeFeed(viewerId: string | null, hidden: string[]) {
  const [rows, follows] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
        OR: [
          { collectionItemId: null },
          { collectionItem: { visibility: "PUBLIC" } },
          ...(viewerId ? [{ authorId: viewerId }] : []),
        ],
      },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    viewerId ? prisma.follow.findMany({ where: { followerId: viewerId }, select: { sellerId: true } }) : Promise.resolve([]),
  ]);
  const followed = new Set(follows.map((row) => row.sellerId));
  const cards = rows.map((row) =>
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
  const primary = cards.filter((card) => viewerId != null && (card.author.id === viewerId || followed.has(card.author.id)));
  const suggested = cards.filter((card) => !primary.includes(card));
  const linkedListings = new Set(rows.map((row) => row.collectionItem?.listing?.id).filter((id): id is string => Boolean(id)));
  return { primary, suggested, linkedListings };
}
