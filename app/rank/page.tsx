import Link from "next/link";
import { RankPager } from "@/components/rank-pager";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx, type Locale } from "@/lib/i18n";
import { formatRankChange, loadRank, rankMetricLabel, rankPath, rankTab, type RankRow, type RankTab } from "@/lib/rank";
import { hiddenUserIds } from "@/lib/social";
import { Icon } from "@/components/icons";

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
      className="flex items-center gap-2.5 rounded-2xl border border-line bg-card px-3 py-2.5 shadow-card"
    >
      <RankMark rank={rank} />
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-line" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{row.name.slice(0, 1)}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{row.name}</span>
        {row.tags.length ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-soft px-2 py-0.5 text-[11px] leading-4 text-muted">
                #{tag}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {tab === "posts" ? (
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="relative block h-[72px] w-[52px] overflow-hidden rounded-lg bg-soft ring-1 ring-line">
            {row.coverUrl ? <img src={row.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/60 py-0.5 text-[11px] font-semibold leading-none text-white">
              <Heart />
              <span className="tabular-nums">{row.current}</span>
            </span>
          </span>
          <Delta text={change.text} arrow={arrow} tone={tone} />
        </span>
      ) : (
        <span className="flex w-16 shrink-0 flex-col items-end">
          <span className={`flex items-center gap-1 font-semibold tabular-nums leading-none ${tab === "shops" ? "text-xl" : "text-[15px]"}`}>
            {tab === "shops" ? <Icon name="bag" className="h-5 w-5" /> : <Heart className="h-4 w-4 text-danger" />}
            {row.current}
          </span>
          <Delta text={change.text} arrow={arrow} tone={tone} />
        </span>
      )}
    </Link>
  );
}

function Delta({ text, arrow, tone }: { text: string; arrow: string; tone: string }) {
  return (
    <span className={`text-[11px] font-semibold leading-4 ${tone}`}>
      {text}
      {arrow ? <span aria-hidden> {arrow}</span> : null}
    </span>
  );
}

function Heart({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 19.2s-6.2-3.9-6.2-8.1A3.4 3.4 0 0 1 12 8.6a3.4 3.4 0 0 1 6.2 2.5c0 4.2-6.2 8.1-6.2 8.1z" />
    </svg>
  );
}

function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    const fill = rank === 1 ? "#E0B53A" : rank === 2 ? "#B7C0C8" : "#C9844A";
    return (
      <span className="grid w-7 shrink-0 place-items-center" aria-hidden>
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
    <span aria-hidden className="grid w-7 shrink-0 place-items-center text-sm font-semibold tabular-nums text-muted">
      {rank}
    </span>
  );
}
