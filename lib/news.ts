import type { Locale } from "./i18n";
import { relativeTime } from "./time";

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

/**
 * Instant the list sorts and stamps by: source time when we have it, otherwise ingest time.
 * `createdAt` is required, so this is never null — the same key as `COALESCE("eventAt", "createdAt")`.
 * Accepts a Date or an ISO string so a raw list query can feed the stamp without a second parse step.
 */
export function newsSortAt(row: { eventAt: Date | string | null; createdAt: Date | string }): Date {
  return new Date(row.eventAt ?? row.createdAt);
}

/** Relative clock for a source instant (`newsSortAt`). Same buckets as posts and listings. */
export function newsUpdatedAgo(at: Date, now: Date, locale: Locale): string {
  return relativeTime(at, now, locale);
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

const NEWS_FIELD_KEYS = new Set([
  "產品",
  "產品詳情",
  "售價",
  "預訂/購買日期",
  "預計出貨日",
  "拍品",
  "成交價",
  "評級",
  "編號",
  "成交日期",
  "拍賣場",
  "備註",
  "product",
  "item",
  "product details",
  "details",
  "price",
  "preorder/purchase date",
  "pre-order/purchase date",
  "pre-order date",
  "preorder date",
  "purchase date",
  "release date",
  "expected ship date",
  "ship date",
  "lot",
  "sale price",
  "hammer price",
  "sold for",
  "grade",
  "number",
  "cert",
  "serial",
  "sale date",
  "date sold",
  "auction house",
  "notes",
  "remarks",
]);

const NEWS_PRICE_KEYS = new Set(["售價", "成交價", "price", "sale price", "hammer price", "sold for"]);

const NEWS_LINK_KEYS = new Set(["相關連結", "相關鏈接", "相關链接", "related link", "related links", "link", "source"]);

function normNewsLabel(label: string): string {
  return label.trim().toLowerCase().replace(/／/g, "/").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function knownNewsLabel(label: string): boolean {
  const norm = normNewsLabel(label);
  if (!norm || NEWS_LINK_KEYS.has(norm)) return false;
  if (NEWS_FIELD_KEYS.has(norm)) return true;
  const parts = norm.split("/");
  return parts.length > 1 && parts.every((part) => NEWS_FIELD_KEYS.has(part));
}

function priceNewsLabel(label: string): boolean {
  const norm = normNewsLabel(label);
  return NEWS_PRICE_KEYS.has(norm) || norm.split("/").some((part) => NEWS_PRICE_KEYS.has(part));
}

export type NewsDetailBlock =
  | { kind: "prose"; text: string }
  | { kind: "field"; label: string; value: string; emphasis: boolean };

/**
 * Label lines become field cards. Empty values (including empty 備註) drop.
 * `相關連結` is not a card — its https URL is returned once for the source button.
 * ponytail: an unknown label stays prose until it is added to NEWS_FIELD_KEYS.
 */
export function newsDetailBlocks(copy: string): { blocks: NewsDetailBlock[]; linkUrl: string | null } {
  const blocks: NewsDetailBlock[] = [];
  const prose: string[] = [];
  let linkUrl: string | null = null;
  const flush = () => {
    const text = prose.join("\n").trim();
    prose.length = 0;
    if (text) blocks.push({ kind: "prose", text });
  };
  for (const line of copy.split("\n")) {
    const match = /^[ \t]*([^：:]{1,40})[ \t]*[：:][ \t]*(.*)$/.exec(line);
    const label = match?.[1].trim() ?? "";
    const value = match?.[2].trim() ?? "";
    if (!match || !knownNewsLabel(label)) {
      if (match && NEWS_LINK_KEYS.has(normNewsLabel(label))) {
        flush();
        if (!linkUrl && httpsUrl(value)) linkUrl = value;
        continue;
      }
      prose.push(line);
      continue;
    }
    flush();
    if (!value) continue;
    blocks.push({ kind: "field", label, value, emphasis: priceNewsLabel(label) });
  }
  flush();
  return { blocks, linkUrl };
}

/** List chip. Goldin, or a body that names 成交價, is 成交 rather than 抽選. */
export function newsListTag(row: { source: string; body: string; tag: string }, locale: Locale): string {
  if (row.source === "Goldin" || row.body.includes("成交價")) return locale === "en" ? "Sold" : "成交";
  if (row.tag === "RESTOCK") return locale === "en" ? "Restock" : "重販";
  if (row.tag === "DATE") return locale === "en" ? "Draw" : "抽選";
  return locale === "en" ? "Release" : "發售";
}

/**
 * One teaser line. When the meta stamp is already a calendar day, drop that D/M and M/D token
 * so `30/10` is not printed again under `30/10`.
 */
export function newsListTeaser(teaser: string, at: Date, now: Date, locale: Locale): string {
  const text = teaser.trim();
  if (!text) return "";
  const stamp = newsUpdatedAgo(at, now, locale);
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(stamp);
  if (!match) return text;
  const forms = [...new Set([`${match[1]}/${match[2]}`, `${match[2]}/${match[1]}`])];
  let next = text;
  for (const form of forms) {
    next = next.replace(new RegExp(`(^|[^0-9/])(?:約\\s*)?${form.replaceAll("/", "\\/")}(?![0-9/])`, "g"), "$1");
  }
  if (next === text) return text;
  return next
    .split(/[|｜]/)
    .map((part) => part.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join(" | ");
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
