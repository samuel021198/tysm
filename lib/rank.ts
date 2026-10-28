import type { OrderStatus } from "@prisma/client";
import { prisma } from "./db";
import type { Locale } from "./i18n";

/** Rolling window. The prior window is the 3 days before that, for the % change. */
export const RANK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** A deal counts once money has moved. Unpaid, cancelled, and refunded orders do not. */
export const COUNTED_ORDER_STATUSES: OrderStatus[] = ["IN_ESCROW", "AWAITING_SHIP", "SHIPPED", "COMPLETED", "DISPUTED"];

const COUNTED = new Set<string>(COUNTED_ORDER_STATUSES);

export type RankTab = "shops" | "collectors" | "posts";

export function rankTab(value: string | undefined): RankTab {
  if (value === "collectors" || value === "posts") return value;
  return "shops";
}

export function rankPath(tab: RankTab): string {
  if (tab === "shops") return "/rank";
  return `/rank?tab=${tab}`;
}

const RANK_ORDER: RankTab[] = ["shops", "collectors", "posts"];

/** 1 = next segment (swipe left). Null at either end so the bottom pager can take over. */
export function rankTabStep(tab: RankTab, dir: -1 | 1): RankTab | null {
  const next = RANK_ORDER.indexOf(tab) + dir;
  if (next < 0 || next >= RANK_ORDER.length) return null;
  return RANK_ORDER[next];
}

export type RankEvent = { id: string; at: Date; weight: number; tags: string[] };

export type RankScore = { id: string; current: number; prior: number; tags: string[] };

export type VolumeRow = {
  sellerId: string;
  status: string;
  paidAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  items: { quantity: number; tag: string | null }[];
};

export type LikeRow = {
  userId: string;
  createdAt: Date;
  authorId: string;
  tags: string[];
};

export type PostLikeRow = { postId: string; at: Date };

export type RankRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Post cover. Shops and collectors leave this empty; the row uses the avatar instead. */
  coverUrl: string | null;
  href: string;
  current: number;
  prior: number;
  tags: string[];
};

/** Payment is the deal. Completed-without-pay and unpaid rows fall back so older data still counts. */
export function dealAt(order: { paidAt: Date | null; completedAt: Date | null; createdAt: Date }): Date {
  return order.paidAt ?? order.completedAt ?? order.createdAt;
}

export function rankBucket(at: Date, now: Date): "current" | "prior" | null {
  const age = now.getTime() - at.getTime();
  if (age < 0 || age >= RANK_WINDOW_MS * 2) return null;
  return age < RANK_WINDOW_MS ? "current" : "prior";
}

/** 成交量 is units sold on counted orders, not order count and not the public binder size. */
export function merchantEvents(orders: VolumeRow[]): RankEvent[] {
  const events: RankEvent[] = [];
  for (const order of orders) {
    if (!COUNTED.has(order.status)) continue;
    const at = dealAt(order);
    for (const item of order.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) continue;
      events.push({ id: order.sellerId, at, weight: item.quantity, tags: item.tag ? [item.tag] : [] });
    }
  }
  return events;
}

/** Likes received. The author's own like does not count, and neither does a collection-card total. */
export function collectorEvents(likes: LikeRow[]): RankEvent[] {
  return likes
    .filter((row) => row.userId !== row.authorId)
    .map((row) => ({ id: row.authorId, at: row.createdAt, weight: 1, tags: row.tags }));
}

/**
 * 人氣貼文 score: likes on that post in the last 3 days.
 * Not saves, comments, or how many cards sit in the binder. The %Δ is still the prior 3 days.
 */
export function postEvents(likes: PostLikeRow[]): RankEvent[] {
  return likes.map((row) => ({ id: row.postId, at: row.at, weight: 1, tags: [] }));
}

export function tallyRanks(events: RankEvent[], now: Date): RankScore[] {
  const map = new Map<string, { current: number; prior: number; tags: Map<string, number> }>();
  for (const event of events) {
    const bucket = rankBucket(event.at, now);
    if (!bucket || event.weight < 1) continue;
    const slot = map.get(event.id) ?? { current: 0, prior: 0, tags: new Map() };
    slot[bucket] += event.weight;
    if (bucket === "current") {
      for (const tag of event.tags) {
        const key = tag.trim();
        if (!key) continue;
        slot.tags.set(key, (slot.tags.get(key) ?? 0) + event.weight);
      }
    }
    map.set(event.id, slot);
  }
  const scores: RankScore[] = [];
  for (const [id, slot] of map) {
    if (slot.current <= 0) continue;
    const tags = [...slot.tags.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"))
      .slice(0, 2)
      .map(([tag]) => tag);
    scores.push({ id, current: slot.current, prior: slot.prior, tags });
  }
  scores.sort((a, b) => b.current - a.current || b.prior - a.prior || a.id.localeCompare(b.id));
  return scores;
}

export function sortRank<T extends { current: number; prior: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.current - a.current || b.prior - a.prior || a.name.localeCompare(b.name, "zh-Hant"));
}

export function rankDisplayName(tab: RankTab, user: { nickname: string; storeName: string | null }): string {
  if (tab === "shops") {
    const shop = user.storeName?.trim();
    if (shop) return shop;
  }
  return user.nickname;
}

export function rankMetricLabel(tab: RankTab, current: number, locale: Locale): string {
  if (locale === "en") {
    if (tab === "shops") return `Volume, last 3 days: ${current}`;
    return `Likes, last 3 days: ${current}`;
  }
  if (tab === "shops") return `近 3 日成交量 ${current}`;
  if (tab === "posts") return `近 3 日讚好 ${current}`;
  return `近 3 日獲讚 ${current}`;
}

export function formatRankChange(current: number, prior: number, locale: Locale): { text: string; tone: "up" | "down" | "flat" | "new" } {
  if (prior <= 0) return { text: locale === "en" ? "New" : "新", tone: "new" };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct > 0) return { text: `+${pct}%`, tone: "up" };
  if (pct < 0) return { text: `${pct}%`, tone: "down" };
  return { text: "0%", tone: "flat" };
}

function itemTag(listing: { game: string | null; category: { nameZh: string; nameEn: string } } | null, locale: Locale): string | null {
  if (!listing) return null;
  const name = (locale === "en" ? listing.category.nameEn : listing.category.nameZh).trim();
  if (name) return name;
  return listing.game?.trim() || null;
}

async function loadMerchantOrders(since: Date, locale: Locale): Promise<VolumeRow[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: COUNTED_ORDER_STATUSES },
      OR: [
        { paidAt: { gte: since } },
        { AND: [{ paidAt: null }, { completedAt: { gte: since } }] },
        { AND: [{ paidAt: null }, { completedAt: null }, { createdAt: { gte: since } }] },
      ],
    },
    select: {
      sellerId: true,
      status: true,
      paidAt: true,
      completedAt: true,
      createdAt: true,
      items: { select: { quantity: true, listing: { select: { game: true, category: { select: { nameZh: true, nameEn: true } } } } } },
    },
  });
  return orders.map((order) => ({
    sellerId: order.sellerId,
    status: order.status,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({ quantity: item.quantity, tag: itemTag(item.listing, locale) })),
  }));
}

async function loadLikes(since: Date): Promise<LikeRow[]> {
  const likes = await prisma.postLike.findMany({
    where: { createdAt: { gte: since } },
    select: { userId: true, createdAt: true, post: { select: { authorId: true, tags: true } } },
  });
  return likes.map((like) => ({
    userId: like.userId,
    createdAt: like.createdAt,
    authorId: like.post.authorId,
    tags: like.post.tags,
  }));
}

/**
 * Top 50 with activity in the current window.
 * ponytail: folds the last 6 days in memory. Upgrade path: SQL GROUP BY once a window holds more than a few thousand orders or likes.
 */
export async function loadRank(tab: RankTab, locale: Locale, hiddenIds: string[], now = new Date()): Promise<RankRow[]> {
  const since = new Date(now.getTime() - RANK_WINDOW_MS * 2);
  if (tab === "posts") return loadPostRank(since, hiddenIds, now);
  const events = tab === "shops" ? merchantEvents(await loadMerchantOrders(since, locale)) : collectorEvents(await loadLikes(since));
  const hidden = new Set(hiddenIds);
  const scores = tallyRanks(events, now).filter((row) => !hidden.has(row.id));
  if (!scores.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: scores.map((row) => row.id) } },
    select: { id: true, nickname: true, avatarUrl: true, storeName: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  const rows: RankRow[] = [];
  for (const score of scores) {
    const user = byId.get(score.id);
    if (!user) continue;
    rows.push({
      id: user.id,
      name: rankDisplayName(tab, user),
      avatarUrl: user.avatarUrl,
      coverUrl: null,
      href: `/shop/${user.id}`,
      current: score.current,
      prior: score.prior,
      tags: score.tags,
    });
  }
  return sortRank(rows).slice(0, 50);
}

/** Cover matches the post card: binder photo when the post is tied to a card, otherwise the post photo. */
function postCover(post: {
  photos: { url: string }[];
  collectionItem: { photos: { url: string }[] } | null;
}): string | null {
  return post.collectionItem?.photos[0]?.url ?? post.photos[0]?.url ?? null;
}

async function loadPostRank(since: Date, hiddenIds: string[], now: Date): Promise<RankRow[]> {
  const likes = await prisma.postLike.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, post: { select: { id: true, authorId: true } } },
  });
  const hidden = new Set(hiddenIds);
  const scores = tallyRanks(
    postEvents(likes.filter((like) => !hidden.has(like.post.authorId)).map((like) => ({ postId: like.post.id, at: like.createdAt }))),
    now,
  );
  if (!scores.length) return [];
  const posts = await prisma.post.findMany({
    where: { id: { in: scores.map((row) => row.id) } },
    select: {
      id: true,
      author: { select: { nickname: true, avatarUrl: true } },
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      collectionItem: { select: { photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } },
    },
  });
  const byId = new Map(posts.map((post) => [post.id, post]));
  const rows: RankRow[] = [];
  for (const score of scores) {
    const post = byId.get(score.id);
    if (!post) continue;
    rows.push({
      id: post.id,
      name: post.author.nickname,
      avatarUrl: post.author.avatarUrl,
      coverUrl: postCover(post),
      href: `/post/${post.id}`,
      current: score.current,
      prior: score.prior,
      tags: [],
    });
  }
  return sortRank(rows).slice(0, 50);
}
