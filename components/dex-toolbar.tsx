"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gameHasRegion, gameParam, type DexGame } from "@/lib/dex";
import { tx, type Locale } from "@/lib/i18n";
import type { CatalogHit } from "./catalog-title-field";
import { Icon } from "./icons";

const GAMES = [
  ["POKEMON", "寶可夢", "Pokémon"],
  ["ONE_PIECE", "海賊王", "One Piece"],
  ["RIFTBOUND", "Riftbound", "Riftbound"],
] as const;

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
  game,
  action,
  chips,
}: {
  locale: Locale;
  q: string;
  region: string;
  game: DexGame;
  action: string;
  chips: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const request = useRef(0);
  const blurTimer = useRef(0);
  const current = region === "JP" || region === "WEST" ? region : "";
  const regions = gameHasRegion(game);
  const [text, setText] = useState(q);
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [prevQ, setPrevQ] = useState(q);
  const [prevRegion, setPrevRegion] = useState(current);
  const [prevGame, setPrevGame] = useState(game);

  if (prevQ !== q || prevRegion !== current || prevGame !== game) {
    setPrevQ(q);
    setPrevRegion(current);
    setPrevGame(game);
    setText(q);
    setHits([]);
    setOpen(false);
    setActive(-1);
  }

  const visible = open && hits.length > 0;
  const index = visible && active >= 0 ? Math.min(active, hits.length - 1) : -1;

  useEffect(() => {
    const query = text.trim();
    if (!focused) return;
    if (query.length < 2) {
      setHits([]);
      setOpen(false);
      setActive(-1);
      return;
    }
    const token = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, game: gameParam(game) });
      if (regions && current) params.set("region", current);
      void fetch(`/api/catalog/suggest?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { cards: [] }))
        .then((body: { cards?: CatalogHit[] }) => {
          if (token !== request.current) return;
          const cards = Array.isArray(body.cards) ? body.cards : [];
          setHits(cards);
          setActive(-1);
          setOpen(cards.length > 0 && document.activeElement === inputRef.current);
        })
        .catch((error: unknown) => {
          if (token !== request.current) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHits([]);
          setOpen(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, current, focused, game, regions]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  useEffect(() => {
    const panel = panelRef.current;
    const el = index >= 0 ? document.getElementById(`${listId}-${index}`) : null;
    if (!visible || !panel || !el) return;
    const panelRect = panel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < panelRect.top) panel.scrollTop -= panelRect.top - elRect.top;
    else if (elRect.bottom > panelRect.bottom) panel.scrollTop += elRect.bottom - panelRect.bottom;
  }, [index, visible, listId]);

  function href(next: { game?: DexGame; region?: string }) {
    const params = new URLSearchParams();
    const nextGame = next.game ?? game;
    params.set("game", gameParam(nextGame));
    if (q) params.set("q", q);
    const nextRegion = next.game && next.game !== game ? "" : (next.region ?? current);
    if (nextRegion && gameHasRegion(nextGame)) params.set("region", nextRegion);
    return `${chips}?${params.toString()}`;
  }

  const placeholder =
    game === "ONE_PIECE"
      ? tx(locale, "卡名或卡號，例如 路飛 或 OP01-001", "Name or number, e.g. Luffy or OP01-001")
      : game === "RIFTBOUND"
        ? tx(locale, "卡名或卡號，例如 Annie 或 017", "Name or number, e.g. Annie or 017")
        : tx(locale, "卡名或卡號，例如 噴火龍 或 020", "Name or number, e.g. Charizard or 020");

  function language(hit: CatalogHit) {
    if (hit.language === "日文") return tx(locale, "日文", "Japanese");
    if (hit.language === "英文") return tx(locale, "英文", "English");
    return hit.language;
  }

  return (
    <div className="grid gap-3">
      <form action={action} method="get" className="flex h-14 items-center gap-2 rounded-full bg-card pl-3.5 pr-1.5 shadow-card">
        <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
        <label className="sr-only" htmlFor="dex-q">
          {tx(locale, "搜尋卡牌", "Search cards")}
        </label>
        <input
          id="dex-q"
          name="q"
          value={text}
          ref={inputRef}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={visible ? listId : undefined}
          aria-activedescendant={index >= 0 ? `${listId}-${index}` : undefined}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-[var(--field-placeholder)]"
          onChange={(event) => {
            setText(event.target.value);
            setActive(-1);
          }}
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            setFocused(true);
            if (hits.length) setOpen(true);
          }}
          onBlur={() => {
            // Tap lands before the field blurs; closing immediately would swallow the suggestion.
            blurTimer.current = window.setTimeout(() => {
              setFocused(false);
              setOpen(false);
            }, 200);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
              return;
            }
            if (!visible) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((cursor) => (cursor + 1) % hits.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((cursor) => (cursor <= 0 ? hits.length - 1 : cursor - 1));
            } else if (event.key === "Enter" && index >= 0 && hits[index]) {
              event.preventDefault();
              router.push(`/dex/${hits[index].id}`);
            }
          }}
        />
        <input type="hidden" name="game" value={gameParam(game)} />
        {current && regions ? <input type="hidden" name="region" value={current} /> : null}
        <button className="inline-flex h-11 shrink-0 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]" type="submit">
          {tx(locale, "搜尋", "Search")}
        </button>
      </form>
      {visible ? (
        <div className="rounded-2xl bg-gradient-to-r from-rose to-teal p-px shadow-card">
          <ul id={listId} ref={panelRef} role="listbox" aria-label={tx(locale, "圖鑑建議", "Dex suggestions")} className="max-h-80 overflow-y-auto overscroll-contain rounded-[15px] bg-card py-1">
            {hits.map((hit, item) => {
              const selected = item === index;
              return (
                <li key={hit.id}>
                  <Link
                    id={`${listId}-${item}`}
                    role="option"
                    aria-selected={selected}
                    href={`/dex/${hit.id}`}
                    className={`flex min-h-16 items-center gap-3 px-3 py-2 ${selected ? "bg-gradient-to-r from-rose/30 to-teal/25" : "hover:bg-gradient-to-r hover:from-rose/20 hover:to-teal/15"}`}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <img src={hit.imageUrl || "/demo/back.svg"} alt="" className="h-14 w-10 shrink-0 rounded-md bg-[#f4efe6] object-contain" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{hit.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {hit.setName ? `${hit.setName} · ` : ""}
                        {language(hit)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="chips" aria-label={tx(locale, "遊戲", "Game")}>
        {GAMES.map(([value, zh, en]) => (
          <Link key={value} href={href({ game: value })} className={chipClass(game === value)} aria-current={game === value ? "page" : undefined}>
            {tx(locale, zh, en)}
          </Link>
        ))}
      </div>
      {regions ? (
        <div className="chips" aria-label={tx(locale, "語言", "Language")}>
          {REGIONS.map(([value, zh, en]) => (
            <Link key={value || "all"} href={href({ region: value })} className={chipClass(current === value)} aria-current={current === value ? "page" : undefined}>
              {tx(locale, zh, en)}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{tx(locale, "而家只有英文。", "English only for now.")}</p>
      )}
    </div>
  );
}
