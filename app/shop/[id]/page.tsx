import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";
import { Flash } from "@/components/shell";
import { profileContent } from "@/lib/profile";
import { openDirectThread, toggleFollow } from "@/actions/social";
import { Icon } from "@/components/icons";
import { PersonMenu } from "@/components/safety-menu";

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
  const [following, board] = await Promise.all([
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: seller.id } } }) : null,
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
          avatarUrl={seller.avatarUrl}
          bio={seller.bio}
          links={seller.profileLinks}
          interestTags={seller.interestTags}
          handoverPlace={seller.handoverPlace}
          rating={board.rating}
          followers={board.followers}
          postCount={board.postCount}
          listingCount={board.listingCount}
          verificationTier={seller.verificationTier}
          self={viewer?.id === seller.id}
        >
          {viewer && viewer.id !== seller.id ? (
            <div className="mt-3 flex items-center gap-2">
              <form action={toggleFollow} className="min-w-0 flex-1">
                <input type="hidden" name="sellerId" value={seller.id} />
                <button className="btn btn-ghost w-full">{following ? tx(locale, "已關注", "Following") : tx(locale, "關注", "Follow")}</button>
              </form>
              <form action={openDirectThread}>
                <input type="hidden" name="userId" value={seller.id} />
                <button type="submit" className="btn btn-ghost w-11 shrink-0 px-0" aria-label={tx(locale, "訊息", "Message")}>
                  <Icon name="messages" className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </form>
              <PersonMenu
                locale={locale}
                userId={seller.id}
                reportType="USER"
                reportId={seller.id}
                next={`/shop/${seller.id}`}
                away="/"
              />
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
          inventory={board.inventory}
          reviews={board.reviews}
          drafts={board.drafts}
          favIds={board.favIds}
          viewerId={viewer?.id ?? null}
        />
      </div>
    </div>
  );
}
