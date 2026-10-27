import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { cardInclude } from "@/lib/feed";
import { followedSellerIds } from "@/lib/social";
import { tx } from "@/lib/i18n";
import { ListingCard } from "@/components/listing-card";

export default async function FavoritesPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/favorites");
  const [rows, follows] = await Promise.all([
    prisma.favorite.findMany({
    where: { userId: viewer.id },
    include: { listing: { include: cardInclude } },
    orderBy: { createdAt: "desc" },
    }),
    followedSellerIds(viewer.id),
  ]);
  return (
    <div>
      <h1 className="page-title">{tx(prefs.locale, "收藏", "Favorites")}</h1>
      {rows.length === 0 ? <p className="empty">{tx(prefs.locale, "未有收藏。", "No favorites yet.")}</p> : null}
      <div className="feed">
        {rows.map((row) => (
          <ListingCard key={row.id} listing={row.listing} locale={prefs.locale} favorited next="/me/favorites" followed={follows.has(row.listing.sellerId)} />
        ))}
      </div>
    </div>
  );
}
