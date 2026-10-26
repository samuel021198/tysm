import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { togglePostLike } from "@/actions/collect";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { ShareButton } from "./share-button";

export function PostCard({
  post,
  locale,
  next = "/",
  gallery = false,
}: {
  post: PostCardModel;
  locale: Locale;
  next?: string;
  gallery?: boolean;
}) {
  const photos = post.photos.length ? post.photos : ["/demo/back.svg"];
  const shown = gallery ? photos : photos.slice(0, 1);
  return (
    <article className="surface overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-3">
        <Link href={`/shop/${post.author.id}`} className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rose to-teal text-sm font-bold text-[#1b1418]">
          {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : post.author.nickname.slice(0, 1)}
        </Link>
        <Link href={`/shop/${post.author.id}`} className="min-w-0 truncate font-semibold">
          {post.author.nickname}
        </Link>
      </div>
      <Link href={post.href} className="block">
        {shown.map((url, index) => (
          <img key={`${url}-${index}`} src={url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" className="block aspect-[4/5] w-full bg-[#f4efe6] object-contain" />
        ))}
      </Link>
      <div className="flex items-center border-t border-line">
        {post.likePostId ? (
          <form action={togglePostLike} className="flex-1">
            <input type="hidden" name="postId" value={post.likePostId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="grid h-12 w-full place-items-center text-sm font-medium">
              {post.liked ? "♥" : "♡"} {post.likeCount} <span className="sr-only">{tx(locale, "讚", "Like")}</span>
            </button>
          </form>
        ) : post.likeListingId ? (
          <form action={toggleFavorite} className="flex-1">
            <input type="hidden" name="listingId" value={post.likeListingId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="grid h-12 w-full place-items-center text-sm font-medium">
              {post.liked ? "♥" : "♡"} {post.likeCount} <span className="sr-only">{tx(locale, "讚", "Like")}</span>
            </button>
          </form>
        ) : (
          <span className="grid h-12 flex-1 place-items-center text-sm text-muted">♡</span>
        )}
        {post.commentHref ? (
          <Link href={post.commentHref} className="grid h-12 flex-1 place-items-center text-sm font-medium">
            {tx(locale, "留言", "Comment")} {post.commentCount || ""}
          </Link>
        ) : (
          <span className="grid h-12 flex-1 place-items-center text-sm text-muted" title={tx(locale, "這張未有貼文", "No post yet")}>
            {tx(locale, "留言", "Comment")}
          </span>
        )}
        <ShareButton path={post.sharePath} label={tx(locale, "分享", "Share")} copiedLabel={tx(locale, "已複製", "Copied")} />
      </div>
      <div className="px-3 pb-4 pt-1">
        <Link href={post.href} className="block">
          <h2 className="text-[15px] font-semibold leading-snug">
            {post.cardName}
            {post.condition ? <span className="font-medium text-muted"> · {post.condition}</span> : null}
          </h2>
        </Link>
        {post.dexHref ? (
          <Link href={post.dexHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-link">
            {tx(locale, "睇圖鑑", "View in the dex")}
          </Link>
        ) : null}
        {post.priceCents != null ? (
          post.priceHref ? (
            <Link href={post.priceHref} className="price mt-1 inline-flex min-h-11 items-center text-xl leading-none">
              {formatHkd(post.priceCents, locale)}
            </Link>
          ) : (
            <p className="price mt-1 text-xl leading-none">{formatHkd(post.priceCents, locale)}</p>
          )
        ) : null}
      </div>
    </article>
  );
}
