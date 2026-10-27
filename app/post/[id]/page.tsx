import Link from "next/link";
import { notFound } from "next/navigation";
import { addComment } from "@/actions/collect";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { toPostCard } from "@/lib/posts";
import { isBlocked } from "@/lib/social";
import { tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { PostCard } from "@/components/post-card";

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
        _count: { select: { comments: true, likes: true } },
        comments: { include: { author: { select: { id: true, nickname: true } } }, orderBy: { createdAt: "asc" }, take: 50 },
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
    }),
  ]);
  if (!post) notFound();
  if (post.collectionItem?.visibility === "PRIVATE" && post.collectionItem.ownerId !== viewer?.id) notFound();
  if (viewer && viewer.id !== post.authorId && (await isBlocked(viewer.id, post.authorId))) notFound();
  const locale = prefs.locale;
  const card = toPostCard({
    postId: post.id,
    body: post.body,
    author: post.author,
    photos: post.photos,
    item: post.collectionItem,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    liked: viewer ? post.likes.some((like) => like.userId === viewer.id) : false,
  });
  const listing = post.collectionItem?.listing;
  const selling = card.priceCents != null && listing;
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <PostCard post={card} locale={locale} next={`/post/${post.id}`} gallery viewerId={viewer?.id ?? null} />
      {post.body ? <p className="px-1 text-sm">{post.body}</p> : null}
      {selling ? (
        <p className="text-sm">
          <Link className="text-link" href={`/listing/${listing.id}`}>{tx(locale, "喺賣場查看", "View in the market")}</Link>
        </p>
      ) : null}
      {viewer?.id === post.authorId && post.collectionItem && !post.collectionItem.listingId ? (
        <Link
          href={`/sell?collectionItemId=${encodeURIComponent(post.collectionItem.id)}${post.collectionItem.catalogCardId ? `&catalogCardId=${encodeURIComponent(post.collectionItem.catalogCardId)}` : ""}`}
          className="btn btn-primary w-fit"
        >
          {tx(locale, "放賣", "List for sale")}
        </Link>
      ) : null}
      <section id="comments" className="grid gap-3">
        <h2 className="font-semibold">{tx(locale, "留言", "Comments")}</h2>
        {post.comments.length === 0 ? <p className="text-sm text-muted">{tx(locale, "未有留言。", "No comments yet.")}</p> : null}
        <ul className="grid gap-3 text-sm">
          {post.comments.map((comment) => (
            <li key={comment.id}>
              <Link href={`/shop/${comment.author.id}`} className="font-semibold">{comment.author.nickname}</Link>
              <p>{comment.body}</p>
            </li>
          ))}
        </ul>
        {viewer ? (
          <form key={post.comments.at(-1)?.id ?? "none"} action={addComment} className="grid gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <textarea className="field" name="body" maxLength={300} required placeholder={tx(locale, "寫一句", "Write a comment")} />
            <button className="btn btn-primary w-fit">{tx(locale, "送出", "Send")}</button>
          </form>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/post/${post.id}`)}`} className="text-sm text-link">{tx(locale, "登入之後先可以留言", "Log in to comment")}</Link>
        )}
      </section>
    </div>
  );
}
