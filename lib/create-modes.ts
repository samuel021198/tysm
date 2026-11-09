/** One create entry: 上架. Advanced auction / multi-card / schedule / CSV stay on /sell. */
export const CREATE_HREF = "/add";

/** One toast after 發佈. The listing and its Front post share this line. */
export const CREATE_TOAST_ZH = "已發佈 · 已上架";
export const CREATE_TOAST_EN = "Published · Listed";

export function createDest(href: string, loggedIn: boolean) {
  return loggedIn ? href : `/login?next=${encodeURIComponent(href)}`;
}

/** First line of the caption, capped at the listing title length. */
export function createTitle(caption: string): string {
  const line = caption.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line.slice(0, 80);
}
