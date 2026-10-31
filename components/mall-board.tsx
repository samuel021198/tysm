"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mallCat, type MallSort } from "@/lib/auction";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { MALL_CHIPS, MALL_FEED_CAP, pickMallListings } from "@/lib/shop-inventory";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { PromoPill } from "./promo-pill";
import { VerificationPill, type VerificationTierName } from "./profile-header";

export type MallFeedCard = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionEndsAt: string | null;
  auctionSettled: boolean;
  promoted: boolean;
  sellerId: string;
  sellerName: string;
  storeName: string | null;
  photo: string;
  game: string | null;
  cardName: string | null;
  categorySlug: string;
  categoryZh: string;
  categoryEn: string;
};

export type MallShopCard = {
  id: string;
  nickname: string;
  storeName: string | null;
  avatarUrl: string | null;
  verificationTier: VerificationTierName;
  listings: number;
  recent: number;
};

type Lane = "hot" | "near" | "follow" | "auction";

const LANES: { id: Lane; zh: string; en: string }[] = [
  { id: "hot", zh: "熱門商品", en: "Hot" },
  { id: "near", zh: "附近商戶", en: "Nearby" },
  { id: "follow", zh: "已關注", en: "Following" },
  { id: "auction", zh: "拍賣", en: "Auctions" },
];

const SORTS: { id: MallSort; zh: string; en: string }[] = [
  { id: "new", zh: "最新上架", en: "Newest" },
  { id: "price_asc", zh: "價錢低→高", en: "Low to high" },
  { id: "price_desc", zh: "高→低", en: "High to low" },
  { id: "ending", zh: "即將結束", en: "Ending soon" },
];

/** Carousell mall. Tabs and chips stay on this page; they do not navigate. */
export function MallBoard({
  locale,
  q,
  sort,
  cat,
  loggedIn,
  interests,
  followedIds,
  listings,
  shops,
  moreCats,
}: {
  locale: Locale;
  q: string;
  sort: MallSort;
  cat: string;
  loggedIn: boolean;
  interests: string[];
  followedIds: string[];
  listings: MallFeedCard[];
  shops: MallShopCard[];
  moreCats: { slug: string; nameZh: string; nameEn: string }[];
}) {
  const [lane, setLane] = useState<Lane>("hot");
  const [sortId, setSortId] = useState<MallSort>(sort);
  const [catId, setCatId] = useState(cat);
  const [sheet, setSheet] = useState<"filter" | "more" | null>(null);
  const moreOn = catId !== "picks" && !MALL_CHIPS.some((chip) => chip.id === catId);
  const moreLabel = moreOn ? moreCats.find((row) => row.slug === catId) : null;

  useEffect(() => {
    if (!sheet) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheet(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const shown =
    lane === "near"
      ? []
      : pickMallListings(listings, { lane, cat: catId, interests, sort: sortId, followedIds });
  const chip = "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-semibold";
  const onChip = "bg-accent text-white";
  const offChip = "bg-soft text-ink";

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <form role="search" action="/shop" className="min-w-0 flex-1">
          {sortId !== "new" ? <input type="hidden" name="sort" value={sortId} /> : null}
          {catId !== "picks" ? <input type="hidden" name="cat" value={catId} /> : null}
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder={tx(locale, "搜尋", "Search")}
              aria-label={tx(locale, "搜尋", "Search")}
              enterKeyHint="search"
              className="h-11 w-full min-w-0 rounded-full border border-line bg-card pl-9 pr-3 text-base text-ink outline-none placeholder:text-[var(--field-placeholder)] focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
            />
          </div>
          <button type="submit" className="sr-only">{tx(locale, "搜尋", "Search")}</button>
        </form>
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card text-ink"
          aria-label={tx(locale, "詳細篩選", "Filters")}
          aria-haspopup="dialog"
          aria-expanded={sheet === "filter"}
          onClick={() => setSheet("filter")}
        >
          <FilterIcon />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto" aria-label={tx(locale, "分類", "Categories")}>
        <button type="button" className={`${chip} ${catId === "picks" ? onChip : offChip}`} aria-pressed={catId === "picks"} onClick={() => setCatId("picks")}>
          {tx(locale, "精選", "Picks")}
        </button>
        {MALL_CHIPS.map((row) => (
          <button key={row.id} type="button" className={`${chip} ${catId === row.id ? onChip : offChip}`} aria-pressed={catId === row.id} onClick={() => setCatId(row.id)}>
            {tx(locale, row.zh, row.en)}
          </button>
        ))}
        <button type="button" className={`${chip} ${moreOn ? onChip : offChip}`} aria-pressed={moreOn} aria-haspopup="dialog" onClick={() => setSheet("more")}>
          {moreLabel ? (locale === "en" ? moreLabel.nameEn : moreLabel.nameZh) : tx(locale, "更多", "More")}
        </button>
      </div>
      <div role="tablist" aria-label={tx(locale, "商店", "Shop")} className="flex gap-4 overflow-x-auto border-b border-line">
        {LANES.map((row) => {
          const on = lane === row.id;
          return (
            <button
              key={row.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`h-10 shrink-0 border-b-2 text-sm font-semibold ${on ? "border-accent text-ink" : "border-transparent text-muted"}`}
              onClick={() => setLane(row.id)}
            >
              {tx(locale, row.zh, row.en)}
            </button>
          );
        })}
      </div>
      {lane === "near" ? (
        shops.length === 0 ? (
          <Empty locale={locale} text={["暫未有商戶。", "No shops yet."]} />
        ) : (
          <ul className="grid gap-2">
            {shops.slice(0, MALL_FEED_CAP).map((store) => (
              <li key={store.id}>
                <StoreRow locale={locale} store={store} />
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        lane === "follow" && !loggedIn ? (
          <p className="py-6 text-center text-sm text-muted">
            <Link href="/login?next=/shop" className="text-link">{tx(locale, "登入後即可查看。", "Log in to see this.")}</Link>
          </p>
        ) : (
          <Empty locale={locale} text={lane === "auction" ? ["暫未有拍賣。", "No auctions yet."] : lane === "follow" ? ["未有已關注的貨品。", "No listings from people you follow."] : ["暫未有貨品。", "Nothing listed yet."]} />
        )
      ) : (
        <div className="feed">
          {shown.map((listing) => (
            <MallCard key={listing.id} locale={locale} listing={listing} />
          ))}
        </div>
      )}
      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-label={sheet === "filter" ? tx(locale, "詳細篩選", "Filters") : tx(locale, "更多", "More")}
            className="grid max-h-[70vh] w-full gap-1 overflow-y-auto border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-auto md:min-w-48 md:rounded-2xl md:pb-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {sheet === "filter" ? (
              <>
                {SORTS.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="flex h-11 items-center px-3 text-left text-sm font-medium"
                    aria-current={sortId === row.id ? "true" : undefined}
                    onClick={() => {
                      setSortId(row.id);
                      setSheet(null);
                    }}
                  >
                    {tx(locale, row.zh, row.en)}
                  </button>
                ))}
                <Link href="/shop/recent" className="flex h-11 items-center px-3 text-sm font-medium">{tx(locale, "最近瀏覽", "Recently viewed")}</Link>
                <Link href="/shop/watch" className="flex h-11 items-center px-3 text-sm font-medium">{tx(locale, "追蹤", "Watching")}</Link>
              </>
            ) : moreCats.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">{tx(locale, "沒有其他分類。", "No other categories.")}</p>
            ) : (
              moreCats.map((row) => (
                <button
                  key={row.slug}
                  type="button"
                  className="flex h-11 items-center px-3 text-left text-sm font-medium"
                  aria-current={catId === row.slug ? "true" : undefined}
                  onClick={() => {
                    setCatId(mallCat(row.slug));
                    setSheet(null);
                  }}
                >
                  {locale === "en" ? row.nameEn : row.nameZh}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MallCard({ locale, listing }: { locale: Locale; listing: MallFeedCard }) {
  const ends = listing.auctionEndsAt ? new Date(listing.auctionEndsAt) : null;
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled && ends != null && ends > new Date();
  const amount = auction ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? listing.startPrice ?? 0;
  const store = listing.storeName?.trim() || listing.sellerName;
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <Link href={`/listing/${listing.id}`} className="block">
        <img src={listing.photo} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />
      </Link>
      <span className="grid gap-1 px-2.5 py-2">
        <Link href={`/listing/${listing.id}`} className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</Link>
        <span className="flex items-center gap-1.5">
          <Link href={`/listing/${listing.id}`} className="price text-base leading-none">{formatHkd(amount, locale)}</Link>
          <PromoPill promoted={listing.promoted} />
        </span>
        {auction ? (
          <Link href="/auction" className="inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-link">
            <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
            {tx(locale, "拍賣", "Auction")}
          </Link>
        ) : null}
        {auction && listing.auctionEndsAt ? (
          <span className="text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt} locale={locale} /></span>
        ) : null}
        <Link href={`/listing/${listing.id}`} className="truncate text-xs text-muted">{store}</Link>
      </span>
    </article>
  );
}

function StoreRow({ locale, store }: { locale: Locale; store: MallShopCard }) {
  const name = store.storeName?.trim() || store.nickname;
  const counts = tx(locale, `${store.listings} 件 · ${store.recent} 新上架`, `${store.listings} listings · ${store.recent} new`);
  return (
    <Link href={`/shop/${store.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
      {store.avatarUrl ? (
        <img src={store.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{name.slice(0, 1)}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          <VerificationPill tier={store.verificationTier} />
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{counts}</span>
      </span>
    </Link>
  );
}

function Empty({ locale, text }: { locale: Locale; text: [string, string] }) {
  return (
    <div className="grid justify-items-center gap-2 py-6">
      <p className="text-center text-sm text-muted">{tx(locale, text[0], text[1])}</p>
      <Link href="/sell" className="btn btn-primary">{tx(locale, "刊登貨品", "List something")}</Link>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}
