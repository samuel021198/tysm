import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { togglePostLike } from "@/actions/collect";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { PostMenu } from "./post-menu";
import { ShareButton } from "./share-button";

export function PostCard({
  post,
  locale,
  next = "/",
  gallery = false,
  owned = false,
}: {
  post: PostCardModel;
  locale: Locale;
  next?: string;
  gallery?: boolean;
  owned?: boolean;
}) {
  const photos = post.photos.length ? post.photos : ["/demo/back.svg"];
  const shown = gallery ? photos : photos.slice(0, 1);
  return (
    <PostMenu locale={locale} deleteId={owned && post.likePostId ? post.likePostId : null} hideKey={post.id} sharePath={post.sharePath}>
    <article className="surface overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 pr-9">
        <Link href={`/shop/${post.author.id}`} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
          {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : post.author.nickname.slice(0, 1)}
        </Link>
        <Link href={`/shop/${post.author.id}`} className="min-w-0 truncate font-semibold">
          {post.author.nickname}
        </Link>
      </div>
      <Link href={post.href} className="block">
        {shown.map((url, index) => (
          <img key={`${url}-${index}`} src={url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" className="block aspect-[4/5] w-full bg-soft object-contain" />
        ))}
      </Link>
      <div className="flex items-center border-t border-line">
        {post.likePostId ? (
          <form action={togglePostLike} className="flex-1">
            <input type="hidden" name="postId" value={post.likePostId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-1 text-sm font-medium leading-none">
              <span className="text-base leading-none" aria-hidden>{post.liked ? "♥" : "♡"}</span>
              <span>{post.likeCount}</span>
              <span className="sr-only">{tx(locale, "讚", "Like")}</span>
            </button>
          </form>
        ) : post.likeListingId ? (
          <form action={toggleFavorite} className="flex-1">
            <input type="hidden" name="listingId" value={post.likeListingId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-1 text-sm font-medium leading-none">
              <span className="text-base leading-none" aria-hidden>{post.liked ? "♥" : "♡"}</span>
              <span>{post.likeCount}</span>
              <span className="sr-only">{tx(locale, "讚", "Like")}</span>
            </button>
          </form>
        ) : (
          <span className="inline-flex h-10 flex-1 items-center justify-center text-base leading-none text-muted">♡</span>
        )}
        {post.commentHref ? (
          <Link href={post.commentHref} className="inline-flex h-10 flex-1 items-center justify-center text-sm font-medium leading-none">
            {tx(locale, "留言", "Comment")} {post.commentCount || ""}
          </Link>
        ) : (
          <span className="inline-flex h-10 flex-1 items-center justify-center text-sm text-muted" title={tx(locale, "這張未有貼文", "No post yet")}>
            {tx(locale, "留言", "Comment")}
          </span>
        )}
        <ShareButton path={post.sharePath} label={tx(locale, "分享", "Share")} copiedLabel={tx(locale, "已複製", "Copied")} />
      </div>
      <div className="px-2.5 pb-3 pt-1">
        <Link href={post.href} className="block">
          <h2 className="text-sm font-semibold leading-snug">
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
            <Link href={post.priceHref} className="price mt-1 inline-flex min-h-9 items-center text-lg leading-none">
              {formatHkd(post.priceCents, locale)}
            </Link>
          ) : (
            <p className="price mt-1 text-lg leading-none">{formatHkd(post.priceCents, locale)}</p>
          )
        ) : null}
      </div>
    </article>
    </PostMenu>
  );
}
