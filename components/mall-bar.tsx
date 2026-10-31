"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mallHref, type MallSort, type ShopTab } from "@/lib/auction";
import { tx, type Locale } from "@/lib/i18n";

const SORTS: { id: MallSort; zh: string; en: string }[] = [
  { id: "new", zh: "最新上架", en: "Newest" },
  { id: "price_asc", zh: "價錢由低至高", en: "Price: low to high" },
  { id: "price_desc", zh: "價錢由高至低", en: "Price: high to low" },
  { id: "ending", zh: "即將結束", en: "Ending soon" },
];

const MORE: { href: string; zh: string; en: string }[] = [
  { href: "/rank", zh: "排行榜", en: "Rank" },
  { href: "/shop/recent", zh: "最近瀏覽", en: "Recently viewed" },
  { href: "/shop/watch", zh: "追蹤", en: "Watching" },
];

/** Search, sort, and more. Sits above the mall rails. Fluid row; the sheet is not a phone-width page. */
export function MallBar({
  locale,
  tab,
  q,
  sort,
}: {
  locale: Locale;
  tab: ShopTab;
  q: string;
  sort: MallSort;
}) {
  const [sheet, setSheet] = useState<"sort" | "more" | null>(null);
  const searchTab = tab === "new" || tab === "auction" ? tab : undefined;

  useEffect(() => {
    if (!sheet) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheet(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  return (
    <div className="flex min-w-0 items-center gap-2 pt-1">
      <form role="search" action="/shop" className="flex min-w-0 flex-1 items-center gap-2">
        {searchTab ? <input type="hidden" name="tab" value={searchTab} /> : null}
        {sort !== "new" ? <input type="hidden" name="sort" value={sort} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder={tx(locale, "搜尋", "Search")}
          aria-label={tx(locale, "搜尋", "Search")}
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-card px-3 text-base text-ink outline-none placeholder:text-[var(--field-placeholder)] focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-3">{tx(locale, "搜尋", "Search")}</button>
      </form>
      <button
        type="button"
        className="btn btn-ghost shrink-0 px-3"
        aria-haspopup="menu"
        aria-expanded={sheet === "sort"}
        onClick={() => setSheet("sort")}
      >
        {tx(locale, "排序", "Sort")}
      </button>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center text-lg leading-none"
        aria-label={tx(locale, "更多", "More")}
        aria-haspopup="menu"
        aria-expanded={sheet === "more"}
        onClick={() => setSheet("more")}
      >
        ⋯
      </button>
      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={() => setSheet(null)}>
          <div
            role="menu"
            aria-label={sheet === "sort" ? tx(locale, "排序", "Sort") : tx(locale, "更多", "More")}
            className="w-full border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-auto md:min-w-48 md:rounded-2xl md:pb-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {sheet === "sort"
              ? SORTS.map((row) => (
                  <Link
                    key={row.id}
                    href={mallHref({ tab: searchTab, q, sort: row.id })}
                    role="menuitem"
                    aria-current={sort === row.id ? "true" : undefined}
                    className="flex h-11 items-center px-3 text-sm font-medium"
                  >
                    {tx(locale, row.zh, row.en)}
                  </Link>
                ))
              : MORE.map((row) => (
                  <Link key={row.href} href={row.href} role="menuitem" className="flex h-11 items-center px-3 text-sm font-medium">
                    {tx(locale, row.zh, row.en)}
                  </Link>
                ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
