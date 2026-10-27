import { prisma } from "./db";
import { cardInclude } from "./feed";
import { cardDisplayName, toPostCard, wishlistPostVisible, type PostCardModel } from "./posts";
import { feedHideIds, hiddenUserIds } from "./social";

export type ProfileThumb = { id: string; href: string; photo: string | null; label: string };

const postInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true } },
  photos: { orderBy: { position: "asc" as const } },
  likes: { select: { userId: true } },
  saves: { select: { userId: true } },
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
  const [postRows, listings, reviewRows, drafts, followers, completed, favs, hides, savedListingRows, savedPostRows, blockedIds] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: ownerId,
        ...(isSelf ? {} : { OR: [{ collectionItemId: null }, { collectionItem: { visibility: "PUBLIC" } }] }),
      },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 24,
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
    prisma.order.count({ where: { sellerId: ownerId, status: "COMPLETED" } }),
    viewerId ? prisma.favorite.findMany({ where: { userId: viewerId, listing: { sellerId: ownerId } }, select: { listingId: true } }) : Promise.resolve([]),
    feedHideIds(viewerId),
    isSelf
      ? prisma.favorite.findMany({
          where: { userId: ownerId },
          orderBy: { createdAt: "desc" },
          take: 24,
          select: {
            id: true,
            listing: { select: { id: true, title: true, photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } },
          },
        })
      : Promise.resolve([]),
    isSelf
      ? prisma.postSave.findMany({
          where: { userId: ownerId },
          orderBy: { createdAt: "desc" },
          take: 24,
          select: {
            id: true,
            post: {
              select: {
                id: true,
                body: true,
                authorId: true,
                photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                collectionItem: {
                  select: {
                    visibility: true,
                    ownerId: true,
                    title: true,
                    cardName: true,
                    photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    isSelf ? hiddenUserIds(ownerId) : Promise.resolve([]),
  ]);

  const hiddenPosts = new Set(hides.postIds);
  const posts: PostCardModel[] = postRows
    .filter((row) => row.authorId === viewerId || !hiddenPosts.has(row.id))
    .map((row) =>
    toPostCard({
      postId: row.id,
      body: row.body,
      tags: row.tags,
      author: row.author,
      photos: row.photos,
      item: row.collectionItem,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      liked: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
      saved: viewerId ? row.saves.some((save) => save.userId === viewerId) : false,
    }),
  );

  const blocked = new Set(blockedIds);
  const savedListings: ProfileThumb[] = savedListingRows.map((row) => ({
    id: row.id,
    href: `/listing/${row.listing.id}`,
    photo: row.listing.photos[0]?.url ?? null,
    label: row.listing.title,
  }));
  const savedPosts: ProfileThumb[] = savedPostRows
    .map((row) => row.post)
    .filter((post) => wishlistPostVisible(post, ownerId, blocked))
    .map((post) => ({
      id: post.id,
      href: `/post/${post.id}`,
      photo: post.photos[0]?.url ?? post.collectionItem?.photos[0]?.url ?? null,
      label: cardDisplayName({ cardName: post.collectionItem?.cardName, title: post.collectionItem?.title, body: post.body }),
    }));

  return {
    posts,
    savedListings,
    savedPosts,
    // Dates on the Prisma row cannot cross into the client profile board.
    listings: listings.map((row) => ({
      id: row.id,
      title: row.title,
      saleType: row.saleType,
      price: row.price,
      startPrice: row.startPrice,
      currentBid: row.currentBid,
      auctionSettled: row.auctionSettled,
      photos: row.photos.map((photo) => ({ url: photo.url })),
    })),
    reviews: reviewRows.map((review) => ({
      id: review.id,
      nickname: review.author.nickname,
      stars: review.stars,
      comment: review.comment,
      reply: review.reply,
    })),
    drafts,
    followers,
    completed,
    favIds: favs.map((row) => row.listingId),
  };
}

const HOME_BUCKET = 12;

function homePostInclude(viewerId: string | null) {
  return {
    author: { select: { id: true, nickname: true, avatarUrl: true } },
    photos: { orderBy: { position: "asc" as const }, take: 4 },
    likes: {
      where: viewerId ? { userId: viewerId } : { userId: { in: [] as string[] } },
      select: { userId: true },
      take: 1,
    },
    saves: {
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
        photos: { orderBy: { position: "asc" as const }, take: 4, select: { url: true } },
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
 * ponytail: 12 + 12 posts, up to 4 photos, the viewer's like row only. Upgrade path: cursor pagination.
 */
export async function loadHomeFeed(viewerId: string | null, hidden: string[], hiddenPostIds: string[] = []) {
  const follows = viewerId
    ? await prisma.follow.findMany({ where: { followerId: viewerId }, select: { sellerId: true } })
    : [];
  const hiddenSet = new Set(hidden);
  const followedIds = follows.map((row) => row.sellerId).filter((id) => !hiddenSet.has(id));
  const include = homePostInclude(viewerId);
  const exclude = [...new Set([...hidden, ...(viewerId ? [viewerId] : []), ...followedIds])];
  // ponytail: hidden ids are a notIn list. Upgrade path: anti-join if a viewer hides hundreds of posts.
  const skipPosts = hiddenPostIds.length ? { id: { notIn: hiddenPostIds } } : {};
  const [primaryRows, suggestedRows] = await Promise.all([
    viewerId
      ? prisma.post.findMany({
          where: { AND: [homeVisible(viewerId, hidden), { authorId: { in: [viewerId, ...followedIds] } }, skipPosts] },
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
          skipPosts,
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
      tags: row.tags,
      author: row.author,
      photos: row.photos,
      item: row.collectionItem,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      liked: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
      saved: viewerId ? row.saves.some((save) => save.userId === viewerId) : false,
    });
  }
  const primary = primaryRows.map(toCard);
  const suggested = suggestedRows.map(toCard);
  const linkedListings = new Set(rows.map((row) => row.collectionItem?.listing?.id).filter((id): id is string => Boolean(id)));
  return { primary, suggested, linkedListings };
}
