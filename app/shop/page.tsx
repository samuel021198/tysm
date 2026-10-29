import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { shopTab, type ShopTab } from "@/lib/auction";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { feedHideIds, hiddenUserIds } from "@/lib/social";

export const metadata = { title: "商店" };

const CHIPS: { id: ShopTab; href: string; zh: string; en: string }[] = [
  { id: "all", href: "/shop", zh: "全部", en: "All" },
  { id: "new", href: "/shop?tab=new", zh: "新上架", en: "New" },
  { id: "auction", href: "/shop?tab=auction", zh: "拍賣", en: "Auctions" },
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
  const listings = showListings
    ? await prisma.listing.findMany({
        where: {
          ...activeWhere(hidden),
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
  const stores = tab === "shops"
    ? await prisma.user.findMany({
        where: { storeName: { not: null }, ...(hidden.length ? { id: { notIn: hidden } } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: {
          id: true,
          nickname: true,
          storeName: true,
          storeDistrict: true,
          avatarUrl: true,
          listings: {
            where: activeWhere([]),
            orderBy: { publishedAt: "desc" },
            take: 1,
            select: { photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
          },
        },
      })
    : [];

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
      </nav>
      {tab === "shops" ? (
        stores.length === 0 ? (
          <Empty locale={locale} text={["暫時未有商店。", "No shops yet."]} />
        ) : (
          <div className="feed">
            {stores.map((store) => {
              const name = store.storeName || store.nickname;
              const cover = store.listings[0]?.photos[0]?.url || store.avatarUrl;
              return (
                <Link key={store.id} href={`/shop/${store.id}`} className="surface flex h-full flex-col overflow-hidden">
                  {cover ? (
                    <img src={cover} alt="" className="block aspect-[4/5] w-full bg-soft object-cover" />
                  ) : (
                    <span className="grid aspect-[4/5] w-full place-items-center bg-accent text-3xl font-semibold text-white">{name.slice(0, 1)}</span>
                  )}
                  <span className="grid gap-0.5 px-2.5 py-2">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    {store.storeDistrict ? <span className="truncate text-xs text-muted">{store.storeDistrict}</span> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        )
      ) : listings.length === 0 ? (
        <Empty locale={locale} text={tab === "auction" ? ["暫時未有拍賣。", "No auctions yet."] : ["暫時未有貨品。", "Nothing listed yet."]} />
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
    <Link href={`/listing/${listing.id}`} className="surface flex h-full flex-col overflow-hidden">
      <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />
      <span className="grid gap-1 px-2.5 py-2">
        <span className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</span>
        <span className="price text-base leading-none">{formatHkd(amount, locale)}</span>
        {auction ? <span className="w-fit rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold">{tx(locale, "拍賣", "Auction")}</span> : null}
        <span className="truncate text-xs text-muted">{store}</span>
      </span>
    </Link>
  );
}

function Empty({ locale, text }: { locale: Locale; text: [string, string] }) {
  return <p className="py-10 text-center text-sm text-muted">{tx(locale, text[0], text[1])}</p>;
}
