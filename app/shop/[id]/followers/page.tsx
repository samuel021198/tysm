import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [prefs, viewer, seller] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.user.findUnique({ where: { id }, select: { id: true, nickname: true } }),
  ]);
  if (!seller) notFound();
  if (viewer && viewer.id !== seller.id && (await isBlocked(viewer.id, seller.id))) notFound();
  // ponytail: 80 followers. Upgrade path: keyset on Follow.createdAt.
  const rows = await prisma.follow.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { id: true, follower: { select: { id: true, nickname: true, avatarUrl: true, username: true } } },
  });
  const locale = prefs.locale;
  const back = viewer?.id === seller.id ? "/me" : `/shop/${seller.id}`;
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href={back} className="text-xs font-semibold text-link">{tx(locale, "返回個人頁", "Back to profile")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, "粉絲", "Followers")}</h1>
      {rows.length ? (
        <ul className="surface divide-y divide-line overflow-hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/shop/${row.follower.id}`} className="flex h-14 items-center gap-3 px-3">
                {row.follower.avatarUrl ? (
                  <img src={row.follower.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{row.follower.nickname.slice(0, 1)}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{row.follower.nickname}</span>
                  {row.follower.username ? <span className="block truncate text-xs text-muted">@{row.follower.username}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{tx(locale, "未有粉絲。", "No followers yet.")}</p>
      )}
    </div>
  );
}
