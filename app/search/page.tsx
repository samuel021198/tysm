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
import { SaveSearchButton } from "@/components/search-box";
import { SearchFilters } from "@/components/search-filters";
import { compKey, loadCompSeries } from "@/lib/comps";
import { hkdToCents } from "@/lib/format";
import { listingQueryWhere, searchScore, userQueryWhere } from "@/lib/search";

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
  const browsing = Boolean(cat || cond || min || pmin || pmax || sale || setName || number);
  const showListings = Boolean(q) || browsing;
  const [categories, users] = await Promise.all([
    browsing
      ? prisma.category.findMany({ where: { level: { in: ["GROUP", "LEAF"] } }, orderBy: { sort: "asc" } })
      : Promise.resolve([]),
    q
      ? prisma.user.findMany({
          where: { AND: [userQueryWhere(q), ...(hidden.length ? [{ id: { notIn: hidden } }] : [])] },
          select: { id: true, nickname: true, avatarUrl: true, bio: true },
          orderBy: { nickname: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);
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
  const listings = showListings ? await prisma.listing.findMany({
    where,
    include: { ...cardInclude, category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } } },
    orderBy: sort === "ending" ? { auctionEndsAt: "asc" } : { publishedAt: "desc" },
    take: 200,
  }) : [];
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
  const favIds = new Set(
    viewer
      ? (await prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } })).map((row) => row.listingId)
      : [],
  );

  return (
    <div>
      <Flash locale={prefs.locale} ok={one(sp.ok)} err={one(sp.err)} />
      <form action="/search" role="search" className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder={tx(prefs.locale, "用戶或放售", "Users or listings")}
          aria-label={tx(prefs.locale, "搜尋", "Search")}
          className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-3 text-base text-ink shadow-none outline-none placeholder:text-[var(--field-placeholder)] focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
        />
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
        {cond ? <input type="hidden" name="cond" value={cond} /> : null}
        {min ? <input type="hidden" name="min" value={min} /> : null}
        {sort && sort !== "relevance" ? <input type="hidden" name="sort" value={sort} /> : null}
        {pmin ? <input type="hidden" name="pmin" value={pmin} /> : null}
        {pmax ? <input type="hidden" name="pmax" value={pmax} /> : null}
        {sale ? <input type="hidden" name="sale" value={sale} /> : null}
        {setName ? <input type="hidden" name="set" value={setName} /> : null}
        {number ? <input type="hidden" name="num" value={number} /> : null}
      </form>
      {q && users.length === 0 && shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{tx(prefs.locale, "冇結果", "No results")}</p>
      ) : null}
      {q && (users.length > 0 || shown.length > 0) ? (
        <section className="mt-4" aria-label={tx(prefs.locale, "用戶", "Users")}>
          <h2 className="text-xs font-semibold text-muted">{tx(prefs.locale, "用戶", "Users")}</h2>
          {users.length === 0 ? <p className="py-2 text-sm text-muted">{tx(prefs.locale, "冇用戶", "No users")}</p> : null}
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                <Link href={`/shop/${user.id}`} className="flex min-h-11 items-center gap-2.5 py-1">
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.nickname.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">{user.nickname}</span>
                    {user.bio ? <span className="block truncate text-xs text-muted">{user.bio}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {browsing ? (
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
      ) : null}
      {showListings && !(q && users.length === 0 && shown.length === 0) ? (
        <section className="mt-4" aria-label={tx(prefs.locale, "放售", "Listings")}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold text-muted">{tx(prefs.locale, "放售", "Listings")}</h2>
            {q ? <SaveSearchButton locale={prefs.locale} query={q} cat={chosen?.slug} catZh={chosen?.nameZh} catEn={chosen?.nameEn} /> : null}
          </div>
          {shown.length === 0 ? <p className="py-2 text-sm text-muted">{tx(prefs.locale, "冇放售", "No listings")}</p> : null}
          <div className="feed">
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={false} next="/search" series={compSeries.get(compKey(listing))} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
