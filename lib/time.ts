import type { Locale } from "./i18n";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Same-write clock skew stays on the publish line.
 * ponytail: an edit inside 60s still reads as published. Upgrade path: a contentUpdatedAt column if sub-minute edits must show.
 */
export const MEANINGFUL_UPDATE_MS = 60_000;

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

function hkDayNumber(date: Date): number {
  const { y, m, d } = hkParts(date);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Calendar day. zh-HK is D/M so it matches news copy (`30/10`); en stays M/D. */
function calendarStamp(when: { m: number; d: number }, locale: Locale): string {
  return locale === "en" ? `${when.m}/${when.d}` : `${when.d}/${when.m}`;
}

/**
 * Relative clock shared with news.
 * Future and older dates are D/M in zh-HK and M/D in en.
 * Under an hour → 剛剛; under a day →「N 小時前」; the previous Hong Kong date → 昨日.
 */
export function relativeTime(at: Date | string, now: Date, locale: Locale): string {
  const whenAt = asDate(at);
  const diff = now.getTime() - whenAt.getTime();
  if (diff < 0) return calendarStamp(hkParts(whenAt), locale);
  if (diff < HOUR_MS) return locale === "en" ? "Just now" : "剛剛";
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) {
    if (locale === "en") return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    return `${hours} 小時前`;
  }
  if (hkDayNumber(now) - hkDayNumber(whenAt) === 1) return locale === "en" ? "Yesterday" : "昨日";
  return calendarStamp(hkParts(whenAt), locale);
}

export type ActivityLine = { text: string; at: Date };

/**
 * One line. Publish time, unless `updatedAt` is meaningfully later than `createdAt`.
 * Post has no updatedAt column; pass the linked listing's updatedAt for a price change, re-list, or sale edit.
 */
export function activityLine(
  createdAt: Date | string,
  updatedAt: Date | string | null | undefined,
  now: Date,
  locale: Locale,
): ActivityLine {
  const created = asDate(createdAt);
  const updated = updatedAt == null || updatedAt === "" ? null : asDate(updatedAt);
  const meaningful = updated != null && !Number.isNaN(updated.getTime()) && updated.getTime() - created.getTime() >= MEANINGFUL_UPDATE_MS;
  const at = meaningful ? updated : created;
  const text = relativeTime(at, now, locale);
  if (!meaningful) return { text, at };
  return { text: locale === "en" ? `Updated · ${text}` : `更新於 · ${text}`, at };
}
