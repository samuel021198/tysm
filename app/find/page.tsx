import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere } from "@/lib/feed";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { cardDisplayName } from "@/lib/posts";
import { listingQueryWhere, postQueryWhere, searchScore, userQueryWhere } from "@/lib/search";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
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
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, hides] = await Promise.all([hiddenUserIds(viewer?.id ?? null), feedHideIds(viewer?.id ?? null)]);
  const viewerId = viewer?.id ?? null;

  let users: { id: string; nickname: string; avatarUrl: string | null }[] = [];
  let posts: { id: string; name: string; author: string; photo: string | null }[] = [];
  let listings: { id: string; name: string; photo: string | null; price: number | null }[] = [];

  if (q) {
    await sweep();
    const [userRows, postRows, listingRows] = await Promise.all([
      prisma.user.findMany({
        where: { AND: [userQueryWhere(q), ...(hidden.length ? [{ id: { notIn: hidden } }] : [])] },
        select: { id: true, nickname: true, avatarUrl: true },
        orderBy: { nickname: "asc" },
        take: 8,
      }),
      prisma.post.findMany({
        where: {
          AND: [
            postQueryWhere(q),
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.listing.findMany({
        where: {
          AND: [
            activeWhere(hidden),
            listingQueryWhere(q),
            ...(hides.listingIds.length ? [{ id: { notIn: hides.listingIds } }] : []),
          ],
        },
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
          photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          category: { select: { nameZh: true, nameEn: true, parent: { select: { nameZh: true, nameEn: true } } } },
        },
        take: 40,
      }),
    ]);
    users = userRows;
    posts = postRows.map((post) => ({
      id: post.id,
      name: cardDisplayName({
        cardName: post.collectionItem?.cardName,
        title: post.collectionItem?.title,
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
      price: listing.saleType === "AUCTION" ? listing.currentBid ?? listing.startPrice : listing.price ?? listing.currentBid,
    }));
  }

  const empty = q && users.length === 0 && posts.length === 0 && listings.length === 0;
  const locale = prefs.locale;

  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Flash locale={locale} ok={one(sp.ok)} err={one(sp.err)} />
      <form action="/find" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={tx(locale, "搜尋", "Search")}
          aria-label={tx(locale, "搜尋", "Search")}
          className="field"
          autoFocus
        />
      </form>
      {empty ? <p className="text-sm text-muted">{tx(locale, "沒有結果", "No results")}</p> : null}
      {users.length ? (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "用戶", "Users")}</h2>
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                <Link href={`/shop/${user.id}`} className="flex h-11 items-center gap-2 text-sm font-medium">
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.nickname.slice(0, 1)}
                  </span>
                  <span className="truncate">{user.nickname}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {posts.length ? (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "貼文", "Posts")}</h2>
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
        </section>
      ) : null}
      {listings.length ? (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "放售", "For sale")}</h2>
          <ul>
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link href={`/listing/${listing.id}`} className="flex h-12 items-center gap-2">
                  <img src={listing.photo || "/demo/back.svg"} alt="" className="h-10 w-10 shrink-0 bg-soft object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{listing.name}</span>
                    {listing.price != null ? <span className="block text-xs font-semibold">{formatHkd(listing.price, locale)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
