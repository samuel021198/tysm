"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compactSetLine } from "@/lib/card-line";
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
  onFree,
  game,
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
  /** Use the typed string and drop any catalog link. */
  onFree?: (name: string) => void;
  /** Catalog game slug. Suggestions stay inside this game. */
  game?: string;
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
    setOpen(document.activeElement === inputRef.current);
    const token = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (game) params.set("game", game);
      void fetch(`/api/catalog/suggest?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { cards: [] }))
        .then((body: { cards?: CatalogHit[] }) => {
          if (token !== request.current) return;
          const cards = Array.isArray(body.cards) ? body.cards : [];
          setHits(cards);
          setOpen(document.activeElement === inputRef.current);
        })
        .catch(() => {
          if (token !== request.current) return;
          setHits([]);
          setOpen(document.activeElement === inputRef.current);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [game, value]);

  return (
    <div className="grid gap-1 text-sm">
      <label className="grid gap-1">
        {label ?? tx(locale, "標題", "Title")}
        <input
          className="field"
          name={named ? "title" : undefined}
          required={named || undefined}
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
          placeholder={placeholder ?? tx(locale, "打卡名或卡號", "Card name or number")}
          onChange={(event) => onValue(event.target.value)}
          onFocus={() => {
            if (value.trim().length >= 2 && value.trim() !== pinned.current) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && value.trim().length >= 2 ? (
        <div id={listId} className="grid max-h-80 overflow-y-auto rounded-2xl border border-line bg-card shadow-card">
          {hits.length ? (
            <ul role="listbox" aria-label={tx(locale, "卡名建議", "Card suggestions")}>
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
                    <img src={hit.imageUrl || "/demo/back.svg"} alt="" className="h-12 w-9 shrink-0 rounded-md bg-soft object-contain" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{hit.cardName || hit.title}</span>
                      <span className="block truncate text-[11px] text-muted">{compactSetLine(hit.setCode, hit.collectorNumber)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="min-h-11 w-full border-t border-line px-3 text-left text-sm text-muted"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const name = value.trim();
              pinned.current = name;
              onValue(name);
              onFree?.(name);
              setHits([]);
              setOpen(false);
            }}
          >
            {tx(locale, "搵唔到？自己入卡名", "Can't find it? Use this name")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
