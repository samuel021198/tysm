import Link from "next/link";
import { toggleCollectionVisibility } from "@/actions/collect";
import { formatHkd } from "@/lib/format";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { Icon } from "./icons";

type Item = {
  id: string;
  cardName: string;
  condition: string;
  visibility: "PUBLIC" | "PRIVATE";
  photo: string | null;
  priceCents: number | null;
  href: string | null;
  catalogCardId: string | null;
  listingId: string | null;
};

type Review = { id: string; nickname: string; stars: number; comment: string; reply: string | null };
type Draft = { id: string; title: string; status: string };
type Sale = {
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

const TABS = [
  { id: "posts", zh: "貼文", en: "Posts", icon: "grid" },
  { id: "box", zh: "收藏", en: "Collection", icon: "bookmark" },
  { id: "selling", zh: "商店", en: "Shop", icon: "bag" },
  { id: "reviews", zh: "評價", en: "Reviews", icon: "star" },
] as const;

const tile = "block aspect-square w-full bg-soft object-contain";

export function ProfileBoard({
  locale,
  base,
  tab,
  isSelf,
  posts,
  items,
  listings,
  reviews,
  drafts,
}: {
  locale: Locale;
  base: string;
  tab: string;
  isSelf: boolean;
  posts: PostCardModel[];
  items: Item[];
  listings: Sale[];
  reviews: Review[];
  drafts: Draft[];
  favIds: string[];
}) {
  const panel = tab === "box" || tab === "selling" || tab === "reviews" || (tab === "drafts" && isSelf) ? tab : "posts";
  return (
    <div className="-mx-3 sm:mx-0">
      <nav aria-label={tx(locale, "個人內容", "Profile")} className="grid grid-cols-4 border-t border-line">
        {TABS.map((item) => {
          const on = panel === item.id;
          const label = tx(locale, item.zh, item.en);
          return (
            <Link
              key={item.id}
              href={`${base}?tab=${item.id}`}
              aria-current={on ? "page" : undefined}
              className={`relative flex h-11 items-center justify-center ${on ? "text-ink" : "text-muted"}`}
            >
              <Icon name={item.icon} className="h-7 w-7" strokeWidth={on ? 2.15 : 1.6} />
              <span className="sr-only">{label}</span>
              {on ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" /> : null}
            </Link>
          );
        })}
      </nav>
      {panel === "posts" ? (
        posts.length ? (
          <ul className="grid grid-cols-3 gap-px">
            {posts.map((post) => (
              <li key={post.id} className="min-w-0">
                <Link href={post.href} aria-label={post.cardName || tx(locale, "貼文", "Post")} className="relative block">
                  <img src={post.photos[0] || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className={tile} />
                  {post.photos.length > 1 ? <StackMark /> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty mx-3 sm:mx-0">{tx(locale, "未有貼文。", "No posts yet.")}</p>
        )
      ) : null}
      {panel === "box" ? (
        <>
          {isSelf ? <p className="px-3 pt-2 text-xs text-muted sm:px-0">{tx(locale, "預設公開。私人收藏只會喺呢度見到。", "Public by default. Private cards stay on this screen.")}</p> : null}
          {items.length === 0 ? <p className="empty mx-3 sm:mx-0">{tx(locale, "未有收藏。", "No cards yet.")}</p> : null}
          <ul className="grid grid-cols-3 gap-px">
            {items.map((item) => {
              const label = item.priceCents != null ? `${item.cardName} ${formatHkd(item.priceCents, locale)}` : item.cardName;
              return (
                <li key={item.id} className="min-w-0">
                  <div className="relative">
                    {item.href ? (
                      <Link href={item.href} aria-label={label} className="block">
                        <img src={item.photo || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className={tile} />
                      </Link>
                    ) : (
                      <img src={item.photo || "/demo/back.svg"} alt={label} loading="lazy" decoding="async" className={tile} />
                    )}
                    {item.visibility === "PRIVATE" ? (
                      <span className="pointer-events-none absolute left-1 top-1 bg-card/90 px-1 py-0.5 text-[10px] font-semibold leading-none text-ink">{tx(locale, "私人", "Private")}</span>
                    ) : null}
                  </div>
                  {isSelf ? (
                    <div className="flex h-7 items-center justify-between gap-1 px-1">
                      {item.catalogCardId && !item.listingId ? (
                        <Link href={`/sell?catalogCardId=${encodeURIComponent(item.catalogCardId)}`} className="min-w-0 truncate text-[10px] font-semibold leading-none text-link">
                          {tx(locale, "放賣", "List for sale")}
                        </Link>
                      ) : (
                        <span />
                      )}
                      <form action={toggleCollectionVisibility} className="ml-auto min-w-0">
                        <input type="hidden" name="id" value={item.id} />
                        <button className="max-w-full truncate text-[10px] font-semibold leading-none text-link">
                          {item.visibility === "PUBLIC" ? tx(locale, "改為私人", "Make private") : tx(locale, "改為公開", "Make public")}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {panel === "selling" ? (
        listings.length ? (
          <ul className="grid grid-cols-3 gap-px">
            {listings.map((listing) => {
              const amount = shopAsk(listing);
              const label = amount != null ? `${listing.title} ${formatHkd(amount, locale)}` : listing.title;
              return (
                <li key={listing.id} className="min-w-0">
                  <Link href={`/listing/${listing.id}`} aria-label={label} className="block">
                    <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className={tile} />
                  </Link>
                  {amount != null ? <p className="truncate px-1 py-1 text-[10px] font-semibold leading-none">{formatHkd(amount, locale)}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty mx-3 sm:mx-0">{tx(locale, "未有賣緊的卡。", "Nothing for sale.")}</p>
        )
      ) : null}
      {panel === "reviews" ? (
        reviews.length ? (
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
        )
      ) : null}
      {panel === "drafts" ? (
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
      ) : null}
    </div>
  );
}

function shopAsk(listing: Sale): number | null {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  if (auction) return listing.currentBid ?? listing.startPrice;
  return listing.price;
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
