import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { profileContent } from "@/lib/profile";
import { Flash } from "@/components/shell";
import { ProfileBoard } from "@/components/profile-board";

export default async function MePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; tab?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me");
  const board = await profileContent(viewer.id, viewer.id);
  const locale = prefs.locale;
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <header className="flex items-start gap-2.5">
        {viewer.avatarUrl ? (
          <img src={viewer.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold leading-none text-white">
            {viewer.nickname.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">{viewer.nickname}</h1>
          {viewer.bio ? <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{viewer.bio}</p> : null}
          <p className="mt-0.5 text-xs leading-snug text-muted">
            <span className="font-semibold text-ink">{board.following}</span> {tx(locale, "關注", "Following")}
            <span className="px-1" aria-hidden>·</span>
            <span className="font-semibold text-ink">{board.followers}</span> {tx(locale, "粉絲", "Followers")}
          </p>
          <Link href="/me/settings" className="mt-1.5 inline-flex h-8 items-center rounded-full border border-line bg-card px-2.5 text-xs font-semibold">
            {tx(locale, "編輯個人檔案", "Edit profile")}
          </Link>
        </div>
      </header>
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
        viewerId={viewer.id}
      />
    </div>
  );
}
