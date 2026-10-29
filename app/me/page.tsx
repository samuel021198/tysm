import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { profileContent } from "@/lib/profile";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";
import { Flash } from "@/components/shell";

export default async function MePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; tab?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me");
  const board = await profileContent(viewer.id, viewer.id);
  const locale = prefs.locale;
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <ProfileHeader
        locale={locale}
        userId={viewer.id}
        base="/me"
        nickname={viewer.nickname}
        username={viewer.username}
        avatarUrl={viewer.avatarUrl}
        bio={viewer.bio}
        links={viewer.profileLinks}
        interestTags={viewer.interestTags}
        handoverPlace={viewer.handoverPlace}
        reviews={board.reviews}
        followers={board.followers}
        completed={board.completed}
        postCount={board.postCount}
        listingCount={board.listingCount}
        verificationTier={viewer.verificationTier}
        self
      />
      <div id="profile-posts">
        <ProfileBoard
          locale={locale}
          base="/me"
          tab={sp.tab || "posts"}
          isSelf
          posts={board.posts}
          postsNext={board.postsNext}
          ownerId={viewer.id}
          savedListings={board.savedListings}
          savedPosts={board.savedPosts}
          listings={board.listings}
          reviews={board.reviews}
          drafts={board.drafts}
          favIds={board.favIds}
          viewerId={viewer.id}
        />
      </div>
    </div>
  );
}
