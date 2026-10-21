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
  const sale =
    listing.saleType === "AUCTION" ? tx(locale, "拍賣", "Auction") : listing.saleType === "BOTH" ? tx(locale, "直購 + 拍賣", "BIN + auction") : tx(locale, "直購", "Buy Now");
  return (
    <article className="surface relative overflow-hidden">
      <Link href={`/listing/${listing.id}`} className="block">
        <div className="relative">
          <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" className="aspect-[4/5] w-full object-cover" />
          <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#221820] shadow-sm">
            {conditionLabel(listing)}
          </span>
        </div>
        <div className="grid gap-1 px-2.5 pb-3 pt-2.5">
          <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] font-medium leading-snug">{listing.title}</h2>
          <p className="price text-[1.15rem] leading-none">{formatHkd(amount, locale)}</p>
          <p className="truncate text-xs text-muted">
            {sale}
            {followed ? ` · ${tx(locale, "關注中", "Following")}` : ""}
            {live && listing.auctionEndsAt ? ` · ${formatHKT(listing.auctionEndsAt, locale, false)}` : ` · ${listing.seller.nickname}`}
          </p>
        </div>
      </Link>
      <form action={toggleFavorite} className="absolute right-1.5 top-1.5">
        <input type="hidden" name="listingId" value={listing.id} />
        <input type="hidden" name="next" value={next} />
        <button
          aria-label={tx(locale, "收藏", "Favorite")}
          className={`grid h-11 w-11 place-items-center rounded-full text-lg shadow-sm backdrop-blur ${favorited ? "bg-[#1b1418] text-rose" : "bg-white/90 text-[#9a5d78]"}`}
        >
          {favorited ? "♥" : "♡"}
          <span className="sr-only">{listing.favoriteCount}</span>
        </button>
      </form>
    </article>
  );
}
