import Link from "next/link";
import { formatHkd } from "@/lib/format";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import type { ProfileThumb } from "@/lib/profile";
import { Icon } from "./icons";
import { PostMenu } from "./post-menu";

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
  { id: "posts", zh: "My Binder", en: "My Binder", icon: "binder" },
  { id: "saved", zh: "收藏", en: "Favorites", icon: "bookmark" },
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
  savedListings,
  savedPosts,
  listings,
  reviews,
  drafts,
  viewerId,
}: {
  locale: Locale;
  base: string;
  tab: string;
  isSelf: boolean;
  posts: PostCardModel[];
  savedListings: ProfileThumb[];
  savedPosts: ProfileThumb[];
  listings: Sale[];
  reviews: Review[];
  drafts: Draft[];
  favIds: string[];
  viewerId: string | null;
}) {
  // Legacy ?tab=box was the owned-card grid. It now opens My Binder (own posts).
  const panel = tab === "saved" || tab === "selling" || tab === "reviews" || (tab === "drafts" && isSelf) ? tab : "posts";
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
                <PostMenu
                  locale={locale}
                  postId={post.postId}
                  listingId={post.listingId}
                  own={viewerId != null && viewerId === post.author.id}
                  loggedIn={viewerId != null}
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
        ) : (
          <p className="empty mx-3 sm:mx-0">{tx(locale, "未有貼文。", "No posts yet.")}</p>
        )
      ) : null}
      {panel === "saved" ? (
        isSelf && (savedListings.length || savedPosts.length) ? (
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
          <p className="empty mx-3 sm:mx-0">{tx(locale, "未有收藏。", "No favorites yet.")}</p>
        )
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
