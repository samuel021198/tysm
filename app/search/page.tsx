import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { tx } from "@/lib/i18n";
import { SaveSearchButton, SearchBox } from "@/components/search-box";
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
  const shown = listings.slice(0, 48);
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
      <h1 className="page-title">{tx(prefs.locale, "搜尋", "Search")}</h1>
      <SearchBox
        locale={prefs.locale}
        initial={q}
        autoFocus={!q}
        rememberVisit
        pullAccount={false}
        accountRecent={accountRecent}
        scope={chosen ? { slug: chosen.slug, nameZh: chosen.nameZh, nameEn: chosen.nameEn } : null}
      />
      <form action="/search" className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <select className="field col-span-2 md:col-span-1" name="cat" defaultValue={cat}>
          <option value="">{tx(prefs.locale, "全部分類", "All categories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {prefs.locale === "en" ? category.nameEn : category.nameZh}
            </option>
          ))}
        </select>
        <select className="field" name="cond" defaultValue={cond}>
          <option value="">{tx(prefs.locale, "全部品相", "Any condition")}</option>
          <option value="raw">{tx(prefs.locale, "全部 Raw", "All raw")}</option>
          {["PSA", "BGS", "CGC", "TAG"].map((grader) => (
            <option key={grader}>{grader}</option>
          ))}
        </select>
        <input className="field" name="min" type="number" min={1} max={10.5} step={0.5} defaultValue={min} placeholder={tx(prefs.locale, "最低分數", "Min grade")} />
        <select className="field col-span-2 md:col-span-1" name="sort" defaultValue={sort}>
          <option value="relevance">{tx(prefs.locale, "相關", "Relevance")}</option>
          <option value="new">{tx(prefs.locale, "最新", "Newest")}</option>
          <option value="price_asc">{tx(prefs.locale, "價格由低至高", "Price ascending")}</option>
          <option value="price_desc">{tx(prefs.locale, "價格由高至低", "Price descending")}</option>
          <option value="ending">{tx(prefs.locale, "即將結束", "Ending soon")}</option>
        </select>
        <button className="btn btn-primary col-span-2 md:col-span-1">{tx(prefs.locale, "篩選", "Filter")}</button>
      </form>
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
          <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={false} next="/search" />
        ))}
      </div>
    </div>
  );
}
