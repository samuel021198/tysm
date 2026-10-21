import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { cardInclude } from "@/lib/feed";
import { tx } from "@/lib/i18n";
import { ListingCard } from "@/components/listing-card";

export default async function FavoritesPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/favorites");
  const rows = await prisma.favorite.findMany({
    where: { userId: viewer.id },
    include: { listing: { include: cardInclude } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{tx(prefs.locale, "收藏", "Favorites")}</h1>
      {rows.length === 0 ? <p>{tx(prefs.locale, "未有收藏。", "No favorites yet.")}</p> : null}
      <div className="masonry">
        {rows.map((row) => (
          <ListingCard key={row.id} listing={row.listing} locale={prefs.locale} favorited next="/me/favorites" followed={false} />
        ))}
      </div>
    </div>
  );
}
