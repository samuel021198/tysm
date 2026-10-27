import { isAllowedMediaUrl } from "./format";

/** Flat PostComment body. Replies are an @mention in the same text; there is no thread table. */
export function cleanComment(value: unknown): string | null {
  const body = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (body.length < 1 || body.length > 300) return null;
  return body;
}

/** Quick reacts sent as their own comment. Same row as the reference sheet. */
export const COMMENT_REACTS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"] as const;

/** Put @nickname at the front. A previous mention is replaced. */
export function replyDraft(nickname: string, current: string): string {
  const mention = `@${nickname} `;
  const rest = current.replace(/^@\S+\s*/, "");
  return `${mention}${rest}`;
}

// ponytail: GIF links stay on tenor, giphy, and klipy. Add a root here for another picker CDN.
const GIF_ROOTS = ["tenor.com", "giphy.com", "klipy.com"];

function gifHost(host: string): boolean {
  return GIF_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
}

function mediaHost(host: string): boolean {
  if (host === "media.tenor.com" || host === "c.tenor.com") return true;
  if (host === "i.giphy.com" || /^media\d*\.giphy\.com$/.test(host)) return true;
  return host.startsWith("static.") && host.endsWith(".klipy.com");
}

/** A comment photo (jpeg/png/webp data URL) or a GIF https link. Anything else is dropped. */
export function cleanCommentImage(value: unknown): string | null {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (url.startsWith("data:")) return isAllowedMediaUrl(url) ? url : null;
  if (url.length > 500) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!gifHost(host)) return null;
  const path = parsed.pathname.toLowerCase();
  if (!/\.(gif|webp|png|jpe?g)$/.test(path) && !mediaHost(host)) return null;
  return url;
}

export type GifPick = { id: string; previewUrl: string; url: string };

/** One Tenor result, or null when the media URLs are not allowed GIF links. */
export function tenorGif(row: unknown): GifPick | null {
  if (!row || typeof row !== "object") return null;
  const item = row as { id?: unknown; media_formats?: unknown };
  const formats = item.media_formats;
  if (!formats || typeof formats !== "object") return null;
  const map = formats as Record<string, { url?: unknown } | undefined>;
  const url = cleanCommentImage(map.gif?.url) ?? cleanCommentImage(map.mediumgif?.url) ?? cleanCommentImage(map.tinygif?.url);
  const previewUrl = cleanCommentImage(map.tinygif?.url) ?? cleanCommentImage(map.nanogif?.url) ?? url;
  const id = String(item.id ?? "").trim().slice(0, 40);
  if (!url || !previewUrl || !id) return null;
  return { id, previewUrl, url };
}

/** Text, a photo/GIF, or both. An empty composer is `comment`; a bad attachment is `photo_url`. */
export function commentWrite(
  body: unknown,
  image: unknown,
): { ok: true; body: string; imageUrl: string | null } | { ok: false; error: "comment" | "photo_url" } {
  const imageInput = String(image ?? "").trim();
  const imageUrl = imageInput ? cleanCommentImage(imageInput) : null;
  if (imageInput && !imageUrl) return { ok: false, error: "photo_url" };
  const text = cleanComment(String(body ?? "").slice(0, 400));
  if (String(body ?? "").trim() && !text) return { ok: false, error: "comment" };
  if (!text && !imageUrl) return { ok: false, error: "comment" };
  return { ok: true, body: text ?? "", imageUrl };
}
