import { normalizeTag } from "./tags";

/** Public bio ceiling. Listing descriptions keep their own limit. */
export const BIO_MAX = 400;
export const INTEREST_TAG_MAX = 8;
export const PROFILE_LINK_MAX = 3;
export const USERNAME_CHANGE_LIMIT = 2;
export const USERNAME_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const HANDOVER_PLACE_MAX = 40;

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

/** Lowercase @handle. Null when it is not 3–20 letters, digits, or _. */
export function normalizeUsername(raw: string): string | null {
  const name = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!USERNAME_RE.test(name)) return null;
  return name;
}

/** Changes whose timestamp is inside the window. A stamp exactly 30 days old is free again. */
export function usernameChangesRemaining(stamps: readonly number[], now: number): number {
  let used = 0;
  for (const stamp of stamps) {
    if (now >= stamp && now - stamp < USERNAME_CHANGE_WINDOW_MS) used += 1;
  }
  return Math.max(0, USERNAME_CHANGE_LIMIT - used);
}

export function cleanBio(raw: string): { ok: true; bio: string } | { ok: false; error: "bio" } {
  const bio = raw.trim();
  if (bio.length > BIO_MAX) return { ok: false, error: "bio" };
  return { ok: true, bio };
}

/** Door numbers and street lines. District and mall names stay allowed. */
export function looksLikeStreetAddress(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\d+\s*號/.test(text) || /[0-9０-９]+\s*(室|樓|座)/.test(text)) return true;
  if (/\b(flat|unit|floor|room|shop)\s*[a-z0-9]/i.test(text)) return true;
  if (/\b\d{1,5}[a-z]?\s+\S+\s+(street|st|road|rd|avenue|ave)\b/i.test(text)) return true;
  if (/(街|道|路|巷|里)\s*\d/.test(text) || /\d+\s*(街|道|路|巷|里)/.test(text)) return true;
  return false;
}

export function mapsSearchUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place} Hong Kong`)}`;
}

export function cleanHandoverPlace(raw: string): { ok: true; place: string | null } | { ok: false; error: "place" } {
  const place = raw.trim().replace(/\s+/g, " ");
  if (!place) return { ok: true, place: null };
  if (place.length > HANDOVER_PLACE_MAX || looksLikeStreetAddress(place)) return { ok: false, error: "place" };
  return { ok: true, place };
}

/** https link, or a place name stored as a Maps search. Street text is refused. */
export function cleanProfileLink(raw: string): string | null {
  const text = raw.trim();
  if (!text || looksLikeStreetAddress(text)) return null;
  if (/^https:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
    if (query && looksLikeStreetAddress(decodeURIComponent(query))) return null;
    return url.toString();
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  if (text.length < 2 || text.length > HANDOVER_PLACE_MAX || /[<>]/.test(text)) return null;
  return mapsSearchUrl(text);
}

export function parseProfileLinks(values: readonly string[]): { ok: true; links: string[] } | { ok: false; error: "links" | "place" } {
  const links: string[] = [];
  for (const raw of values) {
    const text = raw.trim();
    if (!text) continue;
    if (links.length >= PROFILE_LINK_MAX) return { ok: false, error: "links" };
    if (looksLikeStreetAddress(text)) return { ok: false, error: "place" };
    const link = cleanProfileLink(text);
    if (!link) return { ok: false, error: "links" };
    links.push(link);
  }
  return { ok: true, links };
}

export function profileLinkLabel(href: string): string {
  try {
    const url = new URL(href);
    if (url.hostname.includes("google.") && url.pathname.includes("/maps")) {
      const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
      const place = decodeURIComponent(query).replace(/ Hong Kong$/, "").trim();
      return place || "Google Maps";
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/** Dedicated interest field. Hashes in the bio are not read. */
export function parseInterestTags(raw: string): { ok: true; tags: string[] } | { ok: false; error: "tags" } {
  const parts = raw.split(/[\s,，]+/).map((part) => part.trim()).filter(Boolean);
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const tag = normalizeTag(part);
    if (!tag) return { ok: false, error: "tags" };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > INTEREST_TAG_MAX) return { ok: false, error: "tags" };
  return { ok: true, tags };
}

export type BioPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /https?:\/\/[^\s<>]+/gi;

/** Split a bio into text and http(s) links. `#tags` stay text. */
export function bioSegments(text: string): BioPart[] {
  const parts: BioPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ type: "text", value: text.slice(cursor, start) });
    let href = match[0];
    let trailing = "";
    while (href.length > 8 && /[.,;:!?)]+$/.test(href)) {
      trailing = href.slice(-1) + trailing;
      href = href.slice(0, -1);
    }
    const safe = /^https:\/\//i.test(href) ? href : null;
    if (safe) parts.push({ type: "link", value: href, href: safe });
    else parts.push({ type: "text", value: href });
    if (trailing) parts.push({ type: "text", value: trailing });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}
