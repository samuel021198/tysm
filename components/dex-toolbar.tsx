import Link from "next/link";
import { Icon } from "./icons";
import { tx, type Locale } from "@/lib/i18n";

const REGIONS = [
  ["", "全部", "All"],
  ["JP", "日文", "Japanese"],
  ["WEST", "英文", "English"],
] as const;

function chipClass(on: boolean) {
  return on
    ? "inline-flex h-11 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]"
    : "inline-flex h-11 items-center rounded-full bg-card px-4 text-sm font-semibold text-ink shadow-card";
}

export function DexToolbar({
  locale,
  q,
  region,
  action,
  chips,
}: {
  locale: Locale;
  q: string;
  region: string;
  action: string;
  chips: string;
}) {
  const current = region === "JP" || region === "WEST" ? region : "";
  function href(nextRegion: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextRegion) params.set("region", nextRegion);
    const search = params.toString();
    return search ? `${chips}?${search}` : chips;
  }

  return (
    <div className="grid gap-3">
      <form action={action} className="flex h-14 items-center gap-2 rounded-full bg-card pl-3.5 pr-1.5 shadow-card">
        <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
        <label className="sr-only" htmlFor="dex-q">
          {tx(locale, "搜尋卡牌", "Search cards")}
        </label>
        <input
          id="dex-q"
          name="q"
          defaultValue={q}
          placeholder={tx(locale, "卡名或卡號，例如 噴火龍 或 020", "Name or number, e.g. Charizard or 020")}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-[var(--field-placeholder)]"
        />
        {current ? <input type="hidden" name="region" value={current} /> : null}
        <button className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]" type="submit">
          {tx(locale, "搜尋", "Search")}
        </button>
      </form>
      <div className="chips" aria-label={tx(locale, "篩選", "Filters")}>
        <span className={chipClass(true)}>{tx(locale, "寶可夢", "Pokémon")}</span>
        {REGIONS.map(([value, zh, en]) => (
          <Link key={value || "all"} href={href(value)} className={chipClass(current === value)} aria-current={current === value ? "page" : undefined}>
            {tx(locale, zh, en)}
          </Link>
        ))}
      </div>
    </div>
  );
}
