export const CATALOG_UA = "TYSM/1.0 (catalog ingest; +https://github.com/samuel021198/tysm)";

async function send(url: string, accept: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    headers: { accept, "user-agent": CATALOG_UA },
    signal: AbortSignal.timeout(25_000),
  });
  // ponytail: 3 tries. One Piece and Riftbound ingest is one request per set, not one per card.
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    return send(url, accept, attempt + 1);
  }
  return res;
}

export async function catalogGetJson(url: string): Promise<unknown> {
  const res = await send(url, "application/json");
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`catalog ${res.status} ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return res.json();
}

export async function catalogGetText(url: string): Promise<string> {
  const res = await send(url, "text/html");
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`catalog ${res.status} ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return res.text();
}

export function catalogStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}
