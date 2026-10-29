import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tx } from "@/lib/i18n";
import { BIO_MAX, USERNAME_CHANGE_WINDOW_MS, usernameChangesRemaining } from "@/lib/profile-edit";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { Flash } from "@/components/shell";

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/edit");
  const since = new Date(Date.now() - USERNAME_CHANGE_WINDOW_MS);
  const changes = await prisma.usernameChange.findMany({
    where: { userId: viewer.id, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const usernameLeft = usernameChangesRemaining(changes.map((row) => row.createdAt.getTime()), Date.now());
  const locale = prefs.locale;
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href="/me" className="text-xs font-semibold text-link">{tx(locale, "返回個人頁", "Back to profile")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, "編輯個人檔案", "Edit profile")}</h1>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <ProfileEditForm
        locale={locale}
        nickname={viewer.nickname}
        username={viewer.username || ""}
        usernameLeft={usernameLeft}
        bio={(viewer.bio || "").slice(0, BIO_MAX)}
        links={viewer.profileLinks}
        handoverPlace={viewer.handoverPlace || ""}
        interestTags={viewer.interestTags.map((tag) => `#${tag}`).join(" ")}
        avatarUrl={viewer.avatarUrl}
      />
    </div>
  );
}
