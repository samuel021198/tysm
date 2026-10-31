import Link from "next/link";
import { toggleFavorite } from "@/actions/social";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { displayPhoto } from "@/lib/demo-covers";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { shopDisplayCents } from "@/lib/shop-inventory";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
import { Icon } from "./icons";

type RailKind = "recent" | "watch";

type RailListing = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionSettled: boolean;
  quantityAvailable: number;
  photos: { url: string }[];
  favored: boolean;
};

const railSelect = {
  id: true,
  title: true,
  saleType: true,
  price: true,
  startPrice: true,
  currentBid: true,
  auctionSettled: true,
  quantityAvailable: true,
  photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
} as const;

/** Mall rails and their see-all pages. ponytail: 12 on /shop, 48 on see-all. Upgrade: keyset on viewedAt / createdAt. */
export async function loadMallLane(
  viewerId: string | null,
  kind: RailKind,
  take: number,
  scope?: { hidden: string[]; listingIds: string[] },
): Promise<RailListing[]> {
  if (!viewerId) return [];
  const hidden = scope ? scope.hidden : await hiddenUserIds(viewerId);
  const listingIds = scope ? scope.listingIds : (await feedHideIds(viewerId)).listingIds;
  const listingWhere = {
    ...activeWhere(hidden),
    ...(listingIds.length ? { id: { notIn: listingIds } } : {}),
  };
  if (kind === "recent") {
    const rows = await prisma.viewHistory.findMany({
      where: { userId: viewerId, listing: listingWhere },
      orderBy: { viewedAt: "desc" },
      take,
      select: { listing: { select: railSelect } },
    });
    const listings = rows.map((row) => row.listing);
    const favs = listings.length
      ? await prisma.favorite.findMany({
          where: { userId: viewerId, listingId: { in: listings.map((row) => row.id) } },
          select: { listingId: true },
        })
      : [];
    const on = new Set(favs.map((row) => row.listingId));
    return listings.map((row) => ({ ...row, favored: on.has(row.id) }));
  }
  const rows = await prisma.favorite.findMany({
    where: { userId: viewerId, listing: listingWhere },
    orderBy: { createdAt: "desc" },
    take,
    select: { listing: { select: railSelect } },
  });
  return rows.map((row) => ({ ...row.listing, favored: true }));
}

export async function MallRails({
  locale,
  viewerId,
  hidden,
  hiddenListingIds,
}: {
  locale: Locale;
  viewerId: string | null;
  hidden: string[];
  hiddenListingIds: string[];
}) {
  const scope = { hidden, listingIds: hiddenListingIds };
  const [recent, watch] = viewerId
    ? await Promise.all([
        loadMallLane(viewerId, "recent", 12, scope),
        loadMallLane(viewerId, "watch", 12, scope),
      ])
    : [[], []];
  return (
    <div className="grid gap-4 pt-1">
      <RailSection
        locale={locale}
        viewerId={viewerId}
        title={["最近瀏覽", "Recently viewed"]}
        href="/shop/recent"
        next="/shop"
        rows={recent}
        empty={viewerId ? ["暫未有最近瀏覽。", "Nothing viewed yet."] : ["登入後即可查看。", "Log in to see this."]}
        layout="row"
      />
      <RailSection
        locale={locale}
        viewerId={viewerId}
        title={["追蹤", "Watching"]}
        href="/shop/watch"
        next="/shop"
        rows={watch}
        empty={viewerId ? ["暫未有追蹤。", "Nothing watched yet."] : ["登入後即可查看。", "Log in to see this."]}
        layout="row"
      />
    </div>
  );
}

export function RailSection({
  locale,
  viewerId,
  title,
  href,
  next,
  rows,
  empty,
  layout,
}: {
  locale: Locale;
  viewerId: string | null;
  title: [string, string];
  href?: string;
  next: string;
  rows: RailListing[];
  empty: [string, string];
  layout: "row" | "grid";
}) {
  const heading = tx(locale, title[0], title[1]);
  const headingId = href ? `rail-${href}` : "rail-lane";
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className={layout === "grid" ? "text-lg font-semibold" : "text-sm font-semibold"}>
          {heading}
        </h2>
        {href ? (
          <Link href={href} className="shrink-0 text-xs font-semibold text-link">
            {tx(locale, "查看全部", "See all")}
          </Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          {viewerId ? (
            tx(locale, empty[0], empty[1])
          ) : (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-link">
              {tx(locale, empty[0], empty[1])}
            </Link>
          )}
        </p>
      ) : layout === "row" ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" data-gesture="">
          {rows.map((listing) => (
            <li key={listing.id} className="w-40 shrink-0">
              <RailCard locale={locale} listing={listing} viewerId={viewerId} next={next} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-3">
          {rows.map((listing) => (
            <li key={listing.id} className="min-w-0">
              <RailCard locale={locale} listing={listing} viewerId={viewerId} next={next} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RailCard({
  locale,
  listing,
  viewerId,
  next,
}: {
  locale: Locale;
  listing: RailListing;
  viewerId: string | null;
  next: string;
}) {
  const amount = shopDisplayCents(listing) ?? 0;
  return (
    <article className="grid gap-1">
      <div className="relative">
        <Link href={`/listing/${listing.id}`} className="block">
          <img src={displayPhoto(listing.photos[0]?.url)} alt="" className="block aspect-[4/5] w-full rounded-xl bg-soft object-contain" />
        </Link>
        {listing.quantityAvailable === 1 ? (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ink">
            {tx(locale, "最後 1 件", "Last one")}
          </span>
        ) : null}
        {viewerId ? (
          <form action={toggleFavorite} className="absolute right-1.5 top-1.5">
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="next" value={next} />
            <button
              aria-label={tx(locale, "收藏", "Favorite")}
              title={tx(locale, "收藏", "Favorite")}
              aria-pressed={listing.favored}
              className={`grid h-7 w-7 place-items-center rounded-full bg-card/95 shadow-sm ${listing.favored ? "text-accent" : "text-muted"}`}
            >
              <Icon name="bookmark" className="h-4 w-4" strokeWidth={2.25} filled={listing.favored} />
            </button>
          </form>
        ) : null}
      </div>
      <Link href={`/listing/${listing.id}`} className="line-clamp-2 text-sm font-medium leading-snug">
        {listing.title}
      </Link>
      <Link href={`/listing/${listing.id}`} className="price text-sm leading-none">
        {formatHkd(amount, locale)}
      </Link>
    </article>
  );
}

export async function MallLanePage({
  kind,
  title,
  empty,
}: {
  kind: RailKind;
  title: [string, string];
  empty: [string, string];
}) {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const next = kind === "recent" ? "/shop/recent" : "/shop/watch";
  const rows = await loadMallLane(viewer?.id ?? null, kind, 48);
  const viewerId = viewer?.id ?? null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/shop" className="text-xs font-semibold text-link">
        {tx(prefs.locale, "返回商店", "Back to shop")}
      </Link>
      <div className="mt-3">
        <RailSection
          locale={prefs.locale}
          viewerId={viewerId}
          title={title}
          next={next}
          rows={rows}
          empty={viewerId ? empty : ["登入後即可查看。", "Log in to see this."]}
          layout="grid"
        />
      </div>
    </div>
  );
}
