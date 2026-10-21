import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { SearchBox } from "@/components/search-box";
import { tx } from "@/lib/i18n";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, follows, categories] = await Promise.all([
    hiddenUserIds(viewer?.id ?? null),
    viewer ? prisma.follow.findMany({ where: { followerId: viewer.id }, select: { sellerId: true } }) : Promise.resolve([]),
    prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } }),
  ]);
  const followed = new Set(follows.map((row) => row.sellerId));
  const listings = await prisma.listing.findMany({
    where: activeWhere(hidden),
    include: cardInclude,
    orderBy: { publishedAt: "desc" },
    take: 48,
  });
  listings.sort((a, b) => {
    const boost = Number(followed.has(b.sellerId)) - Number(followed.has(a.sellerId));
    if (boost !== 0) return boost;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });
  const favIds = new Set(
    viewer
      ? (await prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } })).map((row) => row.listingId)
      : [],
  );
  const recent = viewer
    ? await prisma.viewHistory.findMany({
        where: { userId: viewer.id, listing: activeWhere(hidden) },
        include: { listing: { include: cardInclude } },
        orderBy: { viewedAt: "desc" },
        take: 8,
      })
    : [];
  const recentIds = recent.map((row) => row.listingId);
  const categoryIds = [...new Set(recent.map((row) => row.listing.categoryId))];
  const forYou =
    viewer && categoryIds.length
      ? await prisma.listing.findMany({
          where: { ...activeWhere(hidden), categoryId: { in: categoryIds }, id: { notIn: recentIds } },
          include: cardInclude,
          take: 8,
        })
      : [];

  return (
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div className="mb-3 md:hidden">
        <SearchBox locale={prefs.locale} />
      </div>
      <h1 className="page-title">{tx(prefs.locale, "卡牌動態", "Card feed")}</h1>
      <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/search?cat=${cat.slug}`} className="inline-flex h-11 shrink-0 items-center rounded-full bg-card px-4 text-sm font-semibold shadow-card ring-1 ring-inset ring-rose/25">
            {prefs.locale === "en" ? cat.nameEn : cat.nameZh}
          </Link>
        ))}
      </div>
      {listings.length === 0 ? <p className="empty">{tx(prefs.locale, "暫時未有刊登。", "No listings yet.")}</p> : null}
      <div className="feed">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            locale={prefs.locale}
            favorited={favIds.has(listing.id)}
            followed={followed.has(listing.sellerId)}
          />
        ))}
      </div>
      {recent.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{tx(prefs.locale, "最近睇過", "Recently viewed")}</h2>
          <div className="feed">
            {recent.map((row) => (
              <ListingCard key={row.listing.id} listing={row.listing} locale={prefs.locale} favorited={favIds.has(row.listing.id)} followed={followed.has(row.listing.sellerId)} />
            ))}
          </div>
        </section>
      ) : null}
      {forYou.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{tx(prefs.locale, "為你推薦", "For you")}</h2>
          <div className="feed">
            {forYou.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={followed.has(listing.sellerId)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
