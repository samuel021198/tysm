import { tx, type Locale } from "./i18n";

const SHARE_PATH = /^\/(?:post|listing|dex)\/[A-Za-z0-9._~-]+$/;

/** In-app target only. Rejects off-site and nested paths. */
export function shareTarget(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!SHARE_PATH.test(raw)) return null;
  return raw;
}

export function shareLabel(path: string, locale: Locale): string {
  if (path.startsWith("/listing/")) return tx(locale, "貨品", "Listing");
  if (path.startsWith("/dex/")) return tx(locale, "圖鑑", "Dex");
  return tx(locale, "貼文", "Post");
}
