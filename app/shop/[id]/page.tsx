import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";
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
  const [following, blocked, board] = await Promise.all([
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: seller.id } } }) : null,
    viewer ? prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: seller.id } } }) : null,
    profileContent(seller.id, viewer?.id ?? null),
  ]);
  const locale = prefs.locale;
  return (
    <div>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <div className="mb-3">
        <ProfileHeader
          locale={locale}
          userId={seller.id}
          base={`/shop/${seller.id}`}
          nickname={seller.nickname}
          username={seller.username}
          avatarUrl={seller.avatarUrl}
          bio={seller.bio}
          links={seller.profileLinks}
          interestTags={seller.interestTags}
          handoverPlace={seller.handoverPlace}
          reviews={board.reviews}
          followers={board.followers}
          completed={board.completed}
          postCount={board.postCount}
          listingCount={board.listingCount}
          verificationTier={seller.verificationTier}
          self={viewer?.id === seller.id}
        >
          {viewer && viewer.id !== seller.id ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <form action={toggleFollow}><input type="hidden" name="sellerId" value={seller.id} /><button className="btn btn-ghost">{following ? tx(locale, "取消關注", "Unfollow") : tx(locale, "關注", "Follow")}</button></form>
              <details>
                <summary className="cursor-pointer text-muted">{tx(locale, "更多", "More")}</summary>
                <form action={toggleBlock} className="mt-2"><input type="hidden" name="userId" value={seller.id} /><button className="underline">{blocked ? tx(locale, "解除隱藏", "Unblock") : tx(locale, "隱藏這位賣家", "Hide this seller")}</button></form>
              </details>
            </div>
          ) : null}
        </ProfileHeader>
      </div>
      <div id="profile-posts">
        <ProfileBoard
          locale={locale}
          base={`/shop/${seller.id}`}
          tab={sp.tab || "posts"}
          isSelf={viewer?.id === seller.id}
          posts={board.posts}
          postsNext={board.postsNext}
          ownerId={seller.id}
          savedListings={board.savedListings}
          savedPosts={board.savedPosts}
          listings={board.listings}
          reviews={board.reviews}
          drafts={board.drafts}
          favIds={board.favIds}
          viewerId={viewer?.id ?? null}
        />
      </div>
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
    </div>
  );
}
