import { NextResponse } from "next/server";
import { gameHasRegion, parseGame, parseRegion } from "@/lib/dex";
import { loadDexBrowse } from "@/lib/dex-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = parseGame(url.searchParams.get("game")) ?? "POKEMON";
  const region = gameHasRegion(game) ? parseRegion(url.searchParams.get("region")) : null;
  const payload = await loadDexBrowse({
    q: url.searchParams.get("q") || "",
    region,
    game,
    setId: url.searchParams.get("set") || "",
    page: Number(url.searchParams.get("page")) || 1,
  });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
