import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere } from "@/lib/feed";
import { loadHomeFeed } from "@/lib/profile";
import { loadStoryRings } from "@/lib/story-feed";
import { feedHideIds, hiddenUserIds } from "@/lib/social";
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
  const [hidden, hides] = await Promise.all([hiddenUserIds(viewer?.id ?? null), feedHideIds(viewer?.id ?? null)]);
  const [{ primary, suggested, linkedListings }, storyFeed] = await Promise.all([
    loadHomeFeed(viewer?.id ?? null, hidden, hides.postIds),
    loadStoryRings(viewer?.id ?? null, hidden),
  ]);
  const covered = new Set(
    [...primary, ...suggested].filter((post) => post.priceCents != null).flatMap((post) => post.photos),
  );
  const linked = [...linkedListings];
  const extras = (await prisma.listing.findMany({
    where: {
      ...activeWhere(hidden),
      ...([...linked, ...hides.listingIds].length ? { id: { notIn: [...linked, ...hides.listingIds] } } : {}),
    },
    select: {
      id: true,
      title: true,
      cardName: true,
      personName: true,
      conditionTrack: true,
      rawGrade: true,
      grader: true,
      gradeValue: true,
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
    take: 12,
  })).filter((listing) => !covered.has(listing.photos[0]?.url || "")).slice(0, 4);
  const favRows = viewer && extras.length
    ? await prisma.favorite.findMany({
        where: { userId: viewer.id, listingId: { in: extras.map((listing) => listing.id) } },
        select: { listingId: true },
      })
    : [];
  const favIds = new Set(favRows.map((row) => row.listingId));
  const listingCards = extras.map((listing) => listingSuggestionCard({ listing, saved: favIds.has(listing.id) }));

  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div className="grid gap-1">
        <StoryRail locale={prefs.locale} rings={storyFeed.rings} />
        {primary.length ? (
          <section className="grid gap-3">
            {primary.map((post) => (
              <PostCard key={post.id} post={post} locale={prefs.locale} next="/" viewerId={viewer?.id ?? null} />
            ))}
          </section>
        ) : null}
      </div>
      {primary.length === 0 && suggested.length === 0 && listingCards.length === 0 ? (
        <p className="empty">{tx(prefs.locale, "未有動態。", "No posts yet.")}</p>
      ) : null}
      {suggested.length || listingCards.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold leading-none text-muted">{tx(prefs.locale, "建議", "Suggested")}</h2>
          <div className="grid gap-3">
            {suggested.map((post) => (
              <PostCard key={post.id} post={post} locale={prefs.locale} next="/" viewerId={viewer?.id ?? null} />
            ))}
            {listingCards.map((post) => (
              <PostCard key={post.id} post={post} locale={prefs.locale} next="/" viewerId={viewer?.id ?? null} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
