import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openDirectThread, toggleFollow } from "@/actions/social";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { NameLine, type VerificationTierName } from "@/components/profile-header";
import { PromoPill } from "@/components/promo-pill";
import { PersonMenu } from "@/components/safety-menu";
import { Flash } from "@/components/shell";
import { prisma } from "@/lib/db";
import { displayPhoto } from "@/lib/demo-covers";
import { activeWhere, publicCardSelect } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx, type Locale } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { ratingFromAggregate } from "@/lib/ratings";
import { shopDisplayCents } from "@/lib/shop-inventory";
import { feedHideIds, isBlocked } from "@/lib/social";

type StoreListing = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionEndsAt: Date | null;
  auctionSettled: boolean;
  promoted: boolean;
  quantityAvailable: number;
  photos: { url: string }[];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const seller = await prisma.user.findUnique({ where: { id }, select: { nickname: true, storeName: true } });
  return { title: seller?.storeName?.trim() || seller?.nickname || "商店" };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, seller] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, nickname: true, storeName: true, avatarUrl: true, verificationTier: true },
    }),
    sweep(),
  ]);
  if (!seller) notFound();
  if (viewer && viewer.id !== seller.id && (await isBlocked(viewer.id, seller.id))) notFound();
  const hides = await feedHideIds(viewer?.id ?? null);
  const [following, ratingRow, listings] = await Promise.all([
    viewer && viewer.id !== seller.id
      ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: seller.id } } })
      : null,
    prisma.dealRating.aggregate({ where: { subjectId: seller.id }, _avg: { stars: true }, _count: true }),
    prisma.listing.findMany({
      where: {
        ...activeWhere([]),
        sellerId: seller.id,
        ...(hides.listingIds.length ? { id: { notIn: hides.listingIds } } : {}),
      },
      orderBy: { publishedAt: "desc" },
      // ponytail: 48 newest live rows. Promo row is the promoted ones in that set. Upgrade: keyset, plus a separate promo query if older promos must stay pinned.
      take: 48,
      select: { ...publicCardSelect, quantityAvailable: true },
    }),
  ]);
  const locale = prefs.locale;
  const shopName = seller.storeName?.trim() || seller.nickname;
  const rating = ratingFromAggregate(ratingRow._avg.stars, ratingRow._count);
  const promoted = listings.filter((row) => row.promoted);

  return (
    <div className="mx-auto max-w-3xl">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <StoreHeader
        locale={locale}
        name={shopName}
        avatarUrl={seller.avatarUrl}
        verificationTier={seller.verificationTier}
        rating={rating}
      />
      {viewer && viewer.id !== seller.id ? (
        <div className="mt-3 flex items-center gap-2">
          <form action={toggleFollow} className="min-w-0 flex-1">
            <input type="hidden" name="sellerId" value={seller.id} />
            <button className="btn btn-ghost w-full">{following ? tx(locale, "已關注", "Following") : tx(locale, "關注", "Follow")}</button>
          </form>
          <form action={openDirectThread}>
            <input type="hidden" name="userId" value={seller.id} />
            <button type="submit" className="btn btn-ghost w-11 shrink-0 px-0" aria-label={tx(locale, "訊息", "Message")}>
              <Icon name="messages" className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </form>
          <PersonMenu
            locale={locale}
            userId={seller.id}
            reportType="USER"
            reportId={seller.id}
            next={`/shop/${seller.id}`}
            away="/"
          />
        </div>
      ) : null}
      {promoted.length > 0 ? (
        <section className="mt-4" aria-labelledby="shop-promo">
          <h2 id="shop-promo" className="mb-2 text-sm font-semibold">{tx(locale, "本店推廣", "Promoted")}</h2>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {promoted.map((listing) => (
              <li key={listing.id} className="w-36 shrink-0">
                <StoreCard locale={locale} listing={listing} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {listings.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3">
          {listings.map((listing) => (
            <li key={listing.id} className="min-w-0">
              <StoreCard locale={locale} listing={listing} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">{tx(locale, "暫未有貨品。", "Nothing listed yet.")}</p>
      )}
    </div>
  );
}

function StoreHeader({
  locale,
  name,
  avatarUrl,
  verificationTier,
  rating,
}: {
  locale: Locale;
  name: string;
  avatarUrl: string | null;
  verificationTier: VerificationTierName;
  rating: { average: number; count: number } | null;
}) {
  const photo = avatarUrl?.trim();
  return (
    <header className="flex items-center gap-3">
      {photo ? (
        <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-xl font-semibold text-white">{name.slice(0, 1)}</span>
      )}
      <h1 className="min-w-0 text-[17px] font-semibold leading-snug">
        <NameLine name={name} tier={verificationTier} locale={locale} rating={rating} nameClassName="truncate" />
      </h1>
    </header>
  );
}

function StoreCard({ locale, listing }: { locale: Locale; listing: StoreListing }) {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  const amount = shopDisplayCents(listing) ?? 0;
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <Link href={`/listing/${listing.id}`} className="block">
        <img src={displayPhoto(listing.photos[0]?.url)} alt="" className="block aspect-[4/5] w-full bg-soft object-contain" />
      </Link>
      <span className="grid gap-1 px-2.5 py-2">
        <Link href={`/listing/${listing.id}`} className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</Link>
        <span className="flex flex-wrap items-center gap-1.5">
          <Link href={`/listing/${listing.id}`} className="price text-base leading-none">{formatHkd(amount, locale)}</Link>
          <PromoPill promoted={listing.promoted} />
        </span>
        {listing.quantityAvailable === 1 ? (
          <span className="text-[11px] font-medium leading-none text-muted">{tx(locale, "最後 1 件", "Last one")}</span>
        ) : null}
        {auction ? (
          <Link href="/auction" className="inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-link">
            <Icon name="auction" className="h-3 w-3" strokeWidth={2.5} />
            {tx(locale, "拍賣", "Auction")}
          </Link>
        ) : null}
        {auction && listing.auctionEndsAt ? (
          <span className="text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt.toISOString()} locale={locale} /></span>
        ) : null}
      </span>
    </article>
  );
}
