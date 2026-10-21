"use client";

import { useEffect, useState } from "react";
import { tx, type Locale } from "@/lib/i18n";

export function SearchBox({ locale, initial = "" }: { locale: Locale; initial?: string }) {
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
        className="field"
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={tx(locale, "搜尋卡牌、球員、明星", "Search cards, athletes, celebrities")}
        aria-label={tx(locale, "搜尋", "Search")}
      />
      {items.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-card text-sm shadow">
          {items.map((item) => (
            <li key={item.id}>
              <a className="block px-3 py-2 hover:bg-soft" href={`/listing/${item.id}`}>
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
