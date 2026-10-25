import type { Metadata } from "next";
import Link from "next/link";
import { getPrefs } from "@/lib/auth";
import { gameHasRegion, gameParam, parseGame, parseRegion, setDisplayName, type DexGame } from "@/lib/dex";
import { hotCatalog, listDexSets, searchCatalog } from "@/lib/dex-query";
import { tx } from "@/lib/i18n";
import { DexColumns, DexRail } from "@/components/dex-rail";
import { DexGrid } from "@/components/dex-grid";
import { DexToolbar } from "@/components/dex-toolbar";

export const metadata: Metadata = { title: "圖鑑" };

function blurb(game: DexGame, locale: "zh" | "en") {
  if (game === "ONE_PIECE") return locale === "en" ? "Official One Piece cards, in Japanese and English." : "海賊王官方卡牌，日文同英文。";
  if (game === "RIFTBOUND") return locale === "en" ? "Official Riftbound cards, in English." : "Riftbound 官方卡牌，英文。";
  return locale === "en" ? "Official Pokémon cards, in Japanese and English." : "寶可夢官方卡牌，日文同英文。";
}

export default async function DexPage({ searchParams }: { searchParams: Promise<{ region?: string; game?: string; set?: string; page?: string }> }) {
  const sp = await searchParams;
  const game = parseGame(sp.game) ?? "POKEMON";
  const region = gameHasRegion(game) ? parseRegion(sp.region) : null;
  const prefs = await getPrefs();
  const sets = await listDexSets(game, region);
  const setId = String(sp.set || "").trim();
  const set = sets.find((row) => row.id === setId) ?? null;
  const page = Math.max(1, Math.min(40, Number(sp.page) || 1));
  const [{ cards, total, take }, hot] = await Promise.all([
    set ? searchCatalog({ region, game, setId: set.id, page, take: 36 }) : searchCatalog({ region, game, take: 8 }),
    set ? Promise.resolve([]) : hotCatalog(region, 12, game),
  ]);
  const seen = new Set(cards.map((card) => card.id));
  const hotCards = hot.filter((card) => !seen.has(card.id)).slice(0, 8);

  function pageHref(next: number) {
    const params = new URLSearchParams();
    params.set("game", gameParam(game));
    if (region) params.set("region", region);
    if (set) params.set("set", set.id);
    if (next > 1) params.set("page", String(next));
    return `/dex?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="page-title">{tx(prefs.locale, "圖鑑", "Dex")}</h1>
      <p className="mb-4 text-sm text-muted">{tx(prefs.locale, blurb(game, "zh"), blurb(game, "en"))}</p>
      <DexToolbar locale={prefs.locale} q="" region={region || ""} game={game} setId={set?.id} action="/dex/search" chips="/dex" />
      <DexColumns rail={<DexRail locale={prefs.locale} game={game} region={region || ""} setId={set?.id || ""} sets={sets} q="" base="/dex" />}>
        {set ? (
          <section aria-labelledby="dex-set">
            <h2 id="dex-set" className="mb-3 text-lg font-bold">
              {setDisplayName(set, set.printRegion, prefs.locale)}
            </h2>
            {cards.length === 0 ? (
              <p className="empty">{tx(prefs.locale, "呢個系列未有卡牌。", "This set has no cards yet.")}</p>
            ) : (
              <>
                <DexGrid cards={cards} locale={prefs.locale} />
                {total > take ? (
                  <nav className="mt-4 flex gap-2" aria-label={tx(prefs.locale, "頁碼", "Pages")}>
                    {page > 1 ? (
                      <Link href={pageHref(page - 1)} className="btn btn-ghost">
                        {tx(prefs.locale, "上一頁", "Previous")}
                      </Link>
                    ) : null}
                    {page * take < total ? (
                      <Link href={pageHref(page + 1)} className="btn btn-ghost">
                        {tx(prefs.locale, "下一頁", "Next")}
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )}
          </section>
        ) : cards.length === 0 ? (
          <p className="empty">{tx(prefs.locale, "圖鑑未有卡牌。請先同步目錄。", "The encyclopedia is empty. Sync the catalog first.")}</p>
        ) : (
          <>
            <section aria-labelledby="dex-recommended">
              <h2 id="dex-recommended" className="mb-3 text-lg font-bold">
                {tx(prefs.locale, "為你推薦", "For you")}
              </h2>
              <DexGrid cards={cards} locale={prefs.locale} />
            </section>
            {hotCards.length ? (
              <section className="mt-8" aria-labelledby="dex-hot">
                <h2 id="dex-hot" className="mb-3 text-lg font-bold">
                  {tx(prefs.locale, "熱門", "Popular")}
                </h2>
                <DexGrid cards={hotCards} locale={prefs.locale} />
              </section>
            ) : null}
          </>
        )}
      </DexColumns>
    </div>
  );
}
