import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { listingPageHref, toPostCard } from "@/lib/posts";
import { isBlocked } from "@/lib/social";
import { displayCaption } from "@/lib/tags";
import { tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { PostCard } from "@/components/post-card";
import { TopicChips } from "@/components/topic-chips";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, post] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, nickname: true, avatarUrl: true } },
        photos: { orderBy: { position: "asc" } },
        likes: { select: { userId: true } },
        saves: { select: { userId: true } },
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
                auctionEndsAt: true,
                promoted: true,
                cardName: true,
                personName: true,
                title: true,
                catalogCardId: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    }),
  ]);
  if (!post) notFound();
  if (post.collectionItem?.visibility === "PRIVATE" && post.collectionItem.ownerId !== viewer?.id) notFound();
  if (viewer && viewer.id !== post.authorId && (await isBlocked(viewer.id, post.authorId))) notFound();
  const locale = prefs.locale;
  const card = toPostCard({
    postId: post.id,
    body: post.body,
    tags: post.tags,
    author: post.author,
    photos: post.photos,
    item: post.collectionItem,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    liked: viewer ? post.likes.some((like) => like.userId === viewer.id) : false,
    saved: viewer ? post.saves.some((save) => save.userId === viewer.id) : false,
    createdAt: post.createdAt,
  });
  const now = new Date().toISOString();
  const caption = displayCaption(post.body);
  const listingHref = listingPageHref(
    post.collectionItem?.listing,
    viewer?.id === post.authorId || viewer?.role === "ADMIN",
  );
  const buyBar = viewer?.id !== post.authorId && card.buy != null && card.priceCents != null;
  const sellHref =
    viewer?.id === post.authorId && post.collectionItem && !post.collectionItem.listingId
      ? `/sell?collectionItemId=${encodeURIComponent(post.collectionItem.id)}${post.collectionItem.catalogCardId ? `&catalogCardId=${encodeURIComponent(post.collectionItem.catalogCardId)}` : ""}`
      : null;
  return (
    <div className={`mx-auto grid max-w-lg gap-4 ${buyBar ? "pb-24" : ""}`}>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <PostCard post={card} locale={locale} now={now} next={`/post/${post.id}`} gallery viewerId={viewer?.id ?? null} sellHref={sellHref} />
      {caption ? <p className="px-1 text-sm leading-6 text-muted">{caption}</p> : null}
      <TopicChips tags={card.tags} className="px-1" />
      {listingHref ? (
        <Link href={listingHref} className="inline-flex h-9 items-center self-start px-1 text-sm font-semibold text-link">
          {tx(locale, "睇貨頁", "View listing")}
        </Link>
      ) : null}
      {sellHref && card.priceCents == null ? (
        <Link href={sellHref} className="btn btn-primary w-full">
          {tx(locale, "放賣", "List for sale")}
        </Link>
      ) : null}
    </div>
  );
}
