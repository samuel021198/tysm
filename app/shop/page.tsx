import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { mallCat, mallSort, NEW_LISTING_MS } from "@/lib/auction";
import { activeWhere } from "@/lib/feed";
import { listingQueryWhere } from "@/lib/search";
import { feedHideIds, followedSellerIds, hiddenUserIds } from "@/lib/social";
import { MALL_FEED_CAP, mallPinnedSlug } from "@/lib/shop-inventory";
import { displayPhoto } from "@/lib/demo-covers";
import { tx } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { MallBoard, type MallFeedCard, type MallShopCard } from "@/components/mall-board";
import type { VerificationTierName } from "@/components/profile-header";

export const metadata = { title: "商店" };

const mallSelect = {
  id: true,
  title: true,
  saleType: true,
  price: true,
  startPrice: true,
  currentBid: true,
  auctionEndsAt: true,
  auctionSettled: true,
  promoted: true,
  sellerId: true,
  game: true,
  cardName: true,
  seller: { select: { nickname: true, storeName: true } },
  category: { select: { slug: true, nameZh: true, nameEn: true } },
  photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
} as const;

export default async function ShopMallPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; cat?: string }> }) {
  await sweep();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sort = mallSort(sp.sort);
  const cat = mallCat(sp.cat);
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const [hidden, hides, follows] = await Promise.all([
    hiddenUserIds(viewer?.id ?? null),
    feedHideIds(viewer?.id ?? null),
    followedSellerIds(viewer?.id ?? null),
  ]);
  const followedIds = [...follows].filter((id) => !hidden.includes(id));
  const where = {
    ...activeWhere(hidden),
    ...(hides.listingIds.length ? { id: { notIn: hides.listingIds } } : {}),
    ...(q ? { AND: [listingQueryWhere(q)] } : {}),
  };
  const recentSince = new Date(Date.now() - NEW_LISTING_MS);
  // ponytail: 精選／分類／拍賣 rank the newest 200, plus 16 from people you follow. Upgrade: SQL category + interest filters.
  const [listed, followedRows, storeRows, categories] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: { publishedAt: "desc" }, take: 200, select: mallSelect }),
    followedIds.length
      ? prisma.listing.findMany({
          where: { ...where, sellerId: { in: followedIds } },
          orderBy: { publishedAt: "desc" },
          take: MALL_FEED_CAP,
          select: mallSelect,
        })
      : Promise.resolve([]),
    loadStores(hidden, recentSince),
    prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" }, select: { slug: true, nameZh: true, nameEn: true } }),
  ]);
  const seen = new Set<string>();
  const listings: MallFeedCard[] = [];
  for (const row of [...listed, ...followedRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    listings.push(toCard(row));
  }
  const shops = (q ? storeRows.filter((row) => shopHit(q, row.nickname, row.storeName)) : storeRows).slice(0, MALL_FEED_CAP);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="sr-only">{tx(prefs.locale, "商店", "Shop")}</h1>
      <MallBoard
        key={`${q}\0${sort}\0${cat}`}
        locale={prefs.locale}
        q={q}
        sort={sort}
        cat={cat}
        loggedIn={Boolean(viewer)}
        interests={viewer?.interestTags ?? []}
        followedIds={followedIds}
        listings={listings}
        shops={shops}
        moreCats={categories.filter((row) => !mallPinnedSlug(row.slug))}
      />
    </div>
  );
}

function shopHit(q: string, nickname: string, storeName: string | null): boolean {
  const needle = q.toLowerCase();
  return nickname.toLowerCase().includes(needle) || (storeName ?? "").toLowerCase().includes(needle);
}

function toCard(row: {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionEndsAt: Date | null;
  auctionSettled: boolean;
  promoted: boolean;
  sellerId: string;
  game: string | null;
  cardName: string | null;
  seller: { nickname: string; storeName: string | null };
  category: { slug: string; nameZh: string; nameEn: string };
  photos: { url: string }[];
}): MallFeedCard {
  return {
    id: row.id,
    title: row.title,
    saleType: row.saleType,
    price: row.price,
    startPrice: row.startPrice,
    currentBid: row.currentBid,
    auctionEndsAt: row.auctionEndsAt ? row.auctionEndsAt.toISOString() : null,
    auctionSettled: row.auctionSettled,
    promoted: row.promoted,
    sellerId: row.sellerId,
    sellerName: row.seller.nickname,
    storeName: row.seller.storeName,
    photo: displayPhoto(row.photos[0]?.url),
    game: row.game,
    cardName: row.cardName,
    categorySlug: row.category.slug,
    categoryZh: row.category.nameZh,
    categoryEn: row.category.nameEn,
  };
}

async function loadStores(hidden: string[], recentSince: Date): Promise<MallShopCard[]> {
  const rows = await prisma.user.findMany({
    where: { storeName: { not: null }, ...(hidden.length ? { id: { notIn: hidden } } : {}) },
    select: {
      id: true,
      nickname: true,
      storeName: true,
      avatarUrl: true,
      verificationTier: true,
      _count: { select: { listings: { where: activeWhere(hidden) } } },
    },
  });
  const ids = rows.map((row) => row.id);
  const fresh = ids.length
    ? await prisma.listing.groupBy({
        by: ["sellerId"],
        where: { ...activeWhere(hidden), sellerId: { in: ids }, publishedAt: { gte: recentSince } },
        _count: { _all: true },
      })
    : [];
  const recent = new Map(fresh.map((row) => [row.sellerId, row._count._all]));
  return rows
    .map((row) => ({
      id: row.id,
      nickname: row.nickname,
      storeName: row.storeName,
      avatarUrl: row.avatarUrl,
      verificationTier: row.verificationTier as VerificationTierName,
      listings: row._count.listings,
      recent: recent.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.listings - a.listings || a.nickname.localeCompare(b.nickname, "zh-HK"));
}
