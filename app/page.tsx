import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere } from "@/lib/feed";
import { loadHomeFeed } from "@/lib/profile";
import { loadStoryRings } from "@/lib/story-feed";
import { hiddenUserIds } from "@/lib/social";
import { listingSuggestionCard } from "@/lib/posts";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { PostCard } from "@/components/post-card";
import { StoryRail } from "@/components/story-rail";
import { tx } from "@/lib/i18n";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const [{ primary, suggested, linkedListings }, storyFeed] = await Promise.all([
    loadHomeFeed(viewer?.id ?? null, hidden),
    loadStoryRings(viewer?.id ?? null, hidden),
  ]);
  const linked = [...linkedListings];
  const extras = await prisma.listing.findMany({
    where: { ...activeWhere(hidden), ...(linked.length ? { id: { notIn: linked } } : {}) },
    select: {
      id: true,
      title: true,
      cardName: true,
      personName: true,
      conditionTrack: true,
      rawGrade: true,
      grader: true,
      gradeValue: true,
      favoriteCount: true,
      status: true,
      quantityAvailable: true,
      saleType: true,
      price: true,
      currentBid: true,
      startPrice: true,
      auctionSettled: true,
      catalogCardId: true,
      sellerId: true,
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      seller: { select: { id: true, nickname: true, avatarUrl: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
  });
  const favRows = viewer && extras.length
    ? await prisma.favorite.findMany({
        where: { userId: viewer.id, listingId: { in: extras.map((listing) => listing.id) } },
        select: { listingId: true },
      })
    : [];
  const favIds = new Set(favRows.map((row) => row.listingId));
  const listingCards = extras.map((listing) => listingSuggestionCard({ listing, liked: favIds.has(listing.id) }));

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <StoryRail locale={prefs.locale} rings={storyFeed.rings} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title mb-0">{tx(prefs.locale, "主頁", "Home")}</h1>
        <Link href="/add?kind=post" className="text-sm font-semibold text-link">
          {tx(prefs.locale, "寫貼文", "New post")}
        </Link>
      </div>
      {primary.length === 0 && suggested.length === 0 && listingCards.length === 0 ? (
        <p className="empty">{tx(prefs.locale, "未有動態。發一則貼文，或者上架一張卡。", "No posts yet. Write a post, or list a card.")}</p>
      ) : null}
      {primary.length ? (
        <section className="grid gap-4">
          <h2 className="text-sm font-semibold text-muted">{tx(prefs.locale, "關注中", "Following")}</h2>
          {primary.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" />
          ))}
        </section>
      ) : null}
      {suggested.length || listingCards.length ? (
        <section className="grid gap-4">
          <h2 className="text-sm font-semibold text-muted">{tx(prefs.locale, "建議", "Suggested")}</h2>
          {suggested.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" />
          ))}
          {listingCards.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" />
          ))}
        </section>
      ) : null}
    </div>
  );
}
