import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { markNotifications } from "@/actions/social";
import { Icon } from "@/components/icons";

export default async function NotificationsPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/notifications");
  const rows = await prisma.notification.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const locale = prefs.locale;
  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        <h1 className="page-title mb-0 min-w-0 flex-1">{tx(locale, "通知", "Notifications")}</h1>
        <Link href="/messages" aria-label={tx(locale, "聊天", "Chat")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full active:bg-soft">
          <Icon name="messages" className="h-[18px] w-[18px]" />
        </Link>
        <form action={markNotifications}>
          <button className="px-1 text-sm font-medium">{tx(locale, "全部已讀", "Mark all read")}</button>
        </form>
      </div>
      {rows.length === 0 ? <p className="empty">{tx(locale, "未有通知。", "No notifications.")}</p> : null}
      <ul className="grid gap-2">
        {rows.map((row) => {
          const body = (
            <>
              <p className="font-medium">{row.title}</p>
              <p>{row.body}</p>
              <p className="text-xs text-muted">
                {formatHKT(row.createdAt, locale)}
                {row.readAt ? null : <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" aria-hidden />}
              </p>
            </>
          );
          return (
            <li key={row.id}>
              {row.href ? (
                <Link href={row.href} className="surface block p-3 text-sm">
                  {body}
                </Link>
              ) : (
                <div className="surface p-3 text-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
