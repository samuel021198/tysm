"use client";

import { useEffect, useId, useRef, useState } from "react";
import { tx, type Locale } from "@/lib/i18n";

export type CatalogHit = {
  id: string;
  title: string;
  game: string;
  setName: string;
  series: string;
  cardName: string;
  language: string;
  collectorNumber: string;
  rarity: string | null;
  imageUrl: string;
  setCode?: string;
  year?: string;
};

export function CatalogTitleField({
  locale,
  value,
  onValue,
  onPick,
  invalid,
  label,
  placeholder,
  named = true,
  pinOnPick,
}: {
  locale: Locale;
  value: string;
  onValue: (value: string) => void;
  onPick: (hit: CatalogHit) => void;
  invalid?: boolean;
  label?: string;
  placeholder?: string;
  /** False when this is a card-name lookup and the listing title is a different field. */
  named?: boolean;
  pinOnPick?: (hit: CatalogHit) => string;
}) {
  const listId = useId();
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [open, setOpen] = useState(false);
  const request = useRef(0);
  const pinned = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === pinned.current) {
      setHits([]);
      setOpen(false);
      return;
    }
    const token = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalog/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { cards: [] }))
        .then((body: { cards?: CatalogHit[] }) => {
          if (token !== request.current) return;
          const cards = Array.isArray(body.cards) ? body.cards : [];
          setHits(cards);
          setOpen(cards.length > 0 && document.activeElement === inputRef.current);
        })
        .catch(() => {
          if (token !== request.current) return;
          setHits([]);
          setOpen(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  return (
    <div className="grid gap-1 text-sm">
      <label className="grid gap-1">
        {label ?? tx(locale, "標題", "Title")}
        <input
          className="field"
          name={named ? "title" : undefined}
          minLength={named ? 2 : undefined}
          maxLength={80}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          ref={inputRef}
          placeholder={placeholder ?? tx(locale, "打卡名，例如 2022 Charizard", "Card name, e.g. 2022 Charizard")}
          onChange={(event) => onValue(event.target.value)}
          onFocus={() => {
            if (hits.length) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && hits.length ? (
        <ul id={listId} role="listbox" aria-label={tx(locale, "圖鑑建議", "Dex suggestions")} className="grid max-h-80 overflow-y-auto rounded-2xl border border-line bg-card shadow-card">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                role="option"
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left active:bg-soft"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  pinned.current = (pinOnPick ?? ((row) => row.title))(hit);
                  onPick(hit);
                  setOpen(false);
                }}
              >
                <img src={hit.imageUrl || "/demo/back.svg"} alt="" className="h-12 w-9 shrink-0 rounded-md bg-[#f4efe6] object-contain" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{hit.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {hit.game} · {hit.series && hit.series !== hit.setName ? `${hit.series} · ` : ""}
                    {hit.setName} · {hit.language === "日文" ? tx(locale, "日文", "Japanese") : hit.language === "英文" ? tx(locale, "英文", "English") : hit.language}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
