"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { findHref, memoryKey, type MarketShow, type MemoryItem } from "@/lib/search";
import { MEMORY_EVENT, clearRecent, mergeAccount, readRecent, removeRecent } from "@/lib/search-memory";
import { SearchBox } from "./search-box";
import { SearchFilters } from "./search-filters";

export type ExploreTile = { key: string; href: string; image: string; label: string };

type Cat = { slug: string; nameZh: string; nameEn: string };

export function FindExplore({
  locale,
  initial,
  show,
  accountRecent,
  categories,
  tiles,
  children,
}: {
  locale: Locale;
  initial: string;
  show: MarketShow;
  accountRecent: string[];
  categories: Cat[];
  tiles: ExploreTile[];
  children: ReactNode;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const boxOpenRef = useRef(false);
  const holdLive = useRef(false);
  const [draft, setDraft] = useState(initial);
  const [boxOpen, setBoxOpen] = useState(false);
  const [historyHold, setHistoryHold] = useState(false);
  const typed = draft.trim();
  const mode = typed ? "results" : boxOpen || historyHold ? "history" : "grid";
  const settled = typed === initial.trim();
  boxOpenRef.current = boxOpen;

  useEffect(() => {
    if (boxOpenRef.current && !holdLive.current) return;
    setDraft(initial);
  }, [initial]);

  useEffect(() => {
    if (holdLive.current) {
      if (draft.trim() === initial.trim()) holdLive.current = false;
      return;
    }
    const next = draft.trim().slice(0, 80);
    if (next === initial.trim()) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      router.replace(next ? `${findHref(next)}&draft=1` : "/find", { scroll: false });
    }, 280);
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [draft, initial, router]);

  useEffect(() => {
    if (mode !== "history") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHistoryHold(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  useEffect(() => {
    if (mode !== "history") return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return;
      setHistoryHold(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mode]);

  return (
    <div ref={rootRef} className="grid gap-3">
      <SearchBox
        locale={locale}
        initial={initial}
        pinned
        pullAccount={false}
        accountRecent={accountRecent}
        to="find"
        show={show}
        placeholder={tx(locale, "搜尋", "Search")}
        onFocusChange={(open) => {
          setBoxOpen(open);
          if (open) setHistoryHold(true);
        }}
        onValueChange={(value) => {
          holdLive.current = false;
          setDraft(value);
        }}
        onSettle={() => {
          holdLive.current = true;
          if (timer.current != null) {
            window.clearTimeout(timer.current);
            timer.current = null;
          }
        }}
      />
      {mode === "results" && !settled ? <ResultChips locale={locale} show="all" q={typed} card="" /> : null}
      {mode === "results" && settled ? children : null}
      {mode === "history" ? (
        <div data-find-history>
          <RecentSearches locale={locale} accountRecent={accountRecent} />
          <SearchFilters
            locale={locale}
            q=""
            cat=""
            cond=""
            min=""
            sort="relevance"
            pmin=""
            pmax=""
            sale=""
            setName=""
            number=""
            categories={categories}
          />
        </div>
      ) : null}
      {mode === "grid" ? <ExploreGrid locale={locale} tiles={tiles} /> : null}
    </div>
  );
}

function ResultChips({ locale, show, q, card }: { locale: Locale; show: MarketShow; q: string; card: string }) {
  const items = [
    ["all", "全部", "All"],
    ["listing", "上架", "Listings"],
    ["post", "貼文", "Posts"],
  ] as const;
  return (
    <nav className="chips" aria-label={tx(locale, "結果類型", "Result type")}>
      {items.map(([id, zh, en]) => {
        const on = show === id;
        return (
          <Link
            key={id}
            href={findHref(q, { card: card || undefined, show: id })}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-11 items-center rounded-full px-3 text-sm leading-none ${on ? "bg-soft font-semibold text-ink" : "font-medium text-muted"}`}
          >
            {tx(locale, zh, en)}
          </Link>
        );
      })}
    </nav>
  );
}

function RecentSearches({ locale, accountRecent }: { locale: Locale; accountRecent: string[] }) {
  const [recent, setRecent] = useState<MemoryItem[]>(() => accountRecent.map((query) => ({ query })));
  useEffect(() => {
    mergeAccount(accountRecent.map((query) => ({ query })));
    const sync = () => setRecent(readRecent());
    sync();
    window.addEventListener(MEMORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MEMORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [accountRecent]);
  return (
    <section aria-label={tx(locale, "最近搜尋", "Recent searches")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{tx(locale, "最近搜尋", "Recent searches")}</h2>
        {recent.length ? (
          <button type="button" className="min-h-11 px-1 text-sm text-muted" onClick={() => clearRecent()}>
            {tx(locale, "清除", "Clear")}
          </button>
        ) : null}
      </div>
      {recent.length ? (
        <ul>
          {recent.map((item) => (
            <li key={memoryKey(item)} className="flex items-center border-b border-line last:border-b-0">
              <Link href={findHref(item.query)} className="flex min-h-11 min-w-0 flex-1 items-center text-sm">
                <span className="truncate">{item.query}</span>
              </Link>
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center text-muted"
                aria-label={tx(locale, `移除「${item.query}」`, `Remove “${item.query}”`)}
                onClick={() => removeRecent(item)}
              >
                <span className="glyph-x" aria-hidden>
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">{tx(locale, "未有最近搜尋", "No recent searches")}</p>
      )}
    </section>
  );
}

function ExploreGrid({ locale, tiles }: { locale: Locale; tiles: ExploreTile[] }) {
  if (!tiles.length) {
    return <p className="empty">{tx(locale, "未有內容。", "Nothing to explore yet.")}</p>;
  }
  return (
    <ul className="-mx-3 grid grid-cols-3 gap-px md:mx-0" data-explore-grid>
      {tiles.map((tile) => (
        <li key={tile.key} className="aspect-square bg-soft">
          <Link href={tile.href} aria-label={tile.label} className="block h-full">
            <img src={tile.image} alt="" className="h-full w-full object-cover" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
