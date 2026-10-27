import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { togglePostLike } from "@/actions/collect";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { Icon } from "./icons";
import { PhotoStrip } from "./photo-strip";
import { PostMenu } from "./post-menu";
import { ShareButton } from "./share-button";

export function PostCard({
  post,
  locale,
  next = "/",
  gallery = false,
  viewerId = null,
}: {
  post: PostCardModel;
  locale: Locale;
  next?: string;
  gallery?: boolean;
  viewerId?: string | null;
}) {
  const photos = post.photos.length ? post.photos : ["/demo/back.svg"];
  const shown = gallery ? photos : photos.slice(0, 1);
  const likeFormId = post.likePostId || post.likeListingId ? `like-${post.id}` : undefined;
  const commentLabel = post.commentCount ? `${tx(locale, "留言", "Comment")} ${post.commentCount}` : tx(locale, "留言", "Comment");
  const dexLabel = tx(locale, "睇圖鑑", "View in the dex");
  const price =
    post.priceCents == null ? null : post.priceHref ? (
      <Link href={post.priceHref} className="price inline-flex min-h-9 items-center text-lg leading-none">
        {formatHkd(post.priceCents, locale)}
      </Link>
    ) : (
      <p className="price text-lg leading-none">{formatHkd(post.priceCents, locale)}</p>
    );
  return (
    <PostMenu
      locale={locale}
      postId={post.postId}
      listingId={post.listingId}
      own={viewerId != null && viewerId === post.author.id}
      loggedIn={viewerId != null}
      sharePath={post.sharePath}
      next={next}
      swipeRightFormId={likeFormId}
    >
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
        {gallery && photos.length > 1 ? (
          <PhotoStrip photos={photos} />
        ) : (
          shown.map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" className="block aspect-[4/5] w-full bg-soft object-cover" />
          ))
        )}
      </Link>
      <div className="flex items-center border-t border-line">
        {post.likePostId ? (
          <form id={likeFormId} action={togglePostLike} className="flex-1">
            <input type="hidden" name="postId" value={post.likePostId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-1 text-sm font-medium leading-none">
              <span className="text-base leading-none" aria-hidden>{post.liked ? "♥" : "♡"}</span>
              <span>{post.likeCount}</span>
              <span className="sr-only">{tx(locale, "讚", "Like")}</span>
            </button>
          </form>
        ) : post.likeListingId ? (
          <form id={likeFormId} action={toggleFavorite} className="flex-1">
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
          <Link href={post.commentHref} aria-label={commentLabel} title={commentLabel} className="inline-flex h-10 flex-1 items-center justify-center gap-1 text-sm font-medium leading-none">
            <Icon name="messages" className="h-4 w-4" />
            {post.commentCount ? <span>{post.commentCount}</span> : null}
          </Link>
        ) : (
          <span className="inline-flex h-10 flex-1 items-center justify-center text-muted" title={tx(locale, "這張未有貼文", "No post yet")} aria-label={commentLabel}>
            <Icon name="messages" className="h-4 w-4" />
          </span>
        )}
        <ShareButton
          icon
          className="inline-flex h-10 flex-1 items-center justify-center text-ink"
          path={post.sharePath}
          label={tx(locale, "分享", "Share")}
          copiedLabel={tx(locale, "已複製", "Copied")}
          internalLabel={tx(locale, "內部分享", "In TYSM")}
        />
      </div>
      <div className="px-2.5 pb-3 pt-1">
        <Link href={post.href} className="block">
          <h2 className="text-sm font-semibold leading-snug">
            {post.cardName}
            {post.condition ? <span className="font-medium text-muted"> · {post.condition}</span> : null}
          </h2>
        </Link>
        {post.dexHref || price ? (
          <div className="mt-1 flex items-center gap-1">
            {post.dexHref ? (
              <Link href={post.dexHref} aria-label={dexLabel} title={dexLabel} className="grid h-9 w-9 shrink-0 place-items-center text-link">
                <Icon name="book" className="h-[18px] w-[18px]" />
              </Link>
            ) : null}
            {price}
          </div>
        ) : null}
      </div>
    </article>
    </PostMenu>
  );
}
