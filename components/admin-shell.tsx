import Link from "next/link";
import { logout } from "@/actions/auth";
import { adminTab, type AdminTab } from "@/lib/admin-desk";
import { tx, type Locale } from "@/lib/i18n";

const NAV: { id: AdminTab; zh: string; en: string }[] = [
  { id: "users", zh: "用戶", en: "Users" },
  { id: "applications", zh: "申請", en: "Applications" },
  { id: "listings", zh: "貨品", en: "Listings" },
  { id: "reports", zh: "舉報", en: "Reports" },
  { id: "disputes", zh: "爭議", en: "Disputes" },
  { id: "categories", zh: "品類", en: "Categories" },
];

export function AdminShell({
  locale,
  name,
  tab,
  counts,
  children,
}: {
  locale: Locale;
  name: string;
  tab: string;
  counts: { applications: number; reports: number; disputes: number };
  children: React.ReactNode;
}) {
  const current = adminTab(tab);
  return (
    <div className="admin-shell min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 text-sm">
          <p className="font-display font-semibold tracking-wide">TSM 管理</p>
          <p className="font-medium">{name}</p>
          <p className="text-muted">
            {tx(
              locale,
              `申請 ${counts.applications} · 舉報 ${counts.reports} · 爭議 ${counts.disputes}`,
              `Applications ${counts.applications} · Reports ${counts.reports} · Disputes ${counts.disputes}`,
            )}
          </p>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/" className="text-link">{tx(locale, "返回前台", "Storefront")}</Link>
            <form action={logout}>
              <button className="text-link">{tx(locale, "登出", "Log out")}</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl overflow-x-auto px-2">
          {NAV.map((item) => {
            const on = item.id === current;
            return (
              <Link
                key={item.id}
                href={`/admin?tab=${item.id}`}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm ${on ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
                aria-current={on ? "page" : undefined}
              >
                {tx(locale, item.zh, item.en)}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-3 py-4">{children}</div>
    </div>
  );
}
