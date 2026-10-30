"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatHkd } from "@/lib/format";
import { EDGE_GUARD } from "@/lib/gesture";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import type { ProfileThumb } from "@/lib/profile";
import { displayPhoto } from "@/lib/demo-covers";
import { shopDisplayCents } from "@/lib/shop-inventory";
import { profileTabHref, profileTabIndex, profileTabStep, profileSwipeDirection, swipeBlocked, tabAxis } from "@/lib/tabs";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { PostMenu } from "./post-menu";
import { PROFILE_TAB_EVENT } from "./profile-tab-link";
import { ShopInventory, type ShopInventoryRow } from "./shop-inventory";

type Review = { id: string; nickname: string; stars: number; comment: string; reply: string | null };
type Draft = { id: string; title: string; status: string };
type Sale = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionSettled: boolean;
  auctionEndsAt?: string | null;
  photos: { url: string }[];
};

const TABS = [
  { id: "posts", zh: "My Binder", en: "My Binder", icon: "binder" },
  { id: "saved", zh: "收藏", en: "Favorites", icon: "bookmark" },
  { id: "selling", zh: "商店", en: "Shop", icon: "bag" },
  { id: "reviews", zh: "評價", en: "Reviews", icon: "star" },
] as const;

const tile = "block aspect-square w-full bg-soft object-contain";

function shownTab(tab: string, isSelf: boolean) {
  if (tab === "saved" || tab === "selling" || tab === "reviews") return tab;
  if (tab === "drafts" && isSelf) return "drafts";
  return "posts";
}

export function ProfileBoard({
  locale,
  base,
  tab: initial,
  isSelf,
  posts,
  savedListings,
  savedPosts,
  listings,
  inventory,
  reviews,
  drafts,
  viewerId,
  ownerId,
  postsNext,
}: {
  locale: Locale;
  base: string;
  tab: string;
  isSelf: boolean;
  posts: PostCardModel[];
  savedListings: ProfileThumb[];
  savedPosts: ProfileThumb[];
  listings: Sale[];
  inventory: ShopInventoryRow[];
  reviews: Review[];
  drafts: Draft[];
  favIds: string[];
  viewerId: string | null;
  ownerId: string;
  postsNext: string | null;
}) {
  // Legacy ?tab=box was the owned-card grid. It now opens My Binder (own posts).
  const [tab, setTab] = useState(() => shownTab(initial, isSelf));
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const lockX = useRef(false);
  const busy = useRef(false);
  const suppress = useRef(false);
  const timer = useRef(0);
  const raf = useRef(0);
  const tabRef = useRef(tab);
  const baseRef = useRef(base);
  tabRef.current = tab;
  baseRef.current = base;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.cancelAnimationFrame(raf.current);
    },
    [],
  );

  useEffect(() => {
    setTab(shownTab(initial, isSelf));
    setOffset(0);
  }, [initial, isSelf]);

  useEffect(() => {
    function onSelect(event: Event) {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next !== "string") return;
      setAnimate(false);
      setOffset(0);
      setTab(shownTab(next, isSelf));
    }
    window.addEventListener(PROFILE_TAB_EVENT, onSelect);
    return () => window.removeEventListener(PROFILE_TAB_EVENT, onSelect);
  }, [isSelf]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    function onTouchMove(event: TouchEvent) {
      if (lockX.current && event.cancelable) event.preventDefault();
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  function apply(next: string) {
    setTab(next);
    window.history.replaceState(null, "", profileTabHref(baseRef.current, next));
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType !== "touch" || busy.current) return;
    if (swipeBlocked()) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("input, textarea, select")) return;
    const gesture = event.target.closest("[data-gesture]");
    if (gesture && gesture !== frame.current) return;
    origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    axis.current = null;
    lockX.current = false;
    setAnimate(false);
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = origin.current;
    if (!start || event.pointerId !== start.id || busy.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!axis.current) axis.current = tabAxis(dx, dy);
    if (axis.current !== "x") {
      lockX.current = false;
      return;
    }
    if (dx > 0 && start.x < EDGE_GUARD) {
      lockX.current = false;
      return;
    }
    lockX.current = true;
    const index = profileTabIndex(tabRef.current);
    const atStart = index <= 0;
    const atEnd = index < 0 || index >= TABS.length - 1;
    let slide = dx;
    if (tabRef.current === "drafts" || (atStart && dx > 0) || (atEnd && dx < 0)) slide = dx * 0.22;
    setOffset(slide);
  }

  function end(event: React.PointerEvent, commit: boolean) {
    const start = origin.current;
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const locked = axis.current;
    origin.current = null;
    axis.current = null;
    lockX.current = false;
    if (Math.hypot(dx, dy) > 24) {
      suppress.current = true;
      window.setTimeout(() => {
        suppress.current = false;
      }, 400);
    }
    const dir = commit
      ? profileSwipeDirection({ dx, dy, startX: start.x, axis: locked, viewportWidth: window.innerWidth })
      : null;
    const next = dir ? profileTabStep(tabRef.current, dir) : null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!next || !dir || reduce || tabRef.current === "drafts") {
      setAnimate(!reduce && !next);
      setOffset(0);
      if (next) apply(next);
      return;
    }
    const width = frame.current?.clientWidth || window.innerWidth;
    busy.current = true;
    setAnimate(true);
    // Turn the transition on before moving, or the settle skips the animation.
    raf.current = requestAnimationFrame(() => {
      setOffset(dir > 0 ? -width : width);
      timer.current = window.setTimeout(() => {
        busy.current = false;
        setAnimate(false);
        setOffset(0);
        apply(next);
      }, 180);
    });
  }

  const index = profileTabIndex(tab);
  const width = frame.current?.clientWidth || 1;
  const progress = index < 0 ? null : Math.min(TABS.length - 1, Math.max(0, index - offset / width));
  const motion = animate ? "transform 180ms ease" : "none";
  const neighborId = offset < -8 ? profileTabStep(tab, 1) : offset > 8 ? profileTabStep(tab, -1) : null;
  const active = progress == null ? -1 : Math.round(progress);

  function panel(id: string) {
    if (id === "posts") {
      return posts.length ? (
        <LazyPostGrid locale={locale} base={base} posts={posts} viewerId={viewerId} ownerId={ownerId} next={id === tab ? postsNext : null} />
      ) : (
        <p className="empty mx-3 sm:mx-0">
          <span className="block">{tx(locale, "未有貼文", "No posts yet")}</span>
          {isSelf ? (
            <Link href="/add?kind=post" className="block font-semibold text-ink underline underline-offset-2">
              {tx(locale, "發佈第一則", "Post the first one")}
            </Link>
          ) : null}
        </p>
      );
    }
    if (id === "saved") {
      return isSelf && (savedListings.length || savedPosts.length) ? (
        <>
          {savedListings.length ? (
            <section>
              <h2 className="px-3 pt-2 text-xs font-semibold text-muted sm:px-0">{tx(locale, "貨品", "Products")}</h2>
              <ThumbGrid rows={savedListings} emptyLabel={tx(locale, "收藏", "Favorite")} />
            </section>
          ) : null}
          {savedPosts.length ? (
            <section>
              <h2 className="px-3 pt-2 text-xs font-semibold text-muted sm:px-0">{tx(locale, "貼文", "Posts")}</h2>
              <ThumbGrid rows={savedPosts} emptyLabel={tx(locale, "貼文", "Post")} />
            </section>
          ) : null}
        </>
      ) : (
        <p className="empty mx-3 sm:mx-0">
          <span className="block">{tx(locale, "未有收藏。", "No favorites yet.")}</span>
          {isSelf ? <span className="mt-1 block">{tx(locale, "貨品同貼文的收藏會喺呢度。", "Saved products and posts show up here.")}</span> : null}
        </p>
      );
    }
    if (id === "selling") {
      if (isSelf) {
        return inventory.length ? (
          <ShopInventory locale={locale} rows={inventory} next={`${base.split("?")[0]}?tab=selling`} />
        ) : (
          <p className="empty mx-3 sm:mx-0">
            <span className="block">{tx(locale, "未有上架。", "Nothing listed.")}</span>
            <Link href="/sell" className="block font-semibold text-ink underline underline-offset-2">
              {tx(locale, "上架第一件", "List the first item")}
            </Link>
          </p>
        );
      }
      return listings.length ? (
        <ul className="grid grid-cols-3 gap-px">
          {listings.map((listing) => {
            const amount = shopAsk(listing);
            const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
            const label = amount != null ? `${listing.title} ${formatHkd(amount, locale)}` : listing.title;
            return (
              <li key={listing.id} className="relative min-w-0">
                <Link href={`/listing/${listing.id}`} aria-label={label} className="relative block">
                  <img src={displayPhoto(listing.photos[0]?.url)} alt="" loading="lazy" decoding="async" className={tile} />
                </Link>
                {auction ? (
                  <Link href="/auction" className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-md bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
                    <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
                    {tx(locale, "拍賣", "Auction")}
                  </Link>
                ) : null}
                {amount != null ? <p className="truncate px-1 py-1 text-[10px] font-semibold leading-none">{formatHkd(amount, locale)}</p> : null}
                {auction && listing.auctionEndsAt ? <p className="truncate px-1 text-[10px] text-muted"><Countdown endsAt={listing.auctionEndsAt} locale={locale} /></p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty mx-3 sm:mx-0">{tx(locale, "未有賣緊的卡。", "Nothing for sale.")}</p>
      );
    }
    if (id === "reviews") {
      return reviews.length ? (
        <ul className="grid gap-2 px-3 pt-3 text-sm sm:px-0">
          {reviews.map((review) => (
            <li key={review.id} className="surface px-3 py-2.5">
              <p>{review.nickname} · {"★".repeat(review.stars)}</p>
              <p>{review.comment}</p>
              {review.reply ? <p className="text-muted">{tx(locale, "回覆", "Reply")}: {review.reply}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty mx-3 sm:mx-0">{tx(locale, "未有評價。", "No reviews.")}</p>
      );
    }
    return null;
  }

  return (
    <div
      ref={frame}
      className="-mx-3 overflow-hidden sm:mx-0"
      data-gesture=""
      data-profile-pager=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => end(event, true)}
      onPointerCancel={(event) => end(event, false)}
      onClickCapture={(event) => {
        if (!suppress.current) return;
        suppress.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <nav aria-label={tx(locale, "個人內容", "Profile")} className="relative grid grid-cols-4 border-t border-line">
        {TABS.map((item, i) => {
          const on = i === active;
          const label = tx(locale, item.zh, item.en);
          return (
            <button
              key={item.id}
              type="button"
              aria-label={label}
              title={label}
              aria-current={on ? "page" : undefined}
              className={`relative grid h-12 place-items-center ${on ? "text-ink" : "text-muted"}`}
              onClick={() => {
                if (item.id === tab && !busy.current) return;
                window.clearTimeout(timer.current);
                window.cancelAnimationFrame(raf.current);
                busy.current = false;
                setAnimate(false);
                setOffset(0);
                apply(item.id);
              }}
            >
              <Icon name={item.icon} className="h-6 w-6" strokeWidth={on ? 2.15 : 1.6} />
            </button>
          );
        })}
        {progress != null ? (
          <span className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/4 bg-ink" style={{ transform: `translateX(${progress * 100}%)`, transition: motion }} />
        ) : null}
      </nav>
      {tab === "drafts" ? (
        drafts.length ? (
          <ul className="grid gap-2 px-3 pt-3 sm:px-0">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link href={`/sell/${draft.id}`} className="surface flex h-11 items-center justify-between px-3 text-sm">
                  <span className="min-w-0 truncate">{draft.title}</span>
                  <span className="text-sm text-muted">{listingStatusLabel(locale, draft.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty mx-3 sm:mx-0">{tx(locale, "未有草稿。", "No drafts.")}</p>
        )
      ) : (
        <div className="relative overflow-hidden">
          <div className="min-w-0" style={{ transform: `translate3d(${offset}px, 0, 0)`, transition: motion }}>
            {panel(tab)}
          </div>
          {neighborId ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 min-w-0"
              style={{ transform: `translate3d(calc(${offset < 0 ? "100%" : "-100%"} + ${offset}px), 0, 0)`, transition: motion }}
            >
              {panel(neighborId)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LazyPostGrid({
  locale,
  base,
  posts,
  viewerId,
  ownerId,
  next,
}: {
  locale: Locale;
  base: string;
  posts: PostCardModel[];
  viewerId: string | null;
  ownerId: string;
  next: string | null;
}) {
  const [rows, setRows] = useState(posts);
  const [cursor, setCursor] = useState(next);
  const lock = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRows(posts);
    setCursor(next);
  }, [posts, next]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const token = cursor;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || lock.current) return;
      lock.current = true;
      fetch(`/api/profile/${ownerId}/posts?cursor=${encodeURIComponent(token)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { posts?: PostCardModel[]; next?: string | null } | null) => {
          if (!data?.posts) {
            setCursor(null);
            return;
          }
          setRows((prev) => {
            const seen = new Set(prev.map((row) => row.id));
            return [...prev, ...data.posts!.filter((row) => !seen.has(row.id))];
          });
          setCursor(data.next ?? null);
        })
        .catch(() => setCursor(null))
        .finally(() => {
          lock.current = false;
        });
    }, { rootMargin: "240px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, ownerId]);

  return (
    <>
      <PostTiles locale={locale} base={base} posts={rows} viewerId={viewerId} />
      {cursor ? <div ref={sentinel} className="h-8" /> : null}
    </>
  );
}

function PostTiles({
  locale,
  base,
  posts,
  viewerId,
}: {
  locale: Locale;
  base: string;
  posts: PostCardModel[];
  viewerId: string | null;
}) {
  return (
    <ul className="grid grid-cols-3 gap-px">
      {posts.map((post) => (
        <li key={post.id} className="min-w-0">
          <PostMenu
            locale={locale}
            postId={post.postId}
            listingId={post.listingId}
            own={viewerId != null && viewerId === post.author.id}
            loggedIn={viewerId != null}
            userId={post.author.id}
            sharePath={post.sharePath}
            next={base}
            button={false}
          >
            <Link href={post.href} aria-label={post.cardName || tx(locale, "貼文", "Post")} className="relative block">
              <img src={post.photos[0] || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className={tile} />
              {post.photos.length > 1 ? <StackMark /> : null}
            </Link>
          </PostMenu>
        </li>
      ))}
    </ul>
  );
}

function ThumbGrid({ rows, emptyLabel }: { rows: ProfileThumb[]; emptyLabel: string }) {
  return (
    <ul className="grid grid-cols-3 gap-px">
      {rows.map((row) => (
        <li key={row.id} className="min-w-0">
          <Link href={row.href} aria-label={row.label || emptyLabel} className="block">
            <img src={row.photo || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className={tile} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function shopAsk(listing: Sale): number | null {
  return shopDisplayCents(listing);
}

function StackMark() {
  return (
    <span className="pointer-events-none absolute right-1 top-1 bg-card/90 p-0.5 text-ink" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="7" y="7" width="12" height="12" />
        <path d="M5 16.5V5h11.5" />
      </svg>
    </span>
  );
}
