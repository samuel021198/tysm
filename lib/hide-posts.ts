// ponytail: last 60 ids in one cookie, this browser only. Upgrade path: HiddenPost rows keyed by userId.
export const HIDDEN_POSTS_COOKIE = "tysm_hidden_posts";

const MAX = 60;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function parseHiddenPostIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(-MAX);
}

export function withHiddenPost(ids: readonly string[], id: string): string[] {
  const key = id.trim();
  if (!ID.test(key)) return parseHiddenPostIds(ids.join(","));
  return parseHiddenPostIds([...ids.filter((row) => row !== key), key].join(","));
}

/** Listing suggestions use `listing-<id>` keys. Real posts are everything else. */
export function splitHiddenKeys(ids: readonly string[]): { posts: string[]; listings: string[] } {
  const posts: string[] = [];
  const listings: string[] = [];
  for (const id of ids) {
    if (id.startsWith("listing-")) listings.push(id);
    else posts.push(id);
  }
  return { posts, listings };
}
