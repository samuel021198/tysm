import { redirect } from "next/navigation";
import { markNotifications, openNotification } from "@/actions/social";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import { InboxHub } from "@/components/inbox-hub";

export default async function NotificationsPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/notifications");
  const rows = await prisma.notification.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const locale = prefs.locale;
  const now = new Date();
  return (
    <div>
      <InboxHub locale={locale} tab="notes" />
      <div className="mb-3 flex items-center gap-1">
        <h1 className="page-title mb-0 min-w-0 flex-1">{tx(locale, "通知", "Notifications")}</h1>
        <form action={markNotifications}>
          <button className="px-1 text-sm font-medium">{tx(locale, "全部已讀", "Mark all read")}</button>
        </form>
      </div>
      {rows.length === 0 ? <p className="empty">{tx(locale, "暫時未有通知", "No notifications yet")}</p> : null}
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <form action={openNotification}>
              <input type="hidden" name="id" value={row.id} />
              <button className="surface block w-full p-3 text-left text-sm">
                <p className="font-medium">{row.title}</p>
                <p>{row.body}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  {row.readAt ? null : (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  )}
                  {row.readAt ? null : <span className="sr-only">{tx(locale, "未讀", "Unread")}</span>}
                  <span>{relativeTime(row.createdAt, now, locale)}</span>
                </p>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
