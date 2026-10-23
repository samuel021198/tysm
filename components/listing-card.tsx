import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { conditionLabel } from "@/lib/rules";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
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
  const live =
    listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  const amount = live ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? 0;
  const sale =
    listing.saleType === "AUCTION" ? tx(locale, "拍賣", "Auction") : listing.saleType === "BOTH" ? tx(locale, "直購 + 拍賣", "BIN + auction") : tx(locale, "直購", "Buy Now");
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/listing/${listing.id}`} className="block">
          <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" className="block aspect-[4/5] w-full bg-[#f4efe6] object-contain" />
        </Link>
        <span className="pointer-events-none absolute left-2.5 top-2.5 max-w-[62%] truncate rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm">
          {conditionLabel(listing)}
        </span>
        <form action={toggleFavorite} className="absolute bottom-2 right-2">
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="next" value={next} />
          <button
            aria-label={tx(locale, "收藏", "Favorite")}
            className={`grid h-11 w-11 place-items-center rounded-full text-2xl leading-none shadow-sm ${favorited ? "bg-[#1b1418] text-rose" : "bg-card text-[#9a5d78]"}`}
          >
            {favorited ? "♥" : "♡"}
            <span className="sr-only">{listing.favoriteCount}</span>
          </button>
        </form>
      </div>
      <Link href={`/listing/${listing.id}`} className="flex flex-1 flex-col gap-1.5 px-3 pb-3.5 pt-3">
        <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug">{listing.title}</h2>
        <p className="price text-[1.45rem] leading-none">{formatHkd(amount, locale)}</p>
        {series && series.length ? (
          <p className="flex items-center gap-1 text-[11px] text-muted">
            {series.length >= 2 ? <Sparkline values={series} /> : null}
            {amount >= series[series.length - 1] ? "↑" : "↓"} {tx(locale, "較上次成交", "vs last sale")} {formatHkd(Math.abs(amount - series[series.length - 1]), locale)}
          </p>
        ) : null}
        <p className="mt-auto truncate text-xs leading-4 text-muted">
          {sale}
          {followed ? ` · ${tx(locale, "關注中", "Following")}` : ""}
          {live && listing.auctionEndsAt ? ` · ${formatHKT(listing.auctionEndsAt, locale, false)}` : ` · ${listing.seller.nickname}`}
        </p>
      </Link>
    </article>
  );
}
