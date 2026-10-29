import { safeNext } from "./format";

/** Locked report labels. 「其他」 may carry one optional note. */
export const REPORT_REASONS = ["假貨／唔啱圖", "欺詐／唔交收", "騷擾", "垃圾廣告", "其他"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 80;
export const BLOCK_CONFIRM = "封鎖後唔見對方貨同訊息";

export function composeReportReason(code: string, note: string): string | null {
  if (!REPORT_REASONS.includes(code as ReportReason)) return null;
  if (code !== "其他") return code;
  const extra = note.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (extra.length > REPORT_NOTE_MAX) return null;
  return extra ? `其他：${extra}` : "其他";
}

/** Leave a page that would 404 once the other person is hidden. Stay on a feed. */
export function blockAway(next: string, userId: string): string {
  const path = safeNext(next).split("#")[0].split("?")[0] || "/";
  if (path === "/messages" || path.startsWith("/messages/")) return "/messages";
  if (
    userId &&
    (path === `/shop/${userId}` ||
      path.startsWith(`/shop/${userId}/`) ||
      path.startsWith("/post/") ||
      path.startsWith("/listing/"))
  ) {
    return "/";
  }
  return path;
}
