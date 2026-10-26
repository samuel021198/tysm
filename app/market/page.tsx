import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { Icon } from "@/components/icons";
import { tx } from "@/lib/i18n";
import { compKey, loadCompSeries } from "@/lib/comps";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const [categories, listings, compSeries, favRows] = await Promise.all([
    prisma.category.findMany({
      where: { level: "LEAF" },
      orderBy: [{ parent: { sort: "asc" } }, { sort: "asc" }],
      include: { parent: { select: { nameZh: true, nameEn: true } } },
    }),
    prisma.listing.findMany({
      where: activeWhere(hidden),
      include: cardInclude,
      orderBy: [{ favoriteCount: "desc" }, { publishedAt: "desc" }],
      take: 24,
    }),
    loadCompSeries(),
    viewer ? prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } }) : Promise.resolve([]),
  ]);
  const favIds = new Set(favRows.map((row) => row.listingId));
  const en = prefs.locale === "en";

  return (
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <h1 className="page-title">{tx(prefs.locale, "賣場", "Market")}</h1>
      <Link
        href="/search"
        className="flex h-10 w-full items-center gap-2 rounded-full border border-line bg-card pl-3 pr-3.5 text-sm shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
      >
        <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
        <span className="truncate text-[var(--field-placeholder)]">{tx(prefs.locale, "搜尋任何物品", "Search for anything")}</span>
      </Link>
      <section className="mt-5" aria-labelledby="market-cats">
        <h2 id="market-cats" className="mb-2 text-sm font-semibold text-muted">
          {tx(prefs.locale, "分類", "Categories")}
        </h2>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {categories.map((cat) => {
            const group = en ? cat.parent?.nameEn : cat.parent?.nameZh;
            return (
              <li key={cat.id}>
                <Link href={`/search?cat=${cat.slug}`} className="surface flex min-h-14 flex-col justify-center px-3 py-2 active:scale-[0.99]">
                  {group ? <span className="text-[11px] font-medium text-muted">{group}</span> : null}
                  <span className="text-sm font-semibold">{en ? cat.nameEn : cat.nameZh}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
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
              followed={false}
              next="/market"
              series={compSeries.get(compKey(listing))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
