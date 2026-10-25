import type { Metadata } from "next";
import { getPrefs } from "@/lib/auth";
import { gameHasRegion, parseGame, parseRegion } from "@/lib/dex";
import { loadDexBrowse } from "@/lib/dex-query";
import { DexBrowser } from "@/components/dex-browser";

export const metadata: Metadata = { title: "圖鑑搜尋" };

export default async function DexSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; game?: string; set?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const game = parseGame(sp.game) ?? "POKEMON";
  const region = gameHasRegion(game) ? parseRegion(sp.region) : null;
  const q = String(sp.q || "").trim().slice(0, 80);
  const setId = String(sp.set || "").trim();
  const prefs = await getPrefs();
  const initial = await loadDexBrowse({
    q,
    region,
    game,
    setId,
    page: Number(sp.page) || 1,
    prompt: !q && !setId,
  });
  return <DexBrowser locale={prefs.locale} initial={initial} />;
}
