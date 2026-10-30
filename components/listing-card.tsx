import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { conditionLabel } from "@/lib/rules";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { displayPhoto } from "@/lib/demo-covers";
import { shopDisplayCents } from "@/lib/shop-inventory";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { PromoPill } from "./promo-pill";
import { Sparkline } from "./sparkline";

type CardListing = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionEndsAt: Date | null;
  auctionSettled: boolean;
  favoriteCount: number;
  conditionTrack: "RAW" | "GRADED";
  rawGrade: string | null;
  grader: string | null;
  gradeValue: number | null;
  sellerId: string;
  promoted?: boolean;
  photos: { url: string }[];
  seller: { nickname: string };
};

export function ListingCard({
  listing,
  locale,
  favorited,
  followed,
  next = "/",
  series,
}: {
  listing: CardListing;
  locale: Locale;
  favorited: boolean;
  followed: boolean;
  next?: string;
  series?: number[];
}) {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  const live = auction && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  const amount = shopDisplayCents(listing) ?? 0;
  const sale = auction ? null : tx(locale, "直購", "Buy Now");
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/listing/${listing.id}`} className="block">
          <img src={displayPhoto(listing.photos[0]?.url)} alt="" loading="lazy" decoding="async" className="block aspect-[4/5] w-full bg-soft object-contain" />
        </Link>
        <span className="pointer-events-none absolute left-2.5 top-2.5 max-w-[62%] truncate rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm">
          {conditionLabel(listing)}
        </span>
        <form action={toggleFavorite} className="absolute bottom-2 right-2">
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="next" value={next} />
          <button
            aria-label={tx(locale, "收藏", "Favorite")}
            title={tx(locale, "收藏", "Favorite")}
            aria-pressed={favorited}
            className={`grid h-8 w-8 place-items-center rounded-full shadow-sm ${favorited ? "bg-card text-accent" : "bg-card text-muted"}`}
          >
            <Icon name="bookmark" className="h-5 w-5" strokeWidth={2.25} filled={favorited} />
            <span className="sr-only">{listing.favoriteCount}</span>
          </button>
        </form>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-2">
        <Link href={`/listing/${listing.id}`} className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-snug">
          <h2>{listing.title}</h2>
        </Link>
        <p className="flex items-center gap-1.5">
          <Link href={`/listing/${listing.id}`} className="price text-[1.25rem] leading-none">{formatHkd(amount, locale)}</Link>
          <PromoPill promoted={listing.promoted} />
          {auction ? (
            <Link href="/auction" className="inline-flex h-5 items-center gap-1 rounded-full bg-accent/10 px-2 text-[11px] font-semibold leading-none text-link">
              <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
              {tx(locale, "拍賣", "Auction")}
            </Link>
          ) : null}
        </p>
        {live && listing.auctionEndsAt ? (
          <p className="text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt.toISOString()} locale={locale} /></p>
        ) : null}
        {series && series.length ? <PriceDelta locale={locale} amount={amount} series={series} /> : null}
        <Link href={`/listing/${listing.id}`} className="mt-auto truncate text-xs leading-4 text-muted">
          {[
            sale,
            followed ? tx(locale, "關注中", "Following") : "",
            listing.seller.nickname,
          ].filter(Boolean).join(" · ")}
        </Link>
      </div>
    </article>
  );
}

function PriceDelta({ locale, amount, series }: { locale: Locale; amount: number; series: number[] }) {
  const last = series[series.length - 1];
  const delta = amount - last;
  if (series.length < 2 && delta === 0) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-muted">
      {series.length >= 2 ? <Sparkline values={series} /> : null}
      {delta !== 0 ? (
        <>
          {delta > 0 ? "↑" : "↓"} {tx(locale, "較上次成交", "vs last sale")} {formatHkd(Math.abs(delta), locale)}
        </>
      ) : null}
    </p>
  );
}
