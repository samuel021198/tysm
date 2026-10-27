import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { followedSellerIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { tx } from "@/lib/i18n";
import { compKey, loadCompSeries, priorSalePrices } from "@/lib/comps";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const [categories, listings, compSeries, favRows, follows] = await Promise.all([
    prisma.category.findMany({
      where: { level: "LEAF" },
      orderBy: [{ parent: { sort: "asc" } }, { sort: "asc" }],
    }),
    prisma.listing.findMany({
      where: activeWhere(hidden),
      include: cardInclude,
      orderBy: [{ favoriteCount: "desc" }, { publishedAt: "desc" }],
      take: 24,
    }),
    loadCompSeries(),
    viewer ? prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } }) : Promise.resolve([]),
    followedSellerIds(viewer?.id ?? null),
  ]);
  const favIds = new Set(favRows.map((row) => row.listingId));
  const en = prefs.locale === "en";

  return (
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title mb-0">{tx(prefs.locale, "賣場", "Market")}</h1>
        <Link href="/search" className="text-sm font-semibold text-link">{tx(prefs.locale, "篩選", "Filters")}</Link>
      </div>
      <nav aria-label={tx(prefs.locale, "分類", "Categories")} className="chips mt-3 !flex-nowrap !overflow-x-auto">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/search?cat=${cat.slug}`}
            className="inline-flex h-8 items-center rounded-full border border-line bg-card px-2.5 text-xs font-medium"
          >
            {en ? cat.nameEn : cat.nameZh}
          </Link>
        ))}
      </nav>
      <section className="mt-5" aria-labelledby="market-latest">
        <h2 id="market-latest" className="mb-2 text-base font-semibold">
          {tx(prefs.locale, "熱門／最新", "Popular / latest")}
        </h2>
        {listings.length === 0 ? <p className="empty">{tx(prefs.locale, "暫時未有刊登。", "No listings yet.")}</p> : null}
        <div className="feed">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              locale={prefs.locale}
              favorited={favIds.has(listing.id)}
              followed={follows.has(listing.sellerId)}
              next="/market"
              series={priorSalePrices(compSeries.get(compKey(listing)), listing.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
