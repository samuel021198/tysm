import type { Metadata } from "next";
import { getPrefs } from "@/lib/auth";
import { gameHasRegion, parseGame, parseRegion } from "@/lib/dex";
import { loadDexBrowse } from "@/lib/dex-query";
import { DexBrowser } from "@/components/dex-browser";

export const metadata: Metadata = { title: "圖鑑" };

export default async function DexPage({ searchParams }: { searchParams: Promise<{ region?: string; game?: string; set?: string; page?: string; q?: string }> }) {
  const sp = await searchParams;
  const game = parseGame(sp.game) ?? "POKEMON";
  const region = gameHasRegion(game) ? parseRegion(sp.region) : null;
  const q = String(sp.q || "").trim().slice(0, 80);
  const prefs = await getPrefs();
  const initial = await loadDexBrowse({
    q,
    region,
    game,
    setId: String(sp.set || "").trim(),
    page: Number(sp.page) || 1,
  });
  return <DexBrowser locale={prefs.locale} initial={initial} />;
}
