import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { displayPhoto } from "@/lib/demo-covers";
import { cardDisplayName } from "@/lib/posts";
import { shopDisplayCents } from "@/lib/shop-inventory";
import { cardHubListingWhere, cardHubPostWhere, findHref, marketShow, searchScore, userQueryWhere, type MarketShow } from "@/lib/search";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { FindExplore } from "@/components/find-explore";
import { Flash } from "@/components/shell";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const card = one(sp.card).trim().slice(0, 80);
  const show = marketShow(one(sp.show));
  const drafting = one(sp.draft) === "1";
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, hides, categories] = await Promise.all([
    hiddenUserIds(viewer?.id ?? null),
    feedHideIds(viewer?.id ?? null),
    prisma.category.findMany({
      where: { level: { in: ["GROUP", "LEAF"] } },
      orderBy: { sort: "asc" },
      select: { slug: true, nameZh: true, nameEn: true },
    }),
  ]);
  const viewerId = viewer?.id ?? null;
  const locale = prefs.locale;

  let users: { id: string; nickname: string; avatarUrl: string | null }[] = [];
  let posts: { id: string; name: string; author: string; photo: string | null }[] = [];
  let listings: { id: string; name: string; photo: string | null; price: number | null; auction: boolean }[] = [];
  let people: { id: string; nickname: string; avatarUrl: string | null }[] = [];

  if (q && !drafting) await sweep();
  if (q) {
    const wantListings = show !== "post";
    const wantPosts = show !== "listing";
    const listingWhere = { AND: [activeWhere(hidden), cardHubListingWhere(q, card), ...(hides.listingIds.length ? [{ id: { notIn: hides.listingIds } }] : [])] };
    const postText = cardHubPostWhere(q, card);
    const [userRows, postRows, listingRows, favRows, saveRows] = await Promise.all([
      wantPosts
        ? prisma.user.findMany({
            where: { AND: [userQueryWhere(q), ...(hidden.length ? [{ id: { notIn: hidden } }] : [])] },
            select: { id: true, nickname: true, avatarUrl: true },
            orderBy: { nickname: "asc" },
            take: 8,
          })
        : Promise.resolve([]),
      wantPosts
        ? prisma.post.findMany({
            where: {
              AND: [
                postText,
                ...(hidden.length ? [{ authorId: { notIn: hidden } }] : []),
                ...(hides.postIds.length ? [{ id: { notIn: hides.postIds } }] : []),
                {
                  OR: [
                    { collectionItemId: null },
                    { collectionItem: { visibility: "PUBLIC" } },
                    ...(viewerId ? [{ authorId: viewerId }] : []),
                  ],
                },
              ],
            },
            select: {
              id: true,
              body: true,
              author: { select: { nickname: true } },
              photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              collectionItem: {
                select: {
                  title: true,
                  cardName: true,
                  photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                  listing: { select: { title: true, cardName: true, personName: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      wantListings
        ? prisma.listing.findMany({
            where: listingWhere,
            select: {
              id: true,
              title: true,
              cardName: true,
              personName: true,
              game: true,
              price: true,
              currentBid: true,
              startPrice: true,
              saleType: true,
              auctionSettled: true,
              photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } },
            },
            take: 40,
          })
        : Promise.resolve([]),
      wantPosts
        ? prisma.favorite.findMany({
            where: { listing: listingWhere, ...(hidden.length ? { userId: { notIn: hidden } } : {}) },
            select: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
            take: 16,
          })
        : Promise.resolve([]),
      wantPosts
        ? prisma.postSave.findMany({
            where: {
              post: {
                AND: [
                  postText,
                  { OR: [{ collectionItemId: null }, { collectionItem: { visibility: "PUBLIC" } }] },
                ],
              },
              ...(hidden.length ? { userId: { notIn: hidden } } : {}),
            },
            select: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
            take: 16,
          })
        : Promise.resolve([]),
    ]);
    users = userRows;
    posts = postRows.map((post) => ({
      id: post.id,
      name: cardDisplayName({
        cardName: post.collectionItem?.listing?.cardName || post.collectionItem?.cardName,
        personName: post.collectionItem?.listing?.personName,
        title: post.collectionItem?.listing?.title || post.collectionItem?.title,
        body: post.body,
      }),
      author: post.author.nickname,
      photo: post.collectionItem?.photos[0]?.url || post.photos[0]?.url || null,
    }));
    listingRows.sort((a, b) => searchScore(b, q) - searchScore(a, q));
    listings = listingRows.slice(0, 8).map((listing) => ({
      id: listing.id,
      name: cardDisplayName({ cardName: listing.cardName, personName: listing.personName, title: listing.title }),
      photo: listing.photos[0]?.url || null,
      price: shopDisplayCents(listing),
      auction: listing.saleType !== "BUY_NOW" && !listing.auctionSettled,
    }));
    const seen = new Set<string>();
    people = [];
    for (const row of [...favRows, ...saveRows]) {
      if (seen.has(row.user.id)) continue;
      seen.add(row.user.id);
      people.push(row.user);
      if (people.length >= 8) break;
    }
  }

  if (viewer && q && !drafting) {
    await prisma.$transaction([
      prisma.searchHistory.deleteMany({ where: { userId: viewer.id, query: q } }),
      prisma.searchHistory.create({ data: { userId: viewer.id, query: q } }),
    ]);
  }
  // ponytail: two 30-row reads merged in memory. Upgrade path: one ranked union if the grid grows past a few screens.
  const [history, postCovers, listingCovers] = await Promise.all([
    viewer ? prisma.searchHistory.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 24 }) : Promise.resolve([]),
    q
      ? Promise.resolve([])
      : prisma.post.findMany({
          where: {
            AND: [
              ...(hidden.length ? [{ authorId: { notIn: hidden } }] : []),
              ...(hides.postIds.length ? [{ id: { notIn: hides.postIds } }] : []),
              {
                OR: [
                  { collectionItemId: null },
                  { collectionItem: { visibility: "PUBLIC" } },
                  ...(viewerId ? [{ authorId: viewerId }] : []),
                ],
              },
            ],
          },
          select: {
            id: true,
            body: true,
            createdAt: true,
            photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
            collectionItem: {
              select: {
                title: true,
                cardName: true,
                photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
    q
      ? Promise.resolve([])
      : prisma.listing.findMany({
          where: {
            AND: [
              activeWhere(hidden),
              { OR: [{ price: { gt: 0 } }, { currentBid: { gt: 0 } }, { startPrice: { gt: 0 } }] },
              ...(hides.listingIds.length ? [{ id: { notIn: hides.listingIds } }] : []),
            ],
          },
          select: {
            id: true,
            title: true,
            cardName: true,
            createdAt: true,
            publishedAt: true,
            photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
          },
          orderBy: { publishedAt: "desc" },
          take: 30,
        }),
  ]);
  const accountRecent: string[] = [];
  const seenRecent = new Set<string>();
  for (const row of history) {
    if (seenRecent.has(row.query)) continue;
    seenRecent.add(row.query);
    accountRecent.push(row.query);
    if (accountRecent.length >= 12) break;
  }
  const tiles = [
    ...postCovers.map((post) => ({
      key: `post:${post.id}`,
      href: `/post/${post.id}`,
      image: displayPhoto(post.collectionItem?.photos[0]?.url || post.photos[0]?.url),
      label: (post.collectionItem?.cardName || post.collectionItem?.title || post.body || "貼文").trim().slice(0, 80) || "貼文",
      at: post.createdAt.getTime(),
    })),
    ...listingCovers.map((listing) => ({
      key: `listing:${listing.id}`,
      href: `/listing/${listing.id}`,
      image: displayPhoto(listing.photos[0]?.url),
      label: (listing.cardName || listing.title).trim().slice(0, 80),
      at: (listing.publishedAt ?? listing.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 36)
    .map((tile) => ({ key: tile.key, href: tile.href, image: tile.image, label: tile.label }));

  const empty = q && users.length === 0 && posts.length === 0 && listings.length === 0 && people.length === 0;

  return (
    <div className="mx-auto max-w-lg">
      <Flash locale={locale} ok={one(sp.ok)} err={one(sp.err)} />
      <FindExplore locale={locale} initial={q} show={show} accountRecent={accountRecent} categories={categories} tiles={tiles}>
        {q ? (
          <>
            <HubChips locale={locale} show={show} q={q} card={card} />
            {empty ? <p className="text-sm text-muted">{emptyCopy(locale, show)}</p> : null}
            {users.length ? (
              <section>
                <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "用戶", "Users")}</h2>
                <ul>
                  {users.map((user) => (
                    <li key={user.id}>
                      <PersonLink user={user} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {listings.length ? (
              <section aria-label={tx(locale, "上架", "Listings")}>
                <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "上架", "Listings")}</h2>
                <ul>
                  {listings.map((listing) => (
                    <li key={listing.id}>
                      <Link href={`/listing/${listing.id}`} className="flex h-12 items-center gap-2">
                        <img src={listing.photo || "/demo/back.svg"} alt="" className="h-10 w-10 shrink-0 bg-soft object-contain" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{listing.name}</span>
                          {listing.price != null ? (
                            <span className="block text-xs font-semibold">
                              {formatHkd(listing.price, locale)}
                              {listing.auction ? ` · ${tx(locale, "拍賣", "Auction")}` : ""}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {posts.length || people.length ? (
              <section aria-label={tx(locale, "貼文", "Posts")}>
                <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "貼文", "Posts")}</h2>
                {posts.length ? (
                  <ul>
                    {posts.map((post) => (
                      <li key={post.id}>
                        <Link href={`/post/${post.id}`} className="flex h-12 items-center gap-2">
                          <img src={post.photo || "/demo/back.svg"} alt="" className="h-10 w-10 shrink-0 bg-soft object-contain" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{post.name || post.author}</span>
                            <span className="block truncate text-xs text-muted">{post.author}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {people.length ? (
                  <div className="mt-2">
                    <h3 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "收藏", "Saved")}</h3>
                    <ul>
                      {people.map((user) => (
                        <li key={user.id}>
                          <PersonLink user={user} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </FindExplore>
    </div>
  );
}

function PersonLink({ user }: { user: { id: string; nickname: string; avatarUrl: string | null } }) {
  return (
    <Link href={`/shop/${user.id}`} className="flex h-11 items-center gap-2 text-sm font-medium">
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.nickname.slice(0, 1)}
      </span>
      <span className="truncate">{user.nickname}</span>
    </Link>
  );
}

function emptyCopy(locale: Locale, show: MarketShow) {
  if (show === "listing") return tx(locale, "未有上架。", "No listings.");
  if (show === "post") return tx(locale, "未有相關貼文。", "No posts.");
  return tx(locale, "未有相關上架或貼文。", "No listings or posts.");
}

function HubChips({ locale, show, q, card }: { locale: Locale; show: MarketShow; q: string; card: string }) {
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
            href={findHref(q, { card: card || undefined, show: id })}
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
