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
 * Relative clock for a news row. This reads `updatedAt` (upsert refreshes it).
 * List order is separate: `createdAt` descending, via `compareNewsByCreatedAt` / Prisma `orderBy`.
 * Under an hour → 剛剛; under a day →「N 小時前」; the previous Hong Kong date → 昨日; older → M/D.
 */
export function newsUpdatedAgo(updatedAt: Date, now: Date, locale: Locale): string {
  const diff = now.getTime() - updatedAt.getTime();
  if (diff < HOUR_MS) return locale === "en" ? "Just now" : "剛剛";
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) {
    if (locale === "en") return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    return `${hours} 小時前`;
  }
  if (hkDayNumber(now) - hkDayNumber(updatedAt) === 1) return locale === "en" ? "Yesterday" : "昨日";
  const updated = hkParts(updatedAt);
  return `${updated.m}/${updated.d}`;
}

/** `source ·` last-write time. Pass `updatedAt`, not `createdAt`. */
export function newsSourceLine(source: string, updatedAt: Date, now: Date, locale: Locale): string {
  return `${source} · ${newsUpdatedAgo(updatedAt, now, locale)}`;
}

/** Newest ingest first. Ignores hot, eventAt, and updatedAt. */
export function compareNewsByCreatedAt(a: { createdAt: Date }, b: { createdAt: Date }): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

const POKEMON = "https://www.pokemon.com/us/pokemon-news";
const ONE_PIECE = "https://www.onepiece-cardgame.com/en/";
const RIFTBOUND = "https://riftbound.leagueoflegends.com/en-us/news/";
const TOPPS = "https://www.topps.com/";
const PANINI = "https://www.panini.com/";

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

/** Timely rows from the 2026-10-27 digest. One product per row, not one digest post. */
export const NEWS_SAMPLES: NewsSample[] = [
  {
    id: "news_riftbound_radiance",
    slug: "riftbound-radiance",
    title: "Radiance",
    source: "Riftbound",
    teaser: "已開賣",
    body: "Riftbound Radiance 已經開賣，官方商店可以購買。",
    coverUrl: null,
    brandColor: "#4338ca",
    linkUrl: RIFTBOUND,
    tag: "DATE",
    eventAt: hkMidnight("2026-10-27"),
    hot: true,
  },
  {
    id: "news_topps_five_star",
    slug: "topps-five-star-2026",
    title: "2026 Topps Five Star Baseball",
    source: "Topps",
    teaser: "EQL",
    body: "2026 Topps Five Star Baseball 於 10/28 開放 EQL。名額以官方頁為準。",
    coverUrl: null,
    brandColor: "#0f172a",
    linkUrl: TOPPS,
    tag: "DATE",
    eventAt: hkMidnight("2026-10-28"),
    hot: true,
  },
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
    id: "news_riftbound_kda",
    slug: "riftbound-kda-couture",
    title: "K/DA Couture",
    source: "Riftbound",
    teaser: "官方抽籤",
    body: "Riftbound × K/DA Couture 以官方抽籤發售，名額有限。",
    coverUrl: null,
    brandColor: "#4338ca",
    linkUrl: RIFTBOUND,
    tag: "DATE",
    eventAt: hkMidnight("2026-10-27"),
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
  {
    id: "news_op_heroines_box",
    slug: "op-heroines-precious-box",
    title: "HEROINES PRECIOUS BOX",
    source: "One Piece",
    teaser: "日本公認店限定",
    body: "HEROINES PRECIOUS BOX 為日本公認店限定，10/31。",
    coverUrl: null,
    brandColor: "#111827",
    linkUrl: ONE_PIECE,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-10-31"),
    hot: false,
  },
  {
    id: "news_pokemon_delta_reign",
    slug: "pokemon-delta-reign",
    title: "Mega Evolution—Delta Reign",
    source: "Pokémon",
    teaser: "英文",
    body: "Mega Evolution—Delta Reign 英文版，11/6。",
    coverUrl: null,
    brandColor: "#1d4ed8",
    linkUrl: POKEMON,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-11-06"),
    hot: false,
  },
  {
    id: "news_pokemon_mega_deck",
    slug: "pokemon-mega-special-deck",
    title: "スペシャルデッキセットMEGA",
    source: "Pokémon",
    teaser: "日文",
    body: "日文スペシャルデッキセットMEGA，11/13。",
    coverUrl: null,
    brandColor: "#1d4ed8",
    linkUrl: POKEMON,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-11-13"),
    hot: false,
  },
  {
    id: "news_op18",
    slug: "op-18-dominance",
    title: "OP-18 The Dominance of God",
    source: "One Piece",
    teaser: "約 11/20–11/21",
    body: "OP-18 The Dominance of God，預計約 11/20 至 11/21。",
    coverUrl: null,
    brandColor: "#111827",
    linkUrl: ONE_PIECE,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-11-20"),
    hot: false,
  },
  {
    id: "news_riftbound_gift",
    slug: "riftbound-gift-of-the-rift",
    title: "Gift of the Rift",
    source: "Riftbound",
    teaser: "12/4",
    body: "Gift of the Rift 預計 12/4。",
    coverUrl: null,
    brandColor: "#4338ca",
    linkUrl: RIFTBOUND,
    tag: "RELEASE",
    eventAt: hkMidnight("2026-12-04"),
    hot: false,
  },
  {
    id: "news_panini_prizm_wnba",
    slug: "panini-prizm-wnba",
    title: "Prizm WNBA",
    source: "Panini",
    teaser: "Coming Soon",
    body: "Panini Prizm WNBA 尚未公佈開賣日。",
    coverUrl: null,
    brandColor: "#9f1239",
    linkUrl: PANINI,
    tag: "RELEASE",
    eventAt: null,
    hot: false,
  },
];
