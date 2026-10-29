import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { feedHideIds, followedSellerIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { ListingCard } from "@/components/listing-card";
import { PostCard } from "@/components/post-card";
import { tx, type Locale } from "@/lib/i18n";
import { SaveSearchButton, SearchBox } from "@/components/search-box";
import { SearchFilters } from "@/components/search-filters";
import { compKey, loadCompSeries, priorSalePrices } from "@/lib/comps";
import { hkdToCents } from "@/lib/format";
import { listedPostWhere, listingQueryWhere, marketSearchHref, marketShow, searchScore, type MarketShow } from "@/lib/search";
import { sellingAsk, toPostCard } from "@/lib/posts";
import { shopDisplayCents } from "@/lib/shop-inventory";

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
  const show = marketShow(one(sp.show));
  const pmin = one(sp.pmin);
  const pmax = one(sp.pmax);
  const sale = one(sp.sale);
  const setName = one(sp.set).trim();
  const number = one(sp.num).trim();
  const priceMin = pmin ? hkdToCents(pmin) : null;
  const priceMax = pmax ? hkdToCents(pmax) : null;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const viewerId = viewer?.id ?? null;
  const [hidden, hides, categories, chosen] = await Promise.all([
    hiddenUserIds(viewerId),
    feedHideIds(viewerId),
    prisma.category.findMany({ where: { level: { in: ["GROUP", "LEAF"] } }, orderBy: { sort: "asc" } }),
    cat ? prisma.category.findUnique({ where: { slug: cat }, include: { children: true } }) : Promise.resolve(null),
  ]);
  const listingFilters = {
    ...activeWhere(hidden),
    ...(chosen?.level === "LEAF" ? { categoryId: chosen.id } : {}),
    ...(chosen?.level === "GROUP" ? { categoryId: { in: chosen.children.map((child) => child.id) } } : {}),
    ...(cond === "raw" ? { conditionTrack: "RAW" as const } : {}),
    ...(cond && cond !== "raw" ? { conditionTrack: "GRADED" as const, grader: cond as "PSA" | "BGS" | "CGC" | "TAG" } : {}),
    ...(min ? { gradeValue: { gte: Math.round(Number(min) * 10) } } : {}),
    ...(sale === "BUY_NOW" || sale === "AUCTION" || sale === "BOTH" ? { saleType: sale as "BUY_NOW" | "AUCTION" | "BOTH" } : {}),
    ...(setName ? { setName: { contains: setName, mode: "insensitive" as const } } : {}),
    ...(number ? { cardNumber: { contains: number, mode: "insensitive" as const } } : {}),
  };
  const where = {
    ...listingFilters,
    ...(q ? { AND: [listingQueryWhere(q)] } : {}),
  };
  const wantListings = show !== "post";
  const wantPosts = show !== "listing";
  // ponytail: relevance and price sorts rank at most 200 rows in memory. Upgrade path: Postgres tsvector and a stored sort price.
  const remembered = q.slice(0, 80);
  const [listings, postRows, compSeries, favRows, follows] = await Promise.all([
    wantListings
      ? prisma.listing.findMany({
          where,
          include: { ...cardInclude, category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } } },
          orderBy: sort === "ending" ? { auctionEndsAt: "asc" } : { publishedAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    wantPosts
      ? prisma.post.findMany({
          where: {
            AND: [
              listedPostWhere(listingFilters, q),
              ...(hidden.length ? [{ authorId: { notIn: hidden } }] : []),
              ...(hides.postIds.length ? [{ id: { notIn: hides.postIds } }] : []),
              {
                OR: [
                  { collectionItem: { visibility: "PUBLIC" } },
                  ...(viewerId ? [{ authorId: viewerId }] : []),
                ],
              },
            ],
          },
          include: {
            author: { select: { id: true, nickname: true, avatarUrl: true } },
            photos: { orderBy: { position: "asc" as const }, take: 1 },
            likes: {
              where: viewerId ? { userId: viewerId } : { userId: { in: [] as string[] } },
              select: { userId: true },
              take: 1,
            },
            saves: {
              where: viewerId ? { userId: viewerId } : { userId: { in: [] as string[] } },
              select: { userId: true },
              take: 1,
            },
            _count: { select: { comments: true, likes: true } },
            collectionItem: {
              select: {
                title: true,
                cardName: true,
                catalogCardId: true,
                conditionTrack: true,
                rawGrade: true,
                grader: true,
                gradeValue: true,
                photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
                listing: {
                  select: {
                    id: true,
                    title: true,
                    cardName: true,
                    personName: true,
                    game: true,
                    status: true,
                    quantityAvailable: true,
                    saleType: true,
                    price: true,
                    currentBid: true,
                    startPrice: true,
                    auctionEndsAt: true,
                    auctionSettled: true,
                    publishedAt: true,
                    catalogCardId: true,
                    updatedAt: true,
                    category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    loadCompSeries(),
    viewer ? prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } }) : Promise.resolve([]),
    followedSellerIds(viewerId),
    viewer && remembered
      ? prisma.$transaction([
          prisma.searchHistory.deleteMany({ where: { userId: viewer.id, query: remembered } }),
          prisma.searchHistory.create({ data: { userId: viewer.id, query: remembered } }),
        ])
      : Promise.resolve(null),
  ]);
  const askOf = (listing: (typeof listings)[number]) => shopDisplayCents(listing) ?? 0;
  if (sort === "price_asc" || sort === "price_desc") {
    listings.sort((a, b) => (sort === "price_asc" ? askOf(a) - askOf(b) : askOf(b) - askOf(a)));
  } else if (sort === "relevance" && q) {
    listings.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  }
  const inPrice = (ask: number) => (priceMin == null || ask >= priceMin) && (priceMax == null || ask <= priceMax);
  const priced = listings.filter((listing) => inPrice(askOf(listing)));
  const shown = priced.slice(0, 48);
  const postsInPrice = postRows.filter((row) => {
    const ask = sellingAsk(row.collectionItem?.listing);
    return ask != null && inPrice(ask);
  });
  if (sort === "price_asc" || sort === "price_desc") {
    const priceOf = (row: (typeof postsInPrice)[number]) => sellingAsk(row.collectionItem?.listing) ?? 0;
    postsInPrice.sort((a, b) => (sort === "price_asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)));
  } else if (sort === "relevance" && q) {
    postsInPrice.sort((a, b) => searchScore(b.collectionItem?.listing ?? { title: "" }, q) - searchScore(a.collectionItem?.listing ?? { title: "" }, q));
  } else if (sort === "ending") {
    const ends = (row: (typeof postsInPrice)[number]) => row.collectionItem?.listing?.auctionEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    postsInPrice.sort((a, b) => ends(a) - ends(b));
  } else {
    const stamp = (row: (typeof postsInPrice)[number]) => row.collectionItem?.listing?.publishedAt?.getTime() ?? row.createdAt.getTime();
    postsInPrice.sort((a, b) => stamp(b) - stamp(a));
  }
  const postCards = postsInPrice.slice(0, 48).map((row) =>
    toPostCard({
      postId: row.id,
      body: row.body,
      tags: row.tags,
      author: row.author,
      photos: row.photos,
      item: row.collectionItem,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      liked: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
      saved: viewerId ? row.saves.some((save) => save.userId === viewerId) : false,
      createdAt: row.createdAt,
    }),
  );
  const now = new Date().toISOString();
  const resultCount = shown.length + postCards.length;
  const split = show === "all" && shown.length > 0 && postCards.length > 0;
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
  const favIds = new Set(favRows.map((row) => row.listingId));

  return (
    <div>
      <Flash locale={prefs.locale} ok={one(sp.ok)} err={one(sp.err)} />
      <Link href="/find" className="inline-flex min-h-11 items-center text-sm font-semibold text-link">
        {tx(prefs.locale, "返回搜尋", "Back to search")}
      </Link>
      <h1 className="page-title">{tx(prefs.locale, "搜尋", "Search")}</h1>
      <SearchBox
        locale={prefs.locale}
        initial={q}
        rememberVisit
        pullAccount={false}
        accountRecent={accountRecent}
        to="search"
        show={show}
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
        show={show}
        categories={categories.map((category) => ({ slug: category.slug, nameZh: category.nameZh, nameEn: category.nameEn }))}
      >
        <ResultChips
          locale={prefs.locale}
          show={show}
          hrefFor={(next) => marketSearchHref({ q, cat, cond, min, sort, pmin, pmax, sale, set: setName, num: number }, next)}
        />
      </SearchFilters>
      {q ? (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {resultCount} {tx(prefs.locale, "件", "results")}
          </p>
          <SaveSearchButton locale={prefs.locale} query={q} cat={chosen?.slug} catZh={chosen?.nameZh} catEn={chosen?.nameEn} />
        </div>
      ) : null}
      {resultCount === 0 ? <p className="empty">{emptyCopy(prefs.locale, show)}</p> : null}
      {shown.length ? (
        <section className={split ? "mb-5" : undefined} aria-label={tx(prefs.locale, "上架", "Listings")}>
          {split ? <h2 className="mb-1 text-xs font-medium text-muted">{tx(prefs.locale, "上架", "Listings")}</h2> : null}
          <div className="feed">
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={prefs.locale} favorited={favIds.has(listing.id)} followed={follows.has(listing.sellerId)} next="/search" series={priorSalePrices(compSeries.get(compKey(listing)), listing.id)} />
            ))}
          </div>
        </section>
      ) : null}
      {postCards.length ? (
        <section aria-label={tx(prefs.locale, "貼文", "Posts")}>
          {split ? <h2 className="mb-1 text-xs font-medium text-muted">{tx(prefs.locale, "貼文", "Posts")}</h2> : null}
          <div className="mx-auto grid w-full max-w-lg gap-3">
            {postCards.map((post) => (
              <PostCard key={post.id} post={post} locale={prefs.locale} now={now} next="/search" viewerId={viewerId} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function emptyCopy(locale: Locale, show: MarketShow) {
  if (show === "listing") return tx(locale, "未有符合的上架。", "No matching listings.");
  if (show === "post") return tx(locale, "未有符合的標價貼文。", "No matching priced posts.");
  return tx(locale, "賣場未有符合的上架或標價貼文。", "No matching listings or priced posts.");
}

function ResultChips({
  locale,
  show,
  hrefFor,
}: {
  locale: Locale;
  show: MarketShow;
  hrefFor: (show: MarketShow) => string;
}) {
  const items = [
    ["all", "全部", "All"],
    ["listing", "上架", "Listings"],
    ["post", "貼文", "Posts"],
  ] as const;
  return (
    <nav className="chips" aria-label={tx(locale, "結果類型", "Result type")}>
      {items.map(([id, zh, en]) => {
        const on = show === id;
        return (
          <Link
            key={id}
            href={hrefFor(id)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-11 items-center rounded-full px-3 text-sm leading-none ${on ? "bg-soft font-semibold text-ink" : "font-medium text-muted"}`}
          >
            {tx(locale, zh, en)}
          </Link>
        );
      })}
    </nav>
  );
}
