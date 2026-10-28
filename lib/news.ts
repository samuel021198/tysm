import type { Locale } from "./i18n";

export type NewsTag = "RELEASE" | "RESTOCK" | "DATE";

export type NewsSample = {
  id: string;
  slug: string;
  title: string;
  source: string;
  teaser: string;
  body: string;
  coverUrl: string | null;
  brandColor: string;
  linkUrl: string;
  tag: NewsTag;
  eventAt: Date | null;
  hot: boolean;
};

/** Hong Kong midnight for a `YYYY-MM-DD` calendar day. */
export function hkMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function hkParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: n("year"), m: n("month"), d: n("day") };
}

const HOUR_MS = 60 * 60 * 1000;

function hkDayNumber(date: Date): number {
  const { y, m, d } = hkParts(date);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Instant the list sorts and stamps by: source time when we have it, otherwise ingest time.
 * `createdAt` is required, so this is never null — the same key as `COALESCE("eventAt", "createdAt")`.
 * Accepts a Date or an ISO string so a raw list query can feed the stamp without a second parse step.
 */
export function newsSortAt(row: { eventAt: Date | string | null; createdAt: Date | string }): Date {
  return new Date(row.eventAt ?? row.createdAt);
}

/**
 * Relative clock for a source instant (`newsSortAt`).
 * Future → M/D; under an hour → 剛剛; under a day →「N 小時前」; the previous Hong Kong date → 昨日; older → M/D.
 */
export function newsUpdatedAgo(at: Date, now: Date, locale: Locale): string {
  const diff = now.getTime() - at.getTime();
  if (diff < 0) {
    const when = hkParts(at);
    return `${when.m}/${when.d}`;
  }
  if (diff < HOUR_MS) return locale === "en" ? "Just now" : "剛剛";
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) {
    if (locale === "en") return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    return `${hours} 小時前`;
  }
  if (hkDayNumber(now) - hkDayNumber(at) === 1) return locale === "en" ? "Yesterday" : "昨日";
  const when = hkParts(at);
  return `${when.m}/${when.d}`;
}

/** `source ·` the sort instant. Pass `newsSortAt(row)`, not `updatedAt`. */
export function newsSourceLine(source: string, at: Date, now: Date, locale: Locale): string {
  return `${source} · ${newsUpdatedAgo(at, now, locale)}`;
}

const TRAILING_SOURCE = /(?:^|\n)Source:[ \t]*(https:\/\/\S+)\s*$/;

function httpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Detail body, plus the one outbound URL.
 * A trailing `Source: https://…` line is lifted out of the copy. If the body has no such line, an https `linkUrl` is that URL instead.
 */
export function newsDetailCopy(body: string, linkUrl?: string | null): { copy: string; sourceUrl: string | null } {
  const match = TRAILING_SOURCE.exec(body);
  if (match?.index !== undefined && httpsUrl(match[1])) {
    return { copy: body.slice(0, match.index).replace(/\n+$/, ""), sourceUrl: match[1] };
  }
  const fallback = linkUrl && httpsUrl(linkUrl) ? linkUrl : null;
  return { copy: fallback ? body.replace(/\n+$/, "") : body, sourceUrl: fallback };
}

/** Newest source time first. Ignores hot and updatedAt. Null `eventAt` uses `createdAt`. */
export function compareNewsByEventAt(a: { eventAt: Date | null; createdAt: Date }, b: { eventAt: Date | null; createdAt: Date }): number {
  return newsSortAt(b).getTime() - newsSortAt(a).getTime();
}

const POKEMON = "https://www.pokemon.com/us/pokemon-news";
const ONE_PIECE = "https://www.onepiece-cardgame.com/en/";
const TOPPS = "https://www.topps.com/";

/** Official source marks. Used when a row has no product cover. */
export const NEWS_BRAND_LOGOS = {
  Topps: "/brands/topps.svg",
  Pokémon: "/brands/pokemon.jpg",
  "One Piece": "/brands/one-piece.png",
  Riftbound: "/brands/riftbound.png",
  Panini: "/brands/panini.png",
} as const;

export function newsBrandLogo(source: string): string | null {
  if (source in NEWS_BRAND_LOGOS) return NEWS_BRAND_LOGOS[source as keyof typeof NEWS_BRAND_LOGOS];
  return null;
}

/** Formal rows still written by reseed. Junk stubs are removed through DELETE /api/internal/news. */
export const NEWS_SAMPLES: NewsSample[] = [
  {
    id: "news_topps_chrome_tennis",
    slug: "chrome-tennis-sapphire",
    title: "Chrome Tennis Sapphire",
    source: "Topps",
    teaser: "EQL",
    body: "Chrome Tennis Sapphire 於 10/28 進行 EQL。",
    coverUrl: null,
    brandColor: "#0f172a",
    linkUrl: TOPPS,
    tag: "DATE",
    eventAt: hkMidnight("2026-10-28"),
    hot: true,
  },
  {
    id: "news_pokemon_30th_deck",
    slug: "pokemon-30th-battle-deck",
    title: "30th Celebration Battle Deck（Espeon／Umbreon ex）",
    source: "Pokémon",
    teaser: "英文",
    body: "30 週年 Battle Deck，Espeon 與 Umbreon ex，英文版 10/30。",
    coverUrl: null,
    brandColor: "#1d4ed8",
    linkUrl: POKEMON,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-10-30"),
    hot: false,
  },
  {
    id: "news_op_eb05",
    slug: "op-eb05-heroines",
    title: "EXTRA BOOSTER Heroines Edition vol.2（EB-05）",
    source: "One Piece",
    teaser: "EB-05",
    body: "EXTRA BOOSTER Heroines Edition vol.2，編號 EB-05，10/31。",
    coverUrl: null,
    brandColor: "#111827",
    linkUrl: ONE_PIECE,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-10-31"),
    hot: false,
  },
];
