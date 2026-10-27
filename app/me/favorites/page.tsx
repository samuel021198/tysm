import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { cardInclude } from "@/lib/feed";
import { toPostCard, wishlistPostVisible } from "@/lib/posts";
import { followedSellerIds, hiddenUserIds } from "@/lib/social";
import { tx } from "@/lib/i18n";
import { ListingCard } from "@/components/listing-card";
import { PostCard } from "@/components/post-card";

export default async function FavoritesPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/favorites");
  const [rows, saves, follows, hidden] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId: viewer.id },
      include: { listing: { include: cardInclude } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.postSave.findMany({
      where: { userId: viewer.id },
      include: {
        post: {
          include: {
            author: { select: { id: true, nickname: true, avatarUrl: true } },
            photos: { orderBy: { position: "asc" } },
            likes: { where: { userId: viewer.id }, select: { userId: true }, take: 1 },
            _count: { select: { comments: true, likes: true } },
            collectionItem: {
              include: {
                photos: { orderBy: { position: "asc" } },
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    followedSellerIds(viewer.id),
    hiddenUserIds(viewer.id),
  ]);
  const hiddenAuthors = new Set(hidden);
  const posts = saves
    .map((row) => row.post)
    .filter((post) => wishlistPostVisible(post, viewer.id, hiddenAuthors))
    .map((post) =>
      toPostCard({
        postId: post.id,
        body: post.body,
        tags: post.tags,
        author: post.author,
        photos: post.photos,
        item: post.collectionItem,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        liked: post.likes.length > 0,
        saved: true,
      }),
    );
  return (
    <div>
      <h1 className="page-title">{tx(prefs.locale, "收藏", "Favorites")}</h1>
      {rows.length === 0 && posts.length === 0 ? <p className="empty">{tx(prefs.locale, "未有收藏。", "No favorites yet.")}</p> : null}
      {rows.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted">{tx(prefs.locale, "貨品", "Products")}</h2>
          <div className="feed">
            {rows.map((row) => (
              <ListingCard key={row.id} listing={row.listing} locale={prefs.locale} favorited next="/me/favorites" followed={follows.has(row.listing.sellerId)} />
            ))}
          </div>
        </section>
      ) : null}
      {posts.length ? (
        <section className="mt-4">
          <h2 className="mb-1 text-sm font-semibold text-muted">{tx(prefs.locale, "貼文", "Posts")}</h2>
          <div className="grid gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} locale={prefs.locale} next="/me/favorites" viewerId={viewer.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
