import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";

export default async function MeSettingsPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/settings");
  const locale = prefs.locale;
  const rows: [string, string, boolean?][] = [
    ["/me/settings/notifications", tx(locale, "通知", "Notifications")],
    ["/me#promo", tx(locale, "飛", "Promo")],
    ["/me/settings/account", tx(locale, "帳號與安全", "Account and security")],
    ["/me/settings/privacy", tx(locale, "隱私", "Privacy")],
    ["/me/settings/language", tx(locale, "語言", "Language")],
    ["/me/settings/theme", tx(locale, "深淺色", "Appearance")],
    ["/me/settings/about", tx(locale, "關於／條款／免責", "About, terms, disclaimer")],
    ["/me/settings/delete", tx(locale, "刪除帳號", "Delete account"), true],
  ];
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href="/me" className="text-xs font-semibold text-link">{tx(locale, "返回個人頁", "Back to profile")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, "設定", "Settings")}</h1>
      <nav className="surface divide-y divide-line overflow-hidden">
        {rows.map(([href, label, danger]) => (
          <Link key={href} href={href} className={`flex h-11 items-center justify-between px-3 text-[13px] font-medium ${danger ? "text-danger" : ""}`}>
            {label}
            <span className="text-sm leading-none text-muted" aria-hidden>›</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
