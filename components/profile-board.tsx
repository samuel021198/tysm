import Link from "next/link";
import { toggleCollectionVisibility } from "@/actions/collect";
import { formatHkd } from "@/lib/format";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import type { PostCardModel } from "@/lib/posts";
import { ListingCard } from "./listing-card";
import { PostCard } from "./post-card";

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
  ["posts", "貼文", "Posts"],
  ["box", "公開收藏格", "Public collection"],
  ["selling", "賣緊", "Selling"],
  ["reviews", "評價", "Reviews"],
] as const;

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
  favIds,
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
  const fav = new Set(favIds);
  const panel = tab === "box" || tab === "selling" || tab === "reviews" || (tab === "drafts" && isSelf) ? tab : "posts";
  return (
    <div className="grid gap-3">
      <div className="chips">
        {TABS.map(([id, zh, en]) => (
          <Link key={id} href={`${base}?tab=${id}`} className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold leading-none ${panel === id ? "bg-accent text-white" : "border border-line bg-card text-muted"}`} aria-current={panel === id ? "page" : undefined}>
            {tx(locale, zh, en)}
          </Link>
        ))}
      </div>
      {panel === "posts" ? (
        posts.length ? (
          <div className="mx-auto grid w-full max-w-lg gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} next={`${base}?tab=posts`} />
            ))}
          </div>
        ) : (
          <p className="empty">{tx(locale, "未有貼文。", "No posts yet.")}</p>
        )
      ) : null}
      {panel === "box" ? (
        <>
          {isSelf ? <p className="text-xs text-muted">{tx(locale, "預設公開。私人收藏只會喺呢度見到。", "Public by default. Private cards stay on this screen.")}</p> : null}
          {items.length === 0 ? <p className="empty">{tx(locale, "未有收藏。", "No cards yet.")}</p> : null}
          <ul className="feed">
            {items.map((item) => (
              <li key={item.id} className="surface overflow-hidden">
                {item.href ? (
                  <Link href={item.href} className="block">
                    <Thumb item={item} />
                  </Link>
                ) : (
                  <Thumb item={item} />
                )}
                <div className="grid gap-0.5 px-2.5 py-2">
                  <p className="text-sm font-semibold">{item.cardName}</p>
                  <p className="text-xs text-muted">{item.condition}{item.visibility === "PRIVATE" ? ` · ${tx(locale, "私人", "Private")}` : ""}</p>
                  {item.priceCents != null ? <p className="price text-base leading-none">{formatHkd(item.priceCents, locale)}</p> : null}
                  {isSelf && item.catalogCardId && !item.listingId ? (
                    <Link href={`/sell?catalogCardId=${encodeURIComponent(item.catalogCardId)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-link">
                      {tx(locale, "放賣", "List for sale")}
                    </Link>
                  ) : null}
                  {isSelf ? (
                    <form action={toggleCollectionVisibility}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="text-sm text-link">{item.visibility === "PUBLIC" ? tx(locale, "改為私人", "Make private") : tx(locale, "改為公開", "Make public")}</button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {panel === "selling" ? (
        listings.length ? (
          <div className="feed">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} favorited={fav.has(listing.id)} followed={false} next={`${base}?tab=selling`} />
            ))}
          </div>
        ) : (
          <p className="empty">{tx(locale, "未有賣緊的卡。", "Nothing for sale.")}</p>
        )
      ) : null}
      {panel === "reviews" ? (
        reviews.length ? (
          <ul className="grid gap-3 text-sm">
            {reviews.map((review) => (
              <li key={review.id} className="surface px-4 py-3">
                <p>{review.nickname} · {"★".repeat(review.stars)}</p>
                <p>{review.comment}</p>
                {review.reply ? <p className="text-muted">{tx(locale, "回覆", "Reply")}: {review.reply}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{tx(locale, "未有評價。", "No reviews.")}</p>
        )
      ) : null}
      {panel === "drafts" ? (
        drafts.length ? (
          <ul className="grid gap-2">
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
          <p className="empty">{tx(locale, "未有草稿。", "No drafts.")}</p>
        )
      ) : null}
    </div>
  );
}

function Thumb({ item }: { item: Item }) {
  return <img src={item.photo || "/demo/back.svg"} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />;
}
