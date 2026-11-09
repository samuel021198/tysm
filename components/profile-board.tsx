"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EDGE_GUARD } from "@/lib/gesture";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import type { ProfileThumb } from "@/lib/profile";
import { displayPhoto } from "@/lib/demo-covers";
import { profileBoardTabs, profileTabHref, profileTabIndex, profileTabStep, profileSwipeDirection, swipeBlocked, tabAxis } from "@/lib/tabs";
import { formatHkd } from "@/lib/format";
import { relativeTime } from "@/lib/time";
import { BuyoutSheet } from "./buyout-sheet";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { PROFILE_TAB_EVENT } from "./profile-tab-link";
import { ShopInventory, type ShopInventoryRow } from "./shop-inventory";

type Review = { id: string; nickname: string; stars: number; comment: string; reply: string | null };
type Draft = { id: string; title: string; status: string };
type BuyoutCard = {
  id: string;
  cardName: string;
  note: string;
  priceCents: number;
  negotiable: boolean;
  photo: string;
  createdAt: string;
};
type Sale = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionSettled: boolean;
  auctionEndsAt?: string | null;
  promoted?: boolean;
  photos: { url: string }[];
};

const TABS = [
  { id: "shelf", zh: "商品", en: "Listings", icon: "grid" },
  { id: "buyout", zh: "買取", en: "Buying", icon: "tag" },
  { id: "saved", zh: "收藏", en: "Favorites", icon: "bookmark" },
  { id: "selling", zh: "商店", en: "Shop", icon: "bag" },
  { id: "reviews", zh: "評價", en: "Reviews", icon: "star" },
] as const;

const tile = "block aspect-square w-full bg-soft object-contain";

function shownTab(tab: string, isSelf: boolean) {
  if (tab === "selling" && !isSelf) return "shelf";
  if (tab === "shelf" || tab === "buyout" || tab === "saved" || tab === "selling" || tab === "reviews") return tab;
  if (tab === "drafts" && isSelf) return "drafts";
  return "shelf";
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
  buyouts,
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
  buyouts: BuyoutCard[];
  inventory: ShopInventoryRow[];
  reviews: Review[];
  drafts: Draft[];
  favIds: string[];
  viewerId: string | null;
  ownerId: string;
  postsNext: string | null;
}) {
  // Legacy ?tab=box and ?tab=posts open the on-sale shelf.
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
  const idsRef = useRef<string[]>([]);
  tabRef.current = tab;
  baseRef.current = base;
  const tabs = TABS.filter((item) => profileBoardTabs(isSelf).includes(item.id));
  idsRef.current = tabs.map((item) => item.id);

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
    const ids = idsRef.current;
    const index = profileTabIndex(tabRef.current, ids);
    const atStart = index <= 0;
    const atEnd = index < 0 || index >= ids.length - 1;
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
    const next = dir ? profileTabStep(tabRef.current, dir, idsRef.current) : null;
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

  const ids = idsRef.current;
  const index = profileTabIndex(tab, ids);
  const width = frame.current?.clientWidth || 1;
  const progress = index < 0 ? null : Math.min(ids.length - 1, Math.max(0, index - offset / width));
  const motion = animate ? "transform 180ms ease" : "none";
  const neighborId = offset < -8 ? profileTabStep(tab, 1, ids) : offset > 8 ? profileTabStep(tab, -1, ids) : null;
  const active = progress == null ? -1 : Math.round(progress);

  function panel(id: string) {
    if (id === "shelf") return <ShelfGrid locale={locale} listings={listings} isSelf={isSelf} />;
    if (id === "buyout") return <BuyoutList locale={locale} rows={buyouts} isSelf={isSelf} />;
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
          <span>
            {tx(locale, "暫未有收藏。", "No favorites yet.")}
            {isSelf ? tx(locale, "貨品與貼文的收藏會顯示於此。", "Saved products and posts show up here.") : null}
          </span>
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
            <Link href="/add" className="block font-semibold text-ink underline underline-offset-2">
              {tx(locale, "上架第一件", "List the first item")}
            </Link>
          </p>
        );
      }
      return <ShelfGrid locale={locale} listings={listings} isSelf={false} />;
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
      <nav aria-label={tx(locale, "個人內容", "Profile")} className={`relative grid border-t border-line ${tabs.length >= 5 ? "grid-cols-5" : tabs.length === 4 ? "grid-cols-4" : tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {tabs.map((item, i) => {
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
          <span className={`pointer-events-none absolute bottom-0 left-0 h-0.5 bg-ink ${tabs.length >= 5 ? "w-1/5" : tabs.length === 4 ? "w-1/4" : tabs.length === 3 ? "w-1/3" : "w-1/2"}`} style={{ transform: `translateX(${progress * 100}%)`, transition: motion }} />
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

function BuyoutList({ locale, rows, isSelf }: { locale: Locale; rows: BuyoutCard[]; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const sheet = open ? <BuyoutSheet locale={locale} onClose={() => setOpen(false)} /> : null;
  const post = isSelf ? (
    <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => setOpen(true)}>
      {tx(locale, "發佈買取", "Post a buyout")}
    </button>
  ) : null;
  if (!rows.length) {
    return (
      <>
        <p className="empty mx-3 sm:mx-0">
          <span className="block">{tx(locale, "暫無買取。", "No buyouts yet.")}</span>
          {post}
        </p>
        {sheet}
      </>
    );
  }
  return (
    <>
      {post ? <div className="px-3 pt-3 sm:px-0">{post}</div> : null}
      <ul className="grid gap-2 px-3 pt-3 sm:px-0">
        {rows.map((row) => {
          const price = formatHkd(row.priceCents, locale);
          const when = relativeTime(row.createdAt, new Date(), locale);
          const mark = row.negotiable ? tx(locale, "可議價", "Negotiable") : "";
          return (
            <li key={row.id}>
              <Link
                href={`/buyout/${row.id}`}
                aria-label={[row.cardName, row.note, price, mark, when].filter(Boolean).join(" ")}
                className="surface flex gap-3 p-3"
              >
                <img src={displayPhoto(row.photo)} alt="" loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-xl bg-soft object-cover" />
                <span className="grid min-w-0 flex-1 content-start gap-1">
                  <span className="truncate text-sm font-semibold">{row.cardName}</span>
                  <span className="line-clamp-2 text-sm text-muted">{row.note}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="price">{price}</span>
                    {mark ? <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink">{mark}</span> : null}
                  </span>
                  <span className="text-xs text-muted">{when}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {sheet}
    </>
  );
}

function ShelfGrid({ locale, listings, isSelf }: { locale: Locale; listings: Sale[]; isSelf: boolean }) {
  if (!listings.length) {
    return (
      <p className="empty mx-3 sm:mx-0">
        <span className="block">{tx(locale, "暫無商品。", "No listings yet.")}</span>
        {isSelf ? (
          <Link href="/add" className="block font-semibold text-ink underline underline-offset-2">
            {tx(locale, "上架第一件", "List the first item")}
          </Link>
        ) : null}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-px">
      {listings.map((listing) => {
        const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
        return (
          <li key={listing.id} className="relative min-w-0">
            <Link href={`/listing/${listing.id}`} aria-label={listing.title} className="relative block">
              <img src={displayPhoto(listing.photos[0]?.url)} alt="" loading="lazy" decoding="async" className="block aspect-square w-full bg-soft object-cover" />
            </Link>
            {auction ? (
              <Link href="/auction" className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-md bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
                <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
                {tx(locale, "拍賣", "Auction")}
              </Link>
            ) : null}
            {auction && listing.auctionEndsAt ? <p className="truncate px-1 text-[10px] text-muted"><Countdown endsAt={listing.auctionEndsAt} locale={locale} /></p> : null}
          </li>
        );
      })}
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

