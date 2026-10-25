const ORIGIN = "https://api.tcgdex.net/v2";
const UA = "TYSM/1.0 (catalog; +https://github.com/samuel021198/tysm)";
const TTL = 24 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; text: string | null }>();

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** TCGdex `description` is the printed flavor line. Missing on most Japanese cards. */
export function flavorFromCard(raw: unknown): string | null {
  const obj = asRecord(raw);
  const text = obj && typeof obj.description === "string" ? obj.description.trim() : "";
  if (text.length < 8) return null;
  return text;
}

export async function catalogFlavor(externalId: string, game: string): Promise<string | null> {
  if (game !== "POKEMON") return null;
  const match = /^(en|ja):([^/]+)$/.exec(externalId.trim());
  if (!match) return null;
  const key = externalId.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.text;
  let text: string | null = null;
  try {
    const res = await fetch(`${ORIGIN}/${match[1]}/cards/${match[2]}`, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 86_400 },
    });
    if (res.ok) text = flavorFromCard(await res.json());
  } catch {
    text = null;
  }
  cache.set(key, { at: Date.now(), text });
  return text;
}
