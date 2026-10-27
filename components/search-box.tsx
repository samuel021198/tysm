"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { compactSetLine } from "@/lib/card-line";
import { tx, type Locale } from "@/lib/i18n";
import {
  buildSuggestRows,
  memoryKey,
  suggestPanelDismiss,
  type MemoryItem,
  type SuggestCard,
  type SuggestCategory,
  type SuggestListing,
  type SuggestRow,
} from "@/lib/search";
import type { CatalogHit } from "./catalog-title-field";
import {
  MEMORY_EVENT,
  clearRecent,
  mergeAccount,
  pullAccountRecent,
  pushRecent,
  pushSaved,
  readRecent,
  readSaved,
  removeRecent,
  removeSaved,
  writeSaved,
} from "@/lib/search-memory";
import { Icon } from "./icons";

const NO_RECENT: string[] = [];

function mobileSheet() {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function SearchBox({
  locale,
  initial = "",
  autoFocus = false,
  rememberVisit = false,
  pullAccount = true,
  accountRecent = NO_RECENT,
  scope = null,
  to = "find",
  show = "all",
}: {
  locale: Locale;
  initial?: string;
  autoFocus?: boolean;
  rememberVisit?: boolean;
  pullAccount?: boolean;
  accountRecent?: string[];
  scope?: { slug: string; nameZh: string; nameEn: string } | null;
  /** Header search is universal. The market page keeps listing filters on `/search`. */
  to?: "find" | "search";
  /** Result chip on `/search`. A new query keeps 上架 or 貼文. */
  show?: "all" | "listing" | "post";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [narrow, setNarrow] = useState(false);
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(autoFocus);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<"recent" | "saved">("recent");
  const [recent, setRecent] = useState<MemoryItem[]>(() => accountRecent.map((query) => ({ query })));
  const [saved, setSaved] = useState<MemoryItem[]>([]);
  const [pack, setPack] = useState<{ q: string; listings: SuggestListing[]; categories: SuggestCategory[]; cards: SuggestCard[] }>({
    q: "",
    listings: [],
    categories: [],
    cards: [],
  });
  const query = q.trim();
  const suggestions = pack.q === query ? pack : { q: query, listings: [], categories: [], cards: [] };
  const rows = buildSuggestRows({
    query,
    recent,
    saved,
    tab,
    listings: suggestions.listings,
    categories: suggestions.categories,
    cards: suggestions.cards,
    to,
  });
  const index = rows.length ? Math.min(active, rows.length - 1) : -1;

  useEffect(() => {
    alive.current = true;
    const sync = () => {
      setRecent(readRecent());
      setSaved(readSaved());
    };
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener(MEMORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      alive.current = false;
      mq.removeEventListener("change", apply);
      window.removeEventListener(MEMORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    mergeAccount(accountRecent.map((entry) => ({ query: entry })));
    setSaved(readSaved());
    if (pullAccount) void pullAccountRecent();
  }, [accountRecent, pullAccount]);

  useEffect(() => {
    if (!rememberVisit || !initial.trim()) return;
    pushRecent({
      query: initial,
      cat: scope?.slug,
      catZh: scope?.nameZh,
      catEn: scope?.nameEn,
    });
  }, [rememberVisit, initial, scope?.slug, scope?.nameZh, scope?.nameEn]);

  useEffect(() => {
    setQ(initial);
    if (initial.trim()) setOpen(false);
    else if (autoFocus) setOpen(true);
  }, [initial, autoFocus]);

  useEffect(() => {
    if (!open || !narrow) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(id);
  }, [open, narrow]);

  useEffect(() => {
    if (!open || query.length < 1) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const suggestUrl = `/api/suggest?q=${encodeURIComponent(query)}`;
        const catalogUrl = query.length >= 2 ? `/api/catalog/suggest?q=${encodeURIComponent(query)}` : "";
        const [suggestRes, catalogRes] = await Promise.all([
          fetch(suggestUrl, { signal: ctrl.signal }),
          catalogUrl ? fetch(catalogUrl, { signal: ctrl.signal }) : Promise.resolve(null),
        ]);
        const data = suggestRes.ok
          ? ((await suggestRes.json()) as { listings?: SuggestListing[]; categories?: SuggestCategory[] })
          : { listings: [], categories: [] };
        let cards: SuggestCard[] = [];
        if (catalogRes?.ok) {
          const body = (await catalogRes.json()) as { cards?: CatalogHit[] };
          cards = (body.cards ?? []).map((card) => ({
            id: card.id,
            label: card.cardName || card.title,
            imageUrl: card.imageUrl,
            hint: compactSetLine(card.setCode, card.collectorNumber),
          }));
        }
        if (!suggestRes.ok && !catalogRes?.ok) return;
        setPack({ q: query, listings: data.listings ?? [], categories: data.categories ?? [], cards });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const opened = Date.now();
    const onScroll = (event: Event) => {
      if (Date.now() - opened < 400) return;
      const target = event.target;
      const insidePanel = target instanceof Node && !!panelRef.current?.contains(target);
      if (suggestPanelDismiss("scroll", { mobileSheet: mobileSheet(), insidePanel, focusInside: true })) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [open]);

  useEffect(() => {
    if (!open || !mobileSheet()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (event.key !== "Tab" || !mobileSheet()) return;
      const root = rootRef.current;
      if (!root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>("a[href], button, input")].filter((el) => !el.hasAttribute("disabled"));
      if (nodes.length < 2) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, rows.length, tab]);

  useEffect(() => {
    const panel = panelRef.current;
    const el = index >= 0 ? document.getElementById(`${listId}-${index}`) : null;
    if (!open || !panel || !el) return;
    const panelRect = panel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < panelRect.top) panel.scrollTop -= panelRect.top - elRect.top;
    else if (elRect.bottom > panelRect.bottom) panel.scrollTop += elRect.bottom - panelRect.bottom;
  }, [index, open, listId, rows.length]);

  const pathRef = useRef(pathname);
  useEffect(() => {
    if (pathRef.current !== pathname) {
      pathRef.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  function close() {
    setOpen(false);
    inputRef.current?.blur();
  }

  function activate(row: SuggestRow) {
    if (row.query) {
      pushRecent({ query: row.query, cat: row.cat, catZh: row.catZh, catEn: row.catEn });
    }
    setOpen(false);
    router.push(row.href);
  }

  function hint(row: SuggestRow) {
    return locale === "en" ? row.hintEn : row.hintZh;
  }

  const emptyCopy =
    tab === "saved"
      ? tx(locale, "未有已儲存搜尋。搜尋後可以按「儲存搜尋」。", "No saved searches yet. Save one from your results.")
      : tx(locale, "未有最近搜尋", "No recent searches");

  return (
    <div className={open ? "max-md:h-12" : undefined}>
      <div
        ref={rootRef}
        role={open && narrow ? "dialog" : undefined}
        aria-modal={open && narrow ? true : undefined}
        aria-label={open ? tx(locale, "搜尋", "Search") : undefined}
        className={
          open
            ? "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:flex-col max-md:bg-bg max-md:px-3 max-md:pb-[env(safe-area-inset-bottom)] max-md:pt-[max(0.75rem,env(safe-area-inset-top))] md:relative"
            : "relative"
        }
      >
        <form
          role="search"
          action={to === "search" ? "/search" : "/find"}
          className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col"
          onSubmit={(event) => {
            if (!query) {
              event.preventDefault();
              return;
            }
            pushRecent({ query });
            if (suggestPanelDismiss("submit", { mobileSheet: mobileSheet(), insidePanel: false, focusInside: false })) setOpen(false);
          }}
        >
          {to === "search" && (show === "listing" || show === "post") ? <input type="hidden" name="show" value={show} /> : null}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-9 text-base text-ink shadow-none outline-none ring-0 placeholder:text-[var(--field-placeholder)] focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]"
                name="q"
                value={q}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && index >= 0 ? `${listId}-${index}` : undefined}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                autoFocus={autoFocus}
                placeholder={
                  to === "search"
                    ? tx(locale, "搜尋上架或標價貼文", "Search listings or priced posts")
                    : tx(locale, "搜尋任何物品", "Search for anything")
                }
                aria-label={tx(locale, "搜尋", "Search")}
                onFocus={() => {
                  setRecent(readRecent());
                  setSaved(readSaved());
                  setOpen(true);
                }}
                onClick={() => setOpen(true)}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  const immediate = next instanceof Node && !!rootRef.current?.contains(next);
                  window.setTimeout(() => {
                    if (!alive.current) return;
                    const activeEl = document.activeElement;
                    const focusInside = immediate || (activeEl instanceof Node && !!rootRef.current?.contains(activeEl));
                    if (suggestPanelDismiss("blur", { mobileSheet: mobileSheet(), insidePanel: false, focusInside })) setOpen(false);
                  }, 0);
                }}
                onChange={(event) => {
                  setQ(event.target.value);
                  setActive(0);
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setOpen(true);
                    if (!rows.length) return;
                    setActive((current) => {
                      const at = Math.min(current, rows.length - 1);
                      return event.key === "ArrowDown" ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
                    });
                    return;
                  }
                  if (event.key === "Enter" && open && index >= 0 && rows[index].kind !== "query") {
                    event.preventDefault();
                    activate(rows[index]);
                  }
                }}
              />
              {q ? (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted"
                  aria-label={tx(locale, "清除文字", "Clear text")}
                  onClick={() => {
                    setQ("");
                    setActive(0);
                    inputRef.current?.focus();
                  }}
                >
                  <span className="glyph-x" aria-hidden>×</span>
                </button>
              ) : null}
            </div>
            {open ? (
              <button type="button" className="min-h-12 min-w-11 shrink-0 px-2 text-[15px] font-medium text-link md:hidden" onClick={close}>
                {tx(locale, "取消", "Cancel")}
              </button>
            ) : null}
          </div>
          {open ? (
            <div
              ref={panelRef}
              className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain md:absolute md:left-0 md:right-0 md:z-30 md:mt-2 md:max-h-[min(70vh,28rem)] md:rounded-2xl md:bg-card md:py-1 md:shadow-card"
            >
              {query ? null : (
                <div className="flex items-end justify-between border-b border-line px-1 md:px-4">
                  <div role="tablist" aria-label={tx(locale, "搜尋紀錄", "Search history")} className="flex gap-6">
                    {(
                      [
                        ["recent", tx(locale, "最近", "Recent")],
                        ["saved", tx(locale, "已儲存", "Saved")],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className={`relative inline-flex min-h-10 items-center text-sm font-semibold leading-none ${tab === id ? "text-ink" : "text-muted"}`}
                        onClick={() => {
                          setTab(id);
                          setActive(0);
                        }}
                      >
                        {label}
                        {tab === id ? <span className="absolute inset-x-0 bottom-0 h-px rounded-full bg-accent" /> : null}
                      </button>
                    ))}
                  </div>
                  {(tab === "saved" ? saved : recent).length ? (
                    <button
                      type="button"
                      className="min-h-12 px-1 text-sm text-muted"
                      onClick={() => {
                        if (tab === "saved") writeSaved([]);
                        else clearRecent();
                        setActive(0);
                      }}
                    >
                      {tx(locale, "清除", "Clear")}
                    </button>
                  ) : null}
                </div>
              )}
              {rows.length ? (
                <div id={listId} role="listbox" aria-label={tx(locale, "搜尋建議", "Search suggestions")}>
                  {rows.map((row, rowIndex) => {
                    const subtitle = hint(row);
                    const selected = rowIndex === index;
                    const thumb = row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className="mr-3 h-12 w-9 shrink-0 rounded-md bg-soft object-contain" />
                    ) : null;
                    const body = (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] leading-snug">{row.label}</span>
                        {subtitle ? <span className="block truncate text-[13px] leading-snug text-muted">{subtitle}</span> : null}
                      </span>
                    );
                    const rowClass = `flex ${row.imageUrl ? "min-h-16" : "min-h-11"} min-w-0 flex-1 items-center px-1 py-2 text-left hover:bg-soft md:px-4`;
                    return (
                      <div
                        key={row.key}
                        id={`${listId}-${rowIndex}`}
                        role="option"
                        aria-selected={selected}
                        className={`flex items-stretch border-b border-line last:border-b-0 ${selected ? "bg-soft" : ""}`}
                      >
                        {row.kind === "query" ? (
                          <button type="submit" className={rowClass}>
                            {thumb}
                            {body}
                          </button>
                        ) : (
                          <Link
                            href={row.href}
                            className={rowClass}
                            onClick={() => {
                              if (row.query) pushRecent({ query: row.query, cat: row.cat, catZh: row.catZh, catEn: row.catEn });
                            setOpen(false);
                          }}
                        >
                          {thumb}
                          {body}
                        </Link>
                        )}
                        {row.kind === "memory" ? (
                          <button
                            type="button"
                            className="grid w-10 shrink-0 place-items-center text-muted hover:text-ink"
                            aria-label={tx(locale, `移除「${row.label}」`, `Remove “${row.label}”`)}
                            onClick={() => {
                              const item = { query: row.query || row.label, cat: row.cat, catZh: row.catZh, catEn: row.catEn };
                              if (!query && tab === "saved") removeSaved(item);
                              else removeRecent(item);
                            }}
                          >
                            <span className="glyph-x" aria-hidden>×</span>
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-muted">{emptyCopy}</p>
              )}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function SaveSearchButton({
  locale,
  query,
  cat,
  catZh,
  catEn,
}: {
  locale: Locale;
  query: string;
  cat?: string;
  catZh?: string;
  catEn?: string;
}) {
  const item = { query, cat: cat || undefined, catZh, catEn };
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(readSaved().some((row) => memoryKey(row) === memoryKey(item)));
    sync();
    window.addEventListener(MEMORY_EVENT, sync);
    return () => window.removeEventListener(MEMORY_EVENT, sync);
  }, [item.query, item.cat, item.catZh, item.catEn]);
  if (!query.trim()) return null;
  return (
    <button
      type="button"
      className="min-h-11 shrink-0 text-sm font-semibold text-link"
      aria-pressed={on}
      onClick={() => {
        if (on) removeSaved(item);
        else pushSaved(item);
      }}
    >
      {on ? tx(locale, "已儲存", "Saved") : tx(locale, "儲存搜尋", "Save search")}
    </button>
  );
}
