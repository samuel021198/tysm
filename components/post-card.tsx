"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { togglePostLike, togglePostSave } from "@/actions/collect";
import { toggleFavorite } from "@/actions/social";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { HandoverForm } from "./handover-form";
import { CommentSheet } from "./comment-sheet";
import { Icon } from "./icons";
import { PhotoStrip } from "./photo-strip";
import { PostMenu } from "./post-menu";
import { ShareButton } from "./share-button";
import { TopicChips } from "./topic-chips";

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
  const likeFormId = post.likePostId ? `like-${post.id}` : undefined;
  const [count, setCount] = useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentLabel = count ? `${tx(locale, "留言", "Comment")} ${count}` : tx(locale, "留言", "Comment");
  useEffect(() => {
    if (!post.postId) return;
    if (window.location.hash !== "#comments") return;
    if (window.location.pathname !== `/post/${post.postId}`) return;
    setCommentsOpen(true);
  }, [post.postId]);
  const saveLabel = tx(locale, "收藏", "Favorite");
  const likeLabel = post.likeCount ? `${tx(locale, "讚", "Like")} ${post.likeCount}` : tx(locale, "讚", "Like");
  const buy = viewerId != null && viewerId === post.author.id ? null : post.buy;
  const priceText = post.priceCents == null ? "" : formatHkd(post.priceCents, locale);
  const price =
    post.priceCents == null ? null : (
      <div className="mt-1 flex items-start justify-between gap-2">
        {buy?.kind === "contact" && post.priceHref ? (
          <Link href={post.priceHref} className="price shrink-0 text-[15px] leading-none">{priceText}</Link>
        ) : (
          <p className="price shrink-0 text-[15px] leading-none">{priceText}</p>
        )}
        {buy && post.listingId ? (
          <HandoverForm locale={locale} listingId={post.listingId} postId={post.postId} bargain={buy.kind === "deal"} layout="row" />
        ) : null}
      </div>
    );
  const photoClass = gallery
    ? "block max-h-[70vh] w-full bg-soft object-contain"
    : "block aspect-[4/5] w-full bg-soft object-cover";
  const action = "inline-flex h-10 min-w-10 items-center gap-1 pl-2.5 pr-2 text-sm font-medium leading-none";
  return (
    <>
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
      {photos.length > 1 ? (
        <PhotoStrip photos={photos} href={post.href} imageClass={photoClass} />
      ) : (
        <Link href={post.href} className="block">
          <img src={photos[0]} alt="" loading="eager" decoding="async" className={photoClass} />
        </Link>
      )}
      <div className="flex items-center border-t border-line">
        {post.likePostId ? (
          <form id={likeFormId} action={togglePostLike}>
            <input type="hidden" name="postId" value={post.likePostId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className={action} aria-label={likeLabel}>
              <Heart on={post.liked} />
            </button>
          </form>
        ) : null}
        {post.postId ? (
          <button type="button" aria-label={commentLabel} title={commentLabel} aria-expanded={commentsOpen} aria-haspopup="dialog" className={action} onClick={() => setCommentsOpen(true)}>
            <Icon name="messages" className="h-5 w-5" strokeWidth={2.25} />
          </button>
        ) : (
          <span className={`${action} text-muted`} title={tx(locale, "這張未有貼文", "No post yet")} aria-label={commentLabel}>
            <Icon name="messages" className="h-5 w-5" strokeWidth={2.25} />
          </span>
        )}
        <ShareButton
          icon
          className={action}
          path={post.sharePath}
          label={tx(locale, "分享", "Share")}
          copiedLabel={tx(locale, "已複製", "Copied")}
          internalLabel={tx(locale, "內部分享", "In TYSM")}
        />
        <div className="ml-auto flex shrink-0 items-center">
          <SavePost post={post} next={next} label={saveLabel} action={action} />
        </div>
      </div>
      <div className="px-2.5 pb-3 pt-1">
        <Link href={post.href} className="block min-w-0">
          <h2 className="flex min-w-0 items-baseline gap-1.5 text-sm leading-5">
            <span className="truncate font-semibold">{post.cardName}</span>
            {post.condition ? <span className="shrink-0 font-medium text-muted">{post.condition}</span> : null}
          </h2>
        </Link>
        {!gallery && post.caption ? (
          <FeedCaption text={post.caption} more={tx(locale, "更多", "More")} />
        ) : null}
        {price}
        {gallery ? null : <TopicChips tags={post.tags} className="mt-1.5" />}
      </div>
    </article>
    {commentsOpen && post.postId ? (
      <CommentSheet postId={post.postId} locale={locale} onClose={() => setCommentsOpen(false)} onPosted={() => setCount((n) => n + 1)} />
    ) : null}
    </PostMenu>
    {gallery && buy && post.listingId && post.priceCents != null ? (
      <BuyBar locale={locale} price={priceText} listingId={post.listingId} postId={post.postId} bargain={buy.kind === "deal"} />
    ) : null}
    </>
  );
}

/** line-clamp reports scrollHeight equal to the box, so compare an unclamped copy. */
function textOverflows(el: HTMLElement): boolean {
  if (el.clientWidth === 0) return false;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.className = "";
  clone.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;display:block;width:${el.clientWidth}px;height:auto;overflow:visible`;
  el.parentElement?.appendChild(clone);
  const over = clone.offsetHeight > el.clientHeight + 1;
  clone.remove();
  return over;
}

function FeedCaption({ text, more }: { text: string; more: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflow(textOverflows(el));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [text, open]);

  return (
    <p className="relative mt-1 text-sm leading-5 text-muted">
      <span ref={ref} className={open ? "block" : "line-clamp-2 block"}>
        {text}
      </span>
      {!open && overflow ? (
        <button
          type="button"
          className="absolute bottom-0 right-0 border-0 bg-[linear-gradient(to_left,var(--card)_72%,transparent)] pl-3 font-medium leading-5 text-ink"
          onClick={() => setOpen(true)}
        >
          {more}
        </button>
      ) : null}
    </p>
  );
}

function BuyBar({
  locale,
  price,
  listingId,
  postId,
  bargain,
}: {
  locale: Locale;
  price: string;
  listingId: string;
  postId: string | null;
  bargain: boolean;
}) {
  return (
    <>
      <div className="h-36" aria-hidden />
      <div className="fixed inset-x-0 bottom-[var(--tab-h)] z-30 border-t border-line bg-card/95 px-3 py-2 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <p className="price min-w-0 flex-1 truncate pt-2 text-lg leading-none">{price}</p>
          <HandoverForm locale={locale} listingId={listingId} postId={postId} bargain={bargain} layout="row" />
        </div>
      </div>
    </>
  );
}

function SavePost({
  post,
  next,
  label,
  action,
}: {
  post: PostCardModel;
  next: string;
  label: string;
  action: string;
}) {
  if (!post.savePostId && !post.saveListingId) return null;
  return (
    <form action={post.savePostId ? togglePostSave : toggleFavorite}>
      {post.savePostId ? <input type="hidden" name="postId" value={post.savePostId} /> : <input type="hidden" name="listingId" value={post.saveListingId || ""} />}
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={action} aria-label={label} aria-pressed={post.saved}>
        <Bookmark on={post.saved} />
      </button>
    </form>
  );
}

function Bookmark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.2 5h9.6a1 1 0 0 1 1 1V20l-5.8-3.3L6.2 20V6a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function Heart({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19.2s-6.2-3.9-6.2-8.1A3.4 3.4 0 0 1 12 8.6a3.4 3.4 0 0 1 6.2 2.5c0 4.2-6.2 8.1-6.2 8.1z" />
    </svg>
  );
}
