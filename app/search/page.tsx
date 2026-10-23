import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { tx } from "@/lib/i18n";
import { SaveSearchButton, SearchBox } from "@/components/search-box";
import { SearchFilters } from "@/components/search-filters";
import { compKey, loadCompSeries } from "@/lib/comps";
import { hkdToCents } from "@/lib/format";
import { listingQueryWhere, searchScore } from "@/lib/search";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await sweep();
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const cat = one(sp.cat);
  const cond = one(sp.cond);
  const min = one(sp.min);
  const sort = one(sp.sort) || "relevance";
  const pmin = one(sp.pmin);
  const pmax = one(sp.pmax);
  const sale = one(sp.sale);
  const setName = one(sp.set).trim();
  const number = one(sp.num).trim();
  const priceMin = pmin ? hkdToCents(pmin) : null;
  const priceMax = pmax ? hkdToCents(pmax) : null;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const categories = await prisma.category.findMany({ where: { level: { in: ["GROUP", "LEAF"] } }, orderBy: { sort: "asc" } });
  const chosen = cat ? await prisma.category.findUnique({ where: { slug: cat }, include: { children: true } }) : null;
  const where = {
    ...activeWhere(hidden),
    ...(q ? { AND: [listingQueryWhere(q)] } : {}),
    ...(chosen?.level === "LEAF" ? { categoryId: chosen.id } : {}),
    ...(chosen?.level === "GROUP" ? { categoryId: { in: chosen.children.map((child) => child.id) } } : {}),
    ...(cond === "raw" ? { conditionTrack: "RAW" as const } : {}),
    ...(cond && cond !== "raw" ? { conditionTrack: "GRADED" as const, grader: cond as "PSA" | "BGS" | "CGC" | "TAG" } : {}),
    ...(min ? { gradeValue: { gte: Math.round(Number(min) * 10) } } : {}),
    ...(sale === "BUY_NOW" || sale === "AUCTION" || sale === "BOTH" ? { saleType: sale as "BUY_NOW" | "AUCTION" | "BOTH" } : {}),
    ...(setName ? { setName: { contains: setName, mode: "insensitive" as const } } : {}),
    ...(number ? { cardNumber: { contains: number, mode: "insensitive" as const } } : {}),
  };
  // ponytail: relevance and price sorts rank at most 200 rows in memory. Upgrade path: Postgres tsvector and a stored sort price.
  const listings = await prisma.listing.findMany({
    where,
    include: { ...cardInclude, category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } } },
    orderBy: sort === "ending" ? { auctionEndsAt: "asc" } : { publishedAt: "desc" },
    take: 200,
  });
  if (sort === "price_asc" || sort === "price_desc") {
    const priceOf = (listing: (typeof listings)[number]) => listing.price ?? listing.currentBid ?? listing.startPrice ?? 0;
    listings.sort((a, b) => (sort === "price_asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)));
  } else if (sort === "relevance" && q) {
    listings.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  }
  const askOf = (listing: (typeof listings)[number]) =>
    listing.saleType === "AUCTION" ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? 0;
  const priced = listings.filter((listing) => {
    const ask = askOf(listing);
    if (priceMin != null && ask < priceMin) return false;
    if (priceMax != null && ask > priceMax) return false;
    return true;
  });
  const shown = priced.slice(0, 48);
  const compSeries = await loadCompSeries();
  if (viewer && q) {
    const query = q.slice(0, 80);
    await prisma.$transaction([
      prisma.searchHistory.deleteMany({ where: { userId: viewer.id, query } }),
      prisma.searchHistory.create({ data: { userId: viewer.id, query } }),
    ]);
  }
  const history = viewer
    ? await prisma.searchHistory.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 24 })
    : [];
  const accountRecent: string[] = [];
  const seenRecent = new Set<string>();
  for (const row of history) {
    if (seenRecent.has(row.query)) continue;
    seenRecent.add(row.query);
    accountRecent.push(row.query);
    if (accountRecent.length >= 12) break;
  }
  const favIds = new Set(
    viewer
      ? (await prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } })).map((row) => row.listingId)
      : [],
  );

  return (
    <div>
      <Flash locale={prefs.locale} ok={one(sp.ok)} err={one(sp.err)} />
      <h1 className="page-title">{tx(prefs.locale, "賣場", "Market")}</h1>
      <SearchBox
        locale={prefs.locale}
        initial={q}
        autoFocus={!q}
        rememberVisit
        pullAccount={false}
        accountRecent={accountRecent}
        scope={chosen ? { slug: chosen.slug, nameZh: chosen.nameZh, nameEn: chosen.nameEn } : null}
      />
      <SearchFilters
        locale={prefs.locale}
        q={q}
        cat={cat}
        cond={cond}
        min={min}
        sort={sort}
        pmin={pmin}
        pmax={pmax}
        sale={sale}
        setName={setName}
        number={number}
        categories={categories.map((category) => ({ slug: category.slug, nameZh: category.nameZh, nameEn: category.nameEn }))}
      />
      {q ? (
        <div className="mb-3 mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {shown.length} {tx(prefs.locale, "件", "results")}
          </p>
          <SaveSearchButton locale={prefs.locale} query={q} cat={chosen?.slug} catZh={chosen?.nameZh} catEn={chosen?.nameEn} />
        </div>
      ) : null}
      {shown.length === 0 ? <p className="empty">{tx(prefs.locale, "找不到相關卡牌。", "No matching cards.")}</p> : null}
      <div className="feed">
        {shown.map((listing) => (
          <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={false} next="/search" series={compSeries.get(compKey(listing))} />
        ))}
      </div>
    </div>
  );
}
