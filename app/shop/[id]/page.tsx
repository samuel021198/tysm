import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { activeWhere, cardInclude } from "@/lib/feed";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { ListingCard } from "@/components/listing-card";
import { Flash } from "@/components/shell";
import { reportAction, toggleBlock, toggleFollow } from "@/actions/social";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, seller] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.user.findUnique({ where: { id } }),
  ]);
  if (!seller) notFound();
  if (viewer && viewer.id !== seller.id && (await isBlocked(viewer.id, seller.id))) notFound();
  const [listings, reviews, shipped, sales, following, blocked, favs] = await Promise.all([
    prisma.listing.findMany({ where: { ...activeWhere([]), sellerId: seller.id }, include: cardInclude, take: 24 }),
    prisma.review.findMany({ where: { subjectId: seller.id }, include: { author: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.order.findMany({ where: { sellerId: seller.id, shippedAt: { not: null } } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "COMPLETED" } }),
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: seller.id } } }) : null,
    viewer ? prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: seller.id } } }) : null,
    viewer ? prisma.favorite.findMany({ where: { userId: viewer.id }, select: { listingId: true } }) : [],
  ]);
  const onTime = shipped.filter((order) => order.shipBy && order.shippedAt && order.shippedAt <= order.shipBy).length;
  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length : null;
  const favIds = new Set(favs.map((row) => row.listingId));
  const locale = prefs.locale;
  return (
    <div>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <div className="mb-6 flex items-start gap-4">
        {seller.avatarUrl ? <img src={seller.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-soft">{seller.nickname.slice(0, 1)}</div>}
        <div>
          <h1 className="text-2xl font-semibold">{seller.nickname}</h1>
          <p className="mt-1 max-w-prose text-sm">{seller.bio}</p>
          <p className="mt-2 text-sm text-muted">
            {rating != null ? `${tx(locale, "評分", "Rating")} ${rating.toFixed(1)} (${reviews.length})` : tx(locale, "未有評分", "No rating yet")}
            {" · "}
            {tx(locale, "完成訂單", "Completed")} {sales}
            {shipped.length ? ` · ${tx(locale, "準時寄出", "On-time ship")} ${Math.round((onTime / shipped.length) * 100)}%` : ""}
          </p>
          {viewer && viewer.id !== seller.id ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <form action={toggleFollow}><input type="hidden" name="sellerId" value={seller.id} /><button className="underline">{following ? tx(locale, "取消關注", "Unfollow") : tx(locale, "關注", "Follow")}</button></form>
              <form action={toggleBlock}><input type="hidden" name="userId" value={seller.id} /><button className="underline">{blocked ? tx(locale, "解除隱藏", "Unblock") : tx(locale, "互相隱藏", "Block")}</button></form>
            </div>
          ) : null}
        </div>
      </div>
      <h2 className="mb-3 font-semibold">{tx(locale, "在售", "Active listings")}</h2>
      {listings.length === 0 ? <p className="empty">{tx(locale, "未有在售貨品。", "No active listings.")}</p> : null}
      <div className="feed">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} locale={locale} favorited={favIds.has(listing.id)} followed={false} next={`/shop/${id}`} />
        ))}
      </div>
      <h2 className="mb-3 mt-8 font-semibold">{tx(locale, "評價", "Reviews")}</h2>
      {reviews.length === 0 ? <p>{tx(locale, "未有評價。", "No reviews.")}</p> : null}
      <ul className="grid gap-3 text-sm">
        {reviews.map((review) => (
          <li key={review.id}>
            <p>{review.author.nickname} · {"★".repeat(review.stars)}</p>
            <p>{review.comment}</p>
            {review.reply ? <p className="text-muted">{tx(locale, "回覆", "Reply")}: {review.reply}</p> : null}
          </li>
        ))}
      </ul>
      {viewer && viewer.id !== seller.id ? (
        <form action={reportAction} className="mt-6 grid max-w-lg gap-2">
          <input type="hidden" name="targetType" value="USER" />
          <input type="hidden" name="targetId" value={seller.id} />
          <textarea className="field" name="reason" placeholder={tx(locale, "檢舉這位會員", "Report this member")} />
          <button className="w-fit text-sm underline">{tx(locale, "送出檢舉", "Send report")}</button>
        </form>
      ) : null}
      <p className="mt-6 text-sm"><Link href="/">{tx(locale, "返回動態", "Back to feed")}</Link></p>
    </div>
  );
}
