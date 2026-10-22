"use client";

import { useEffect, useState, type ReactNode } from "react";
import { tx, type Locale } from "@/lib/i18n";

export function SearchBox({
  locale,
  initial = "",
  autoFocus = false,
  children,
}: {
  locale: Locale;
  initial?: string;
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (q.trim().length < 1) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setItems((await res.json()) as { id: string; title: string }[]);
      } catch {
        /* aborted */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  return (
    <form action="/search" className="relative">
      <input
        className="h-12 w-full rounded-full bg-card px-4 text-base text-ink shadow-card outline-none ring-0 placeholder:text-muted focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={tx(locale, "中英文都可以，例如寶可夢 / Psyduck", "Chinese or English, e.g. 寶可夢 / Psyduck")}
        aria-label={tx(locale, "搜尋", "Search")}
        autoFocus={autoFocus}
      />
      {items.length > 0 ? (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-card py-1 text-[15px] shadow-card">
          {items.map((item) => (
            <li key={item.id}>
              <a className="block min-h-12 px-4 py-3 active:bg-soft" href={`/listing/${item.id}`}>
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </form>
  );
}
