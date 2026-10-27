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
