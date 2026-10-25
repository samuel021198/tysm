import type { Locale } from "./i18n";

export function formatHkd(cents: number, locale: Locale): string {
  const amount = new Intl.NumberFormat(locale === "en" ? "en-HK" : "zh-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `HK$${amount}`;
}

export function formatHKT(date: Date, locale: Locale, withTime = true): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-HK" : "zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(date);
}

export function hkdToCents(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [a, b = ""] = t.split(".");
  const cents = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 1_000_000_000) return null;
  return cents;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  const d = Math.floor(cents / 100);
  const c = cents % 100;
  return c === 0 ? String(d) : `${d}.${String(c).padStart(2, "0")}`;
}

export function toHkInput(date: Date): string {
  const s = date.toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong" });
  return s.slice(0, 16).replace(" ", "T");
}

export function fromHkInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar date as Hong Kong midnight. */
export function fromHkDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toHkDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(date);
}

export function safeNext(value: unknown): string {
  const raw = String(value || "");
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  try {
    const url = new URL(raw);
    if (url.pathname.startsWith("/")) return url.pathname + url.search;
  } catch {
    /* ignore */
  }
  return "/";
}

export function anonBidder(id: string, locale: Locale): string {
  const tag = id.slice(-4).toUpperCase();
  return locale === "en" ? `Bidder ${tag}` : `買家 ${tag}`;
}

export function hkPartsToInput(day: string, month: string, year: string, hour: string, minute: string): string {
  const parts = [day, month, year, hour, minute].map((part) => part.trim());
  if (parts.some((part) => !/^\d+$/.test(part))) return "";
  const [d, m, y, h, min] = parts.map(Number);
  if (y < 2024 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return "";
  const value = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const date = fromHkInput(value);
  if (!date || toHkInput(date) !== value) return "";
  return value;
}

export function isAllowedMediaUrl(url: string): boolean {
  if (url.startsWith("/demo/") || url.startsWith("/brand/")) return true;
  if (url.startsWith("data:image/")) {
    return url.length <= 180_000 && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i.test(url);
  }
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export function normalizePhone(input: string): string | null {
  const d = input.replace(/[\s-]/g, "");
  if (/^\+852[0-9]{8}$/.test(d)) return d;
  if (/^852[0-9]{8}$/.test(d)) return `+${d}`;
  if (/^[0-9]{8}$/.test(d)) return `+852${d}`;
  return null;
}

export function parseTarget(input: string): { channel: "email" | "phone"; target: string } | null {
  if (input.includes("@")) {
    const email = normalizeEmail(input);
    return email ? { channel: "email", target: email } : null;
  }
  const phone = normalizePhone(input);
  return phone ? { channel: "phone", target: phone } : null;
}

export const DISTRICTS: [string, string][] = [
  ["中西區", "Central and Western"],
  ["東區", "Eastern"],
  ["南區", "Southern"],
  ["灣仔", "Wan Chai"],
  ["九龍城", "Kowloon City"],
  ["觀塘", "Kwun Tong"],
  ["深水埗", "Sham Shui Po"],
  ["黃大仙", "Wong Tai Sin"],
  ["油尖旺", "Yau Tsim Mong"],
  ["葵青", "Kwai Tsing"],
  ["北區", "North"],
  ["西貢", "Sai Kung"],
  ["沙田", "Sha Tin"],
  ["大埔", "Tai Po"],
  ["荃灣", "Tsuen Wan"],
  ["屯門", "Tuen Mun"],
  ["元朗", "Yuen Long"],
  ["離島", "Islands"],
];
