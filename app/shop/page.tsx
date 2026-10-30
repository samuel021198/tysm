import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { NEW_LISTING_MS, shopTab, type ShopTab } from "@/lib/auction";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
import { displayPhoto } from "@/lib/demo-covers";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { VerificationPill, type VerificationTierName } from "@/components/profile-header";

export const metadata = { title: "商店" };

const CHIPS: { id: ShopTab; href: string; zh: string; en: string }[] = [
  { id: "all", href: "/shop", zh: "全部", en: "All" },
  { id: "new", href: "/shop?tab=new", zh: "新上架", en: "New" },
  { id: "auction", href: "/auction", zh: "拍賣", en: "Auctions" },
  { id: "shops", href: "/shop?tab=shops", zh: "商店", en: "Shops" },
];

export default async function ShopMallPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await sweep();
  const sp = await searchParams;
  const tab = shopTab(sp.tab);
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, hides] = await Promise.all([hiddenUserIds(viewer?.id ?? null), feedHideIds(viewer?.id ?? null)]);
  const locale = prefs.locale;
  const showListings = tab !== "shops";
  const recentSince = new Date(Date.now() - NEW_LISTING_MS);
  const listings = showListings
    ? await prisma.listing.findMany({
        where: {
          ...activeWhere(hidden),
          ...(tab === "new" ? { publishedAt: { gte: recentSince } } : {}),
          ...(tab === "auction" ? { saleType: { in: ["AUCTION", "BOTH"] as const } } : {}),
          ...(hides.listingIds.length ? { id: { notIn: hides.listingIds } } : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: 24,
        select: {
          id: true,
          title: true,
          saleType: true,
          price: true,
          startPrice: true,
          currentBid: true,
          auctionEndsAt: true,
          auctionSettled: true,
          seller: { select: { id: true, nickname: true, storeName: true } },
          photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        },
      })
    : [];
  const storeRows = tab === "shops" ? await loadStores(hidden, recentSince) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">{tx(locale, "商店", "Shop")}</h1>
      <nav aria-label={tx(locale, "商店", "Shop")} className="flex gap-2 overflow-x-auto py-3">
        {CHIPS.map((chip) => (
          <Link
            key={chip.id}
            href={chip.href}
            aria-current={tab === chip.id ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${tab === chip.id ? "bg-accent text-white" : "bg-soft text-ink"}`}
          >
            {tx(locale, chip.zh, chip.en)}
          </Link>
        ))}
        <Link href="/rank" className="inline-flex h-8 shrink-0 items-center rounded-full bg-soft px-3 text-sm font-semibold text-ink">
          {tx(locale, "排行", "Rank")}
        </Link>
      </nav>
      {tab === "shops" ? (
        storeRows.length === 0 ? (
          <Empty locale={locale} text={["暫未有商店。", "No shops yet."]} />
        ) : (
          <ul className="grid gap-2">
            {storeRows.map((store) => (
              <li key={store.id}>
                <StoreRow locale={locale} store={store} />
              </li>
            ))}
          </ul>
        )
      ) : listings.length === 0 ? (
        <Empty locale={locale} text={tab === "auction" ? ["暫未有拍賣。", "No auctions yet."] : ["暫未有貨品。", "Nothing listed yet."]} />
      ) : (
        <div className="feed">
          {listings.map((listing) => (
            <MallCard key={listing.id} locale={locale} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function MallCard({
  locale,
  listing,
}: {
  locale: Locale;
  listing: {
    id: string;
    title: string;
    saleType: "BUY_NOW" | "AUCTION" | "BOTH";
    price: number | null;
    startPrice: number | null;
    currentBid: number | null;
    auctionEndsAt: Date | null;
    auctionSettled: boolean;
    seller: { nickname: string; storeName: string | null };
    photos: { url: string }[];
  };
}) {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  const amount = auction ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? listing.startPrice ?? 0;
  const store = listing.seller.storeName?.trim() || listing.seller.nickname;
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <Link href={`/listing/${listing.id}`} className="block">
        <img src={displayPhoto(listing.photos[0]?.url)} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />
      </Link>
      <span className="grid gap-1 px-2.5 py-2">
        <Link href={`/listing/${listing.id}`} className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</Link>
        <Link href={`/listing/${listing.id}`} className="price text-base leading-none">{formatHkd(amount, locale)}</Link>
        {auction ? (
          <Link href="/auction" className="inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-link">
            <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
            {tx(locale, "拍賣", "Auction")}
          </Link>
        ) : null}
        {auction && listing.auctionEndsAt ? (
          <span className="text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt.toISOString()} locale={locale} /></span>
        ) : null}
        <Link href={`/listing/${listing.id}`} className="truncate text-xs text-muted">{store}</Link>
      </span>
    </article>
  );
}

function StoreRow({
  locale,
  store,
}: {
  locale: Locale;
  store: {
    id: string;
    nickname: string;
    storeName: string | null;
    avatarUrl: string | null;
    verificationTier: VerificationTierName;
    listings: number;
    recent: number;
  };
}) {
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

async function loadStores(hidden: string[], recentSince: Date) {
  const rows = await prisma.user.findMany({
    where: { storeName: { not: null }, ...(hidden.length ? { id: { notIn: hidden } } : {}) },
    select: {
      id: true,
      nickname: true,
      storeName: true,
      avatarUrl: true,
      verificationTier: true,
      _count: { select: { listings: { where: activeWhere(hidden) } } },
    },
  });
  const ids = rows.map((row) => row.id);
  const fresh = ids.length
    ? await prisma.listing.groupBy({
        by: ["sellerId"],
        where: { ...activeWhere(hidden), sellerId: { in: ids }, publishedAt: { gte: recentSince } },
        _count: { _all: true },
      })
    : [];
  const recent = new Map(fresh.map((row) => [row.sellerId, row._count._all]));
  return rows
    .map((row) => ({
      id: row.id,
      nickname: row.nickname,
      storeName: row.storeName,
      avatarUrl: row.avatarUrl,
      verificationTier: row.verificationTier,
      listings: row._count.listings,
      recent: recent.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.listings - a.listings || a.nickname.localeCompare(b.nickname, "zh-HK"))
    // ponytail: 48 shops, counted in memory. Upgrade: SQL order by the active listing count.
    .slice(0, 48);
}

function Empty({ locale, text }: { locale: Locale; text: [string, string] }) {
  return (
    <div className="grid justify-items-center gap-2 py-6">
      <p className="text-center text-sm text-muted">{tx(locale, text[0], text[1])}</p>
      <Link href="/sell" className="btn btn-primary">{tx(locale, "刊登貨品", "List something")}</Link>
    </div>
  );
}
