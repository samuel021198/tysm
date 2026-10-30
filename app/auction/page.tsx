import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";

export const metadata = { title: "拍賣" };

const CHIPS = [
  { id: "all", href: "/shop", zh: "全部", en: "All" },
  { id: "new", href: "/shop?tab=new", zh: "新上架", en: "New" },
  { id: "auction", href: "/auction", zh: "拍賣", en: "Auctions" },
  { id: "shops", href: "/shop?tab=shops", zh: "商店", en: "Shops" },
];

export default async function AuctionPage() {
  await sweep();
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, hides] = await Promise.all([hiddenUserIds(viewer?.id ?? null), feedHideIds(viewer?.id ?? null)]);
  const locale = prefs.locale;
  const now = new Date();
  const listings = await prisma.listing.findMany({
    where: {
      ...activeWhere(hidden),
      saleType: { in: ["AUCTION", "BOTH"] },
      auctionSettled: false,
      auctionEndsAt: { gt: now },
      ...(hides.listingIds.length ? { id: { notIn: hides.listingIds } } : {}),
    },
    orderBy: { auctionEndsAt: "asc" },
    take: 48,
    select: {
      id: true,
      title: true,
      startPrice: true,
      currentBid: true,
      auctionEndsAt: true,
      seller: { select: { nickname: true, storeName: true } },
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">{tx(locale, "拍賣專區", "Auctions")}</h1>
      <nav aria-label={tx(locale, "拍賣", "Auctions")} className="flex gap-2 overflow-x-auto py-3">
        {CHIPS.map((chip) => (
          <Link
            key={chip.id}
            href={chip.href}
            aria-current={chip.id === "auction" ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${chip.id === "auction" ? "bg-accent text-white" : "bg-soft text-ink"}`}
          >
            {tx(locale, chip.zh, chip.en)}
          </Link>
        ))}
        <Link href="/rank" className="inline-flex h-8 shrink-0 items-center rounded-full bg-soft px-3 text-sm font-semibold text-ink">
          {tx(locale, "排行", "Rank")}
        </Link>
      </nav>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{tx(locale, "任何帳戶都可以刊登拍賣。出價開放。", "Any account can list an auction. Bidding is open.")}</p>
        <Link href="/sell?sale=auction" className="btn btn-primary shrink-0">{tx(locale, "刊登拍賣", "List an auction")}</Link>
      </div>
      {listings.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-10">
          <p className="text-center text-sm text-muted">{tx(locale, "暫時未有拍賣。", "No auctions yet.")}</p>
          <Link href="/sell?sale=auction" className="btn btn-primary">{tx(locale, "刊登拍賣", "List an auction")}</Link>
        </div>
      ) : (
        <div className="feed">
          {listings.map((listing) => (
            <AuctionCard key={listing.id} locale={locale} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuctionCard({
  locale,
  listing,
}: {
  locale: Locale;
  listing: {
    id: string;
    title: string;
    startPrice: number | null;
    currentBid: number | null;
    auctionEndsAt: Date | null;
    seller: { nickname: string; storeName: string | null };
    photos: { url: string }[];
  };
}) {
  const amount = listing.currentBid ?? listing.startPrice ?? 0;
  const store = listing.seller.storeName?.trim() || listing.seller.nickname;
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <Link href={`/listing/${listing.id}`} className="block">
        <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />
      </Link>
      <span className="grid gap-1 px-2.5 py-2">
        <Link href={`/listing/${listing.id}`} className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</Link>
        <span className="flex items-center gap-1.5">
          <Link href={`/listing/${listing.id}`} className="price text-base leading-none">{formatHkd(amount, locale)}</Link>
          <Link href="/auction" className="inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-link">
            <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
            {tx(locale, "拍賣", "Auction")}
          </Link>
        </span>
        {listing.auctionEndsAt ? (
          <span className="text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt.toISOString()} locale={locale} /></span>
        ) : null}
        <Link href={`/listing/${listing.id}`} className="truncate text-xs text-muted">{store}</Link>
      </span>
    </article>
  );
}
