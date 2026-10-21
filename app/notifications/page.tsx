import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { markNotifications } from "@/actions/social";

export default async function NotificationsPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/notifications");
  const rows = await prisma.notification.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{tx(prefs.locale, "通知", "Notifications")}</h1>
        <form action={markNotifications}><button className="text-sm underline">{tx(prefs.locale, "全部已讀", "Mark all read")}</button></form>
      </div>
      {rows.length === 0 ? <p>{tx(prefs.locale, "未有通知。", "No notifications.")}</p> : null}
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id} className="surface p-4 text-sm">
            <p className="font-medium">{row.title}</p>
            <p>{row.body}</p>
            <p className="text-xs text-muted">{formatHKT(row.createdAt, prefs.locale)} {row.readAt ? "" : "· new"}</p>
            {row.href ? <Link href={row.href} className="text-link">{tx(prefs.locale, "打開", "Open")}</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
