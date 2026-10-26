import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { HIDDEN_POSTS_COOKIE, parseHiddenPostIds, splitHiddenKeys } from "@/lib/hide-posts";
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
  const hiddenKeys = splitHiddenKeys(parseHiddenPostIds((await cookies()).get(HIDDEN_POSTS_COOKIE)?.value));
  const [{ primary, suggested, linkedListings }, storyFeed] = await Promise.all([
    loadHomeFeed(viewer?.id ?? null, hidden, hiddenKeys.posts),
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
  const hiddenListings = new Set(hiddenKeys.listings);
  const listingCards = extras
    .map((listing) => listingSuggestionCard({ listing, liked: favIds.has(listing.id) }))
    .filter((post) => !hiddenListings.has(post.id));

  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <StoryRail locale={prefs.locale} rings={storyFeed.rings} />
      <div className="flex justify-end">
        <Link href="/add?kind=post" className="text-sm font-semibold text-link">
          {tx(prefs.locale, "寫貼文", "New post")}
        </Link>
      </div>
      {primary.length === 0 && suggested.length === 0 && listingCards.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{tx(prefs.locale, "未有動態。", "No posts yet.")}</p>
      ) : null}
      {primary.length ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-muted">{tx(prefs.locale, "關注中", "Following")}</h2>
          {primary.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" owned={viewer?.id === post.author.id} />
          ))}
        </section>
      ) : null}
      {suggested.length || listingCards.length ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-muted">{tx(prefs.locale, "建議", "Suggested")}</h2>
          {suggested.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" owned={viewer?.id === post.author.id} />
          ))}
          {listingCards.map((post) => (
            <PostCard key={post.id} post={post} locale={prefs.locale} next="/" owned={viewer?.id === post.author.id} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
