import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { tx } from "@/lib/i18n";
import { clearSearch } from "@/actions/auth";

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
    ...(q
      ? {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { cardName: { contains: q, mode: "insensitive" as const } },
                { personName: { contains: q, mode: "insensitive" as const } },
                { setName: { contains: q, mode: "insensitive" as const } },
                { game: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : {}),
    ...(chosen?.level === "LEAF" ? { categoryId: chosen.id } : {}),
    ...(chosen?.level === "GROUP" ? { categoryId: { in: chosen.children.map((child) => child.id) } } : {}),
    ...(cond === "raw" ? { conditionTrack: "RAW" as const } : {}),
    ...(cond && cond !== "raw" ? { conditionTrack: "GRADED" as const, grader: cond as "PSA" | "BGS" | "CGC" | "TAG" } : {}),
    ...(min ? { gradeValue: { gte: Math.round(Number(min) * 10) } } : {}),
  };
  // ponytail: relevance and price sorts rank at most 200 rows in memory. Upgrade path: Postgres tsvector and a stored sort price.
  const listings = await prisma.listing.findMany({
    where,
    include: cardInclude,
    orderBy: sort === "ending" ? { auctionEndsAt: "asc" } : { publishedAt: "desc" },
    take: 200,
  });
  if (sort === "price_asc" || sort === "price_desc") {
    const priceOf = (listing: (typeof listings)[number]) => listing.price ?? listing.currentBid ?? listing.startPrice ?? 0;
    listings.sort((a, b) => (sort === "price_asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)));
  } else if (sort === "relevance" && q) {
    const needle = q.toLowerCase();
    const score = (listing: (typeof listings)[number]) => {
      let value = 0;
      if (listing.title.toLowerCase().includes(needle)) value += 5;
      if ((listing.cardName || "").toLowerCase().includes(needle)) value += 3;
      if ((listing.personName || "").toLowerCase().includes(needle)) value += 3;
      return value;
    };
    listings.sort((a, b) => score(b) - score(a));
  }
  const shown = listings.slice(0, 48);
  if (viewer && q) {
    await prisma.searchHistory.create({ data: { userId: viewer.id, query: q.slice(0, 80) } });
  }
  const history = viewer
    ? await prisma.searchHistory.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 12 })
    : [];
  const favIds = new Set(
    viewer
      ? (await prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } })).map((row) => row.listingId)
      : [],
  );

  return (
    <div>
      <Flash locale={prefs.locale} ok={one(sp.ok)} err={one(sp.err)} />
      <h1 className="mb-4 text-[1.65rem] font-bold">{tx(prefs.locale, "搜尋", "Search")}</h1>
      <form className="surface mb-4 grid grid-cols-2 gap-2.5 p-3 md:grid-cols-5 md:p-4">
        <input className="field col-span-2" name="q" defaultValue={q} placeholder={tx(prefs.locale, "關鍵字", "Keyword")} />
        <select className="field" name="cat" defaultValue={cat}>
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
        <button className="btn btn-primary col-span-2 md:col-span-1">{tx(prefs.locale, "搜尋", "Search")}</button>
      </form>
      {history.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{tx(prefs.locale, "最近搜尋", "Recent searches")}</span>
          {history.map((row) => (
            <span key={row.id} className="inline-flex h-11 items-center gap-1 rounded-full bg-soft pl-3 pr-1 text-sm">
              <a href={`/search?q=${encodeURIComponent(row.query)}`}>{row.query}</a>
              <form action={clearSearch}>
                <input type="hidden" name="id" value={row.id} />
                <button className="grid h-9 w-9 place-items-center rounded-full" aria-label={tx(prefs.locale, "清除", "Clear")}>×</button>
              </form>
            </span>
          ))}
          <form action={clearSearch}>
            <input type="hidden" name="id" value="all" />
            <button className="underline">{tx(prefs.locale, "全部清除", "Clear all")}</button>
          </form>
        </div>
      ) : null}
      {shown.length === 0 ? <p>{tx(prefs.locale, "找不到相關卡牌。", "No matching cards.")}</p> : null}
      <div className="feed">
        {shown.map((listing) => (
          <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={false} next="/search" />
        ))}
      </div>
    </div>
  );
}
