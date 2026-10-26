import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { onTimePercent } from "@/lib/shipping";
import { isBlocked } from "@/lib/social";
import { ProfileBoard } from "@/components/profile-board";
import { Flash } from "@/components/shell";
import { profileContent } from "@/lib/profile";
import { reportAction, toggleBlock, toggleFollow } from "@/actions/social";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; tab?: string }>;
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
  const [shipped, sales, following, blocked, board] = await Promise.all([
    prisma.order.findMany({ where: { sellerId: seller.id, shippedAt: { not: null } } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "COMPLETED" } }),
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: seller.id } } }) : null,
    viewer ? prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: seller.id } } }) : null,
    profileContent(seller.id, viewer?.id ?? null),
  ]);
  const onTime = onTimePercent(shipped);
  const rating = board.reviews.length ? board.reviews.reduce((sum, review) => sum + review.stars, 0) / board.reviews.length : null;
  const locale = prefs.locale;
  return (
    <div>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <div className="mb-6 flex items-start gap-4">
        {seller.avatarUrl ? <img src={seller.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-soft text-sm font-semibold">{seller.nickname.slice(0, 1)}</div>}
        <div>
          <h1 className="text-[1.3rem] font-semibold leading-tight">{seller.nickname}</h1>
          <p className="mt-1 max-w-prose text-sm">{seller.bio}</p>
          <p className="mt-2 text-sm text-muted">
            {rating != null ? `${tx(locale, "評分", "Rating")} ${rating.toFixed(1)} (${board.reviews.length})` : tx(locale, "未有評分", "No rating yet")}
            {" · "}
            {tx(locale, "粉絲", "Followers")} {board.followers}
            {" · "}
            {tx(locale, "完成訂單", "Completed")} {sales}
            {onTime != null ? ` · ${tx(locale, "準時寄出", "On-time ship")} ${onTime}%` : ""}
          </p>
          {viewer && viewer.id !== seller.id ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <form action={toggleFollow}><input type="hidden" name="sellerId" value={seller.id} /><button className="btn btn-ghost">{following ? tx(locale, "取消關注", "Unfollow") : tx(locale, "關注", "Follow")}</button></form>
              <details>
                <summary className="cursor-pointer text-muted">{tx(locale, "更多", "More")}</summary>
                <form action={toggleBlock} className="mt-2"><input type="hidden" name="userId" value={seller.id} /><button className="underline">{blocked ? tx(locale, "解除隱藏", "Unblock") : tx(locale, "隱藏這位賣家", "Hide this seller")}</button></form>
              </details>
            </div>
          ) : null}
        </div>
      </div>
      <ProfileBoard
        locale={locale}
        base={`/shop/${seller.id}`}
        tab={sp.tab || "posts"}
        isSelf={viewer?.id === seller.id}
        posts={board.posts}
        items={board.items}
        listings={board.listings}
        reviews={board.reviews}
        drafts={board.drafts}
        favIds={board.favIds}
      />
      {viewer && viewer.id !== seller.id ? (
        <details className="mt-6 max-w-lg text-sm">
          <summary className="cursor-pointer text-muted">{tx(locale, "檢舉這位會員", "Report this member")}</summary>
          <form action={reportAction} className="mt-2 grid gap-2">
            <input type="hidden" name="targetType" value="USER" />
            <input type="hidden" name="targetId" value={seller.id} />
            <textarea className="field" name="reason" placeholder={tx(locale, "原因", "Reason")} />
            <button className="w-fit underline">{tx(locale, "送出檢舉", "Send report")}</button>
          </form>
        </details>
      ) : null}
      <p className="mt-6 text-sm"><Link href="/">{tx(locale, "返回主頁", "Back home")}</Link></p>
    </div>
  );
}
