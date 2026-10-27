import { getViewer } from "@/lib/auth";
import { tenorGif, type GifPick } from "@/lib/comments";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

/** Tenor search for the comment sheet. Paste still works when TENOR_API_KEY is unset. */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "login", gifs: [], configured: false }, 401);
  const key = process.env.TENOR_API_KEY?.trim();
  if (!key) return json({ gifs: [], configured: false });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
  const locale = url.searchParams.get("locale") === "en" ? "en_HK" : "zh_HK";
  const params = new URLSearchParams({
    key,
    client_key: "tysm",
    limit: "16",
    media_filter: "tinygif,gif",
    contentfilter: "medium",
    country: "HK",
    locale,
  });
  const endpoint = q ? "search" : "featured";
  if (q) params.set("q", q);

  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/${endpoint}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      console.error("tenor gif search failed", res.status);
      return json({ gifs: [], configured: true }, 502);
    }
    const data = (await res.json()) as { results?: unknown };
    const results = Array.isArray(data.results) ? data.results : [];
    const gifs: GifPick[] = [];
    for (const row of results) {
      const pick = tenorGif(row);
      if (pick) gifs.push(pick);
    }
    return json({ gifs, configured: true });
  } catch {
    console.error("tenor gif search failed");
    return json({ gifs: [], configured: true }, 502);
  }
}
