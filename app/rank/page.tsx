import Link from "next/link";
import { RankPager } from "@/components/rank-pager";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx, type Locale } from "@/lib/i18n";
import { formatRankChange, loadRank, rankMetricLabel, rankPath, rankTab, type RankRow, type RankTab } from "@/lib/rank";
import { hiddenUserIds } from "@/lib/social";

export const metadata = { title: "排行" };

export default async function RankPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = rankTab(sp.tab);
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const rows = await loadRank(tab, prefs.locale, hidden);
  const locale = prefs.locale;

  return (
    <RankPager tab={tab} loggedIn={Boolean(viewer)}>
      <div className="mx-auto max-w-lg">
        <h1 className="sr-only">{tx(locale, "排行", "Ranking")}</h1>
        <nav aria-label={tx(locale, "排行", "Ranking")} className="grid grid-cols-3 border-b border-line">
          <Segment href={rankPath("shops")} on={tab === "shops"} label={tx(locale, "人氣商戶", "Popular shops")} />
          <Segment href={rankPath("collectors")} on={tab === "collectors"} label={tx(locale, "人氣收藏家", "Popular collectors")} />
          <Segment href={rankPath("posts")} on={tab === "posts"} label={tx(locale, "人氣貼文", "Popular posts")} />
        </nav>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{tx(locale, "暫時未有排行。", "No ranking yet.")}</p>
        ) : (
          <ul className="mt-3 grid gap-2.5">
            {rows.map((row, index) => (
              <li key={row.id}>
                <RankLink locale={locale} tab={tab} row={row} rank={index + 1} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </RankPager>
  );
}

function Segment({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`relative flex h-11 items-center justify-center whitespace-nowrap text-sm font-semibold ${on ? "text-ink" : "text-muted"}`}
    >
      {label}
      {on ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
    </Link>
  );
}

function RankLink({ locale, tab, row, rank }: { locale: Locale; tab: RankTab; row: RankRow; rank: number }) {
  const metric = rankMetricLabel(tab, row.current, locale);
  const change = formatRankChange(row.current, row.prior, locale);
  const arrow = change.tone === "up" ? "↑" : change.tone === "down" ? "↓" : "";
  const tone = change.tone === "down" ? "text-danger" : change.tone === "flat" ? "text-muted" : "text-ok";
  return (
    <Link
      href={row.href}
      aria-label={`${tx(locale, `第 ${rank} 名`, `Rank ${rank}`)} ${row.name} ${metric} ${change.text}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3 shadow-card"
    >
      <span className="relative h-14 w-14 shrink-0">
        <RankMark rank={rank} />
        {row.avatarUrl ? (
          <img src={row.avatarUrl} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-line" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-soft text-base font-semibold text-ink ring-1 ring-line">{row.name.slice(0, 1)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{row.name}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-muted">
          {metric}
          <span className={`ml-1.5 font-semibold ${tone}`}>
            {change.text}
            {arrow ? <span aria-hidden> {arrow}</span> : null}
          </span>
        </span>
        {row.tags.length ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-soft px-2 py-0.5 text-[11px] leading-4 text-muted">
                #{tag}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    const fill = rank === 1 ? "#E0B53A" : rank === 2 ? "#B7C0C8" : "#C9844A";
    return (
      <span className="absolute -left-1.5 -top-2 z-10" aria-hidden>
        <svg width="26" height="32" viewBox="0 0 26 32">
          <path d="M8 16.5h10v8.2L13 29l-5-4.3z" fill={fill} />
          <circle cx="13" cy="12" r="10" fill={fill} />
          <circle cx="13" cy="12" r="7.6" fill="none" stroke="#fff" strokeOpacity="0.7" />
          <text x="13" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
            {rank}
          </text>
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden className="absolute -left-1 -top-1 z-10 grid h-5 min-w-5 place-items-center rounded-full bg-soft px-1 text-[11px] font-semibold leading-none text-muted ring-1 ring-line">
      {rank}
    </span>
  );
}
