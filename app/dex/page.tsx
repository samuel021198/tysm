import type { Metadata } from "next";
import { getPrefs } from "@/lib/auth";
import { parseRegion } from "@/lib/dex";
import { hotCatalog, searchCatalog } from "@/lib/dex-query";
import { tx } from "@/lib/i18n";
import { DexGrid } from "@/components/dex-grid";
import { DexToolbar } from "@/components/dex-toolbar";

export const metadata: Metadata = { title: "圖鑑" };

export default async function DexPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const sp = await searchParams;
  const region = parseRegion(sp.region);
  const prefs = await getPrefs();
  const [{ cards }, hot] = await Promise.all([searchCatalog({ region, take: 8 }), hotCatalog(region, 12)]);
  const seen = new Set(cards.map((card) => card.id));
  const hotCards = hot.filter((card) => !seen.has(card.id)).slice(0, 8);

  return (
    <div>
      <h1 className="page-title">{tx(prefs.locale, "圖鑑", "Dex")}</h1>
      <p className="mb-4 text-sm text-muted">{tx(prefs.locale, "寶可夢官方卡牌，日文同英文。", "Official Pokémon cards, in Japanese and English.")}</p>
      <DexToolbar locale={prefs.locale} q="" region={region || ""} action="/dex/search" chips="/dex" />
      {cards.length === 0 ? (
        <p className="empty">{tx(prefs.locale, "圖鑑未有卡牌。請先同步目錄。", "The encyclopedia is empty. Sync the catalog first.")}</p>
      ) : (
        <>
          <section className="mt-6" aria-labelledby="dex-recommended">
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
    </div>
  );
}
