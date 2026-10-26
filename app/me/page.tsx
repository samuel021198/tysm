import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { profileContent } from "@/lib/profile";
import { Flash } from "@/components/shell";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";

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
        nickname={viewer.nickname}
        avatarUrl={viewer.avatarUrl}
        bio={viewer.bio}
        reviews={board.reviews}
        followers={board.followers}
        completed={board.completed}
      >
        <Link href="/me/settings" className="mt-1.5 inline-flex h-8 items-center rounded-full border border-line bg-card px-2.5 text-xs font-semibold">
          {tx(locale, "編輯個人檔案", "Edit profile")}
        </Link>
      </ProfileHeader>
      <ProfileBoard
        locale={locale}
        base="/me"
        tab={sp.tab || "posts"}
        isSelf
        posts={board.posts}
        items={board.items}
        listings={board.listings}
        reviews={board.reviews}
        drafts={board.drafts}
        favIds={board.favIds}
      />
    </div>
  );
}
