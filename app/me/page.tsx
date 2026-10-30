import Link from "next/link";
import { logout } from "@/actions/auth";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { profileContent } from "@/lib/profile";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";
import { Flash } from "@/components/shell";

export default async function MePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; tab?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) {
    return (
      <div className="mx-auto grid max-w-3xl gap-3 pb-[calc(var(--tab-h)+1rem)] md:pb-0">
        <p className="px-1 text-sm text-muted">{tx(prefs.locale, "登入後即可查看個人頁。", "Log in to see your profile.")}</p>
        <Link href="/login?next=/me" className="btn btn-primary w-full md:w-auto">{tx(prefs.locale, "登入", "Log in")}</Link>
      </div>
    );
  }
  const board = await profileContent(viewer.id, viewer.id);
  const locale = prefs.locale;
  return (
    <div className="mx-auto grid max-w-3xl gap-3 pb-[calc(var(--tab-h)+1rem)] md:pb-0">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <ProfileHeader
        locale={locale}
        userId={viewer.id}
        base="/me"
        nickname={viewer.nickname}
        avatarUrl={viewer.avatarUrl}
        bio={viewer.bio}
        links={viewer.profileLinks}
        interestTags={viewer.interestTags}
        handoverPlace={viewer.handoverPlace}
        rating={board.rating}
        followers={board.followers}
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
          inventory={board.inventory}
          reviews={board.reviews}
          drafts={board.drafts}
          favIds={board.favIds}
          viewerId={viewer.id}
        />
      </div>
      <form action={logout} className="md:hidden">
        <button className="btn btn-ghost w-full">{tx(locale, "登出", "Log out")}</button>
      </form>
    </div>
  );
}
