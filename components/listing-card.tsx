import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { conditionLabel } from "@/lib/rules";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";

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
}: {
  listing: CardListing;
  locale: Locale;
  favorited: boolean;
  followed: boolean;
  next?: string;
}) {
  const live =
    listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  const amount = live ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? 0;
  const tall = listing.id.charCodeAt(0) % 2 === 0;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <Link href={`/listing/${listing.id}`} className="block">
        <img
          src={listing.photos[0]?.url || "/demo/back.svg"}
          alt=""
          className={`${tall ? "aspect-[3/4]" : "aspect-square"} w-full object-cover`}
        />
      </Link>
      <div className="grid gap-2 p-3">
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="rounded-full bg-soft px-2 py-0.5">{conditionLabel(listing)}</span>
          {followed ? <span className="rounded-full bg-soft px-2 py-0.5">{tx(locale, "關注中", "Following")}</span> : null}
          <span className="rounded-full bg-soft px-2 py-0.5">
            {listing.saleType === "AUCTION" ? tx(locale, "拍賣", "Auction") : listing.saleType === "BOTH" ? tx(locale, "直購+拍賣", "BIN + auction") : tx(locale, "直購", "Buy Now")}
          </span>
        </div>
        <Link href={`/listing/${listing.id}`} className="font-medium leading-snug">
          {listing.title}
        </Link>
        <p className="text-sm">{formatHkd(amount, locale)}</p>
        {live && listing.auctionEndsAt ? (
          <p className="text-xs text-muted">{tx(locale, "結束", "Ends")} {formatHKT(listing.auctionEndsAt, locale)}</p>
        ) : null}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{listing.seller.nickname}</span>
          <form action={toggleFavorite}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="next" value={next} />
            <button aria-label={tx(locale, "收藏", "Favorite")}>{favorited ? "♥" : "♡"} {listing.favoriteCount}</button>
          </form>
        </div>
      </div>
    </article>
  );
}
