import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { footprintStatusLabel, loadFootprint, openDealRows, type FootprintRow } from "@/lib/footprint";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";

const TABS = [
  { id: "open", zh: "交易中", en: "In progress" },
  { id: "sold", zh: "已出售", en: "Sold" },
  { id: "bought", zh: "已購買", en: "Bought" },
] as const;

export default async function FootprintPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/footprint");
  const tab = TABS.some((item) => item.id === sp.tab) ? sp.tab! : "open";
  const board = await loadFootprint(viewer.id);
  const locale = prefs.locale;
  const trading = openDealRows(board);
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href="/me" className="text-xs font-semibold text-link">{tx(locale, "返回個人頁", "Back to profile")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, "我的足跡", "Footprint")}</h1>
      <nav aria-label={tx(locale, "足跡", "Footprint")} className="grid grid-cols-3 border-b border-line text-sm">
        {TABS.map((item) => {
          const on = item.id === tab;
          return (
            <Link key={item.id} href={item.id === "open" ? "/me/footprint" : `/me/footprint?tab=${item.id}`} aria-current={on ? "page" : undefined} className={`grid h-11 place-items-center ${on ? "border-b-2 border-ink font-semibold" : "text-muted"}`}>
              {tx(locale, item.zh, item.en)}
            </Link>
          );
        })}
      </nav>
      {tab === "sold" ? <DealList locale={locale} rows={board.sold} empty={tx(locale, "未有紀錄。", "No records.")} /> : null}
      {tab === "bought" ? <DealList locale={locale} rows={board.bought} empty={tx(locale, "未有紀錄。", "No records.")} /> : null}
      {tab === "open" ? (
        <div className="grid gap-4">
          {trading.length ? <TradingList locale={locale} rows={trading} /> : (
            <p className="empty">
              <span className="block">{tx(locale, "未有進行中交易", "No deals in progress")}</span>
              <Link href="/find" className="block font-semibold text-ink underline underline-offset-2">
                {tx(locale, "去逛逛", "Browse")}
              </Link>
            </p>
          )}
          {board.ended.length ? (
            <details className="surface">
              <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">{tx(locale, "已結束", "Ended")} ({board.ended.length})</summary>
              <DealList locale={locale} rows={board.ended} empty="" />
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TradingList({ locale, rows }: { locale: Locale; rows: FootprintRow[] }) {
  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className="surface flex items-center gap-3 px-3 py-2">
            <img src={row.photo || "/demo/back.svg"} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-soft object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">{row.who}</span>
            </span>
            <span className="grid shrink-0 justify-items-end gap-1">
              <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{footprintStatusLabel(locale, row.kind)}</span>
              <span className="price text-sm">{formatHkd(row.priceCents, locale)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DealList({ locale, rows, empty }: { locale: Locale; rows: FootprintRow[]; empty: string }) {
  if (!rows.length) return empty ? <p className="empty">{empty}</p> : null;
  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className="surface flex items-center gap-3 px-3 py-2">
            <img src={row.photo || "/demo/back.svg"} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {formatHkd(row.priceCents, locale)} · {footprintStatusLabel(locale, row.kind)} · {formatHKT(row.at, locale)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
