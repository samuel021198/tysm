"use client";

import { useEffect, useRef, useState } from "react";
import { gameHasRegion, gameParam, parseGame, parseRegion, setDisplayName, type DexGame } from "@/lib/dex";
import type { DexBrowsePayload } from "@/lib/dex-query";
import { railToggle } from "@/lib/dex-rail-state";
import { tx, type Locale } from "@/lib/i18n";
import { DexColumns, DexRail } from "./dex-rail";
import { DexGrid } from "./dex-grid";
import { DexToolbar } from "./dex-toolbar";

function blurb(game: DexGame, locale: "zh" | "en") {
  if (game === "ONE_PIECE") return locale === "en" ? "Official One Piece cards, in Japanese and English." : "海賊王官方卡牌，日文同英文。";
  if (game === "RIFTBOUND") return locale === "en" ? "Official Riftbound cards, in English." : "Riftbound 官方卡牌，英文。";
  if (game === "TOPPS_BASKETBALL") return locale === "en" ? "Topps Basketball cards. English names first; pictures come later." : "Topps 籃球卡，先收英文名，圖之後再補。";
  if (game === "TOPPS_SOCCER") return locale === "en" ? "Topps Soccer cards. English names first; pictures come later." : "Topps 足球卡，先收英文名，圖之後再補。";
  if (game === "DEMO") return locale === "en" ? "Sample cards, so the dex and prices have something to show." : "示範卡牌，方便睇版面同行情。";
  return locale === "en" ? "Official Pokémon cards, in Japanese and English." : "寶可夢官方卡牌，日文同英文。";
}

function writeUrl(next: { game: DexGame; region: string; setId: string; q: string; page: number }) {
  const params = new URLSearchParams();
  params.set("game", gameParam(next.game));
  if (next.region && gameHasRegion(next.game)) params.set("region", next.region);
  if (next.setId) params.set("set", next.setId);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  const path = window.location.pathname === "/dex/search" ? "/dex/search" : "/dex";
  window.history.replaceState(null, "", `${path}?${params.toString()}`);
}

export function DexBrowser({ locale, initial }: { locale: Locale; initial: DexBrowsePayload }) {
  const [browse, setBrowse] = useState(initial);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = useRef(0);

  async function load(next: { game: DexGame; region: string; setId: string; q: string; page: number }, history = true) {
    const id = ++token.current;
    setBusy(true);
    setFailed(false);
    if (history) writeUrl(next);
    const params = new URLSearchParams();
    params.set("game", gameParam(next.game));
    if (next.region) params.set("region", next.region);
    if (next.setId) params.set("set", next.setId);
    if (next.q) params.set("q", next.q);
    if (next.page > 1) params.set("page", String(next.page));
    try {
      const res = await fetch(`/api/dex/browse?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("browse");
      const body = (await res.json()) as DexBrowsePayload;
      if (id !== token.current) return;
      setBrowse(body);
    } catch {
      if (id !== token.current) return;
      setFailed(true);
    } finally {
      if (id === token.current) setBusy(false);
    }
  }

  function onGame(next: DexGame) {
    const toggled = railToggle(browse.game, open, next);
    setOpen(toggled.open);
    if (!toggled.changed) return;
    const region = gameHasRegion(toggled.game) ? browse.region : "";
    setBrowse((current) => ({ ...current, game: toggled.game, region, setId: "", q: current.q, cards: [], hot: [], sets: [], page: 1, prompt: false }));
    void load({ game: toggled.game, region, setId: "", q: browse.q, page: 1 });
  }

  function onSet(setId: string) {
    if (setId === browse.setId) return;
    setBrowse((current) => ({ ...current, setId, page: 1 }));
    void load({ game: browse.game, region: browse.region, setId, q: browse.q, page: 1 });
  }

  function onQuery(next: { q: string; region: string }) {
    const region = gameHasRegion(browse.game) ? next.region : "";
    setBrowse((current) => ({ ...current, q: next.q, region, page: 1, prompt: false, cards: [], hot: [] }));
    void load({ game: browse.game, region, setId: browse.setId, q: next.q, page: 1 });
  }

  useEffect(() => {
    function onPop() {
      const next = browseQueryFromLocation();
      if (!next) return;
      setOpen(true);
      void load(next, false);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function onPage(page: number) {
    setBrowse((current) => ({ ...current, page }));
    void load({ game: browse.game, region: browse.region, setId: browse.setId, q: browse.q, page });
  }

  const set = browse.sets.find((row) => row.id === browse.setId) ?? null;
  const showResults = Boolean(browse.q || browse.setId);
  const pageHrefBusy = busy ? "opacity-60" : "";

  return (
    <div className="dex-fit">
      <div className="shrink-0">
        <h1 className="page-title">{browse.q ? tx(locale, "搜尋結果", "Search results") : tx(locale, "圖鑑", "Dex")}</h1>
        {browse.q ? null : <p className="mb-3 text-sm text-muted">{tx(locale, blurb(browse.game, "zh"), blurb(browse.game, "en"))}</p>}
        <DexToolbar
          locale={locale}
          q={browse.q}
          region={browse.region}
          game={browse.game}
          setId={browse.setId}
          action="/dex/search"
          chips="/dex"
          onQuery={onQuery}
        />
      </div>
      <DexColumns
        rail={<DexRail locale={locale} game={browse.game} open={open} setId={browse.setId} sets={browse.sets} onGame={onGame} onSet={onSet} />}
      >
        <div className={pageHrefBusy} aria-busy={busy}>
          {failed ? (
            <p className="empty">{tx(locale, "暫時載入唔到，請再試。", "Could not load this view. Try again.")}</p>
          ) : !browse.q && !browse.setId && browse.prompt ? (
            <p className="empty">{tx(locale, "輸入卡名或卡號。", "Enter a name or collector number.")}</p>
          ) : showResults ? (
            browse.cards.length === 0 && !busy ? (
              <p className="empty">{tx(locale, "找不到相符卡牌。", "No matching cards.")}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">
                  {set ? `${setDisplayName(set, set.printRegion, locale)} · ` : ""}
                  {tx(locale, `${browse.total} 張卡牌`, `${browse.total} cards`)}
                </p>
                <DexGrid cards={browse.cards} locale={locale} />
                {browse.total > browse.take ? (
                  <nav className="mt-4 flex gap-2" aria-label={tx(locale, "頁碼", "Pages")}>
                    {browse.page > 1 ? (
                      <button type="button" className="btn btn-ghost" onClick={() => onPage(browse.page - 1)}>
                        {tx(locale, "上一頁", "Previous")}
                      </button>
                    ) : null}
                    {browse.page * browse.take < browse.total ? (
                      <button type="button" className="btn btn-ghost" onClick={() => onPage(browse.page + 1)}>
                        {tx(locale, "下一頁", "Next")}
                      </button>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )
          ) : browse.cards.length === 0 && !busy ? (
            <p className="empty">{tx(locale, "圖鑑未有卡牌。請先同步目錄。", "The encyclopedia is empty. Sync the catalog first.")}</p>
          ) : (
            <>
              <section aria-labelledby="dex-recommended">
                <h2 id="dex-recommended" className="mb-2 text-base font-semibold">
                  {browse.game === "DEMO" ? tx(locale, "示範", "Demo") : tx(locale, "為你推薦", "For you")}
                </h2>
                <DexGrid cards={browse.cards} locale={locale} />
              </section>
              {browse.hot.length ? (
                <section className="mt-5" aria-labelledby="dex-hot">
                  <h2 id="dex-hot" className="mb-2 text-base font-semibold">
                    {tx(locale, "熱門", "Popular")}
                  </h2>
                  <DexGrid cards={browse.hot} locale={locale} />
                </section>
              ) : null}
            </>
          )}
        </div>
      </DexColumns>
    </div>
  );
}

export function browseQueryFromLocation(): { game: DexGame; region: string; setId: string; q: string; page: number } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const game = parseGame(url.searchParams.get("game")) ?? "POKEMON";
  return {
    game,
    region: gameHasRegion(game) ? parseRegion(url.searchParams.get("region")) || "" : "",
    setId: url.searchParams.get("set") || "",
    q: (url.searchParams.get("q") || "").trim().slice(0, 80),
    page: Math.max(1, Number(url.searchParams.get("page")) || 1),
  };
}
