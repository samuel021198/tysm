import type { Metadata } from "next";
import Link from "next/link";
import { getPrefs } from "@/lib/auth";
import { gameHasRegion, parseGame, parseRegion } from "@/lib/dex";
import { searchCatalog } from "@/lib/dex-query";
import { tx } from "@/lib/i18n";
import { DexGrid } from "@/components/dex-grid";
import { DexToolbar } from "@/components/dex-toolbar";

export const metadata: Metadata = { title: "圖鑑搜尋" };

export default async function DexSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; game?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const game = parseGame(sp.game) ?? "POKEMON";
  const region = gameHasRegion(game) ? parseRegion(sp.region) : null;
  const q = String(sp.q || "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(40, Number(sp.page) || 1));
  const prefs = await getPrefs();
  const filtered = Boolean(q || region || sp.game);
  const result = filtered ? await searchCatalog({ q, region, game, page, take: 24 }) : { total: 0, cards: [], page: 1, take: 24 };
  const params = new URLSearchParams();
  params.set("game", sp.game || "pokemon");
  if (q) params.set("q", q);
  if (region) params.set("region", region);

  function pageHref(next: number) {
    const copy = new URLSearchParams(params);
    if (next > 1) copy.set("page", String(next));
    const search = copy.toString();
    return search ? `/dex/search?${search}` : "/dex/search";
  }

  return (
    <div>
      <h1 className="page-title">{tx(prefs.locale, "搜尋結果", "Search results")}</h1>
      <DexToolbar locale={prefs.locale} q={q} region={region || ""} game={game} action="/dex/search" chips="/dex/search" />
      {!filtered ? (
        <p className="empty">{tx(prefs.locale, "輸入卡名或卡號。", "Enter a name or collector number.")}</p>
      ) : result.cards.length === 0 ? (
        <p className="empty">{tx(prefs.locale, "找不到相符卡牌。", "No matching cards.")}</p>
      ) : (
        <>
          <p className="mb-3 mt-5 text-sm text-muted">
            {tx(prefs.locale, `${result.total} 張卡牌`, `${result.total} cards`)}
          </p>
          <DexGrid cards={result.cards} locale={prefs.locale} />
          {result.total > result.take ? (
            <nav className="mt-5 flex gap-2" aria-label={tx(prefs.locale, "頁碼", "Pages")}>
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="btn btn-ghost">
                  {tx(prefs.locale, "上一頁", "Previous")}
                </Link>
              ) : null}
              {result.page * result.take < result.total ? (
                <Link href={pageHref(result.page + 1)} className="btn btn-ghost">
                  {tx(prefs.locale, "下一頁", "Next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
