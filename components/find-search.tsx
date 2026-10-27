"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";
import { findHref, type MemoryItem } from "@/lib/search";
import { MEMORY_EVENT, clearRecent, mergeAccount, pullAccountRecent, pushRecent, readRecent, removeRecent } from "@/lib/search-memory";

export function FindSearch({
  locale,
  initial,
  account,
  showHistory,
}: {
  locale: Locale;
  initial: string;
  account: string[];
  showHistory: boolean;
}) {
  const accountKey = account.join("\n");
  const [recent, setRecent] = useState<MemoryItem[]>(() => account.map((query) => ({ query })));

  useEffect(() => {
    const incoming = accountKey ? accountKey.split("\n").map((query) => ({ query })) : [];
    mergeAccount(incoming);
    const sync = () => setRecent(readRecent());
    sync();
    void pullAccountRecent().then(sync);
    window.addEventListener(MEMORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MEMORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [accountKey]);

  return (
    <>
      <form
        action="/find"
        role="search"
        onSubmit={(event) => {
          const query = String(new FormData(event.currentTarget).get("q") || "").trim();
          if (query) pushRecent({ query });
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={initial}
          placeholder={tx(locale, "搜尋", "Search")}
          aria-label={tx(locale, "搜尋", "Search")}
          className="field"
          autoFocus
        />
      </form>
      {showHistory && recent.length ? (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted">{tx(locale, "最近", "Recent")}</h2>
            <button type="button" className="min-h-11 px-1 text-xs text-muted" onClick={() => clearRecent()}>
              {tx(locale, "清除", "Clear")}
            </button>
          </div>
          <ul>
            {recent.map((item) => (
              <li key={item.query} className="flex items-center border-b border-line last:border-b-0">
                <Link
                  href={findHref(item.query)}
                  className="flex h-11 min-w-0 flex-1 items-center text-sm"
                  onClick={() => pushRecent({ query: item.query })}
                >
                  <span className="truncate">{item.query}</span>
                </Link>
                <button
                  type="button"
                  className="grid h-11 w-10 place-items-center text-muted"
                  aria-label={tx(locale, `移除「${item.query}」`, `Remove “${item.query}”`)}
                  onClick={() => removeRecent({ query: item.query })}
                >
                  <span className="glyph-x" aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
