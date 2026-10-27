/** Topic labels. Stored without `#`. UI copy is 話題. */

const TAG_RE = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,24})/gu;

const ALIAS: Record<string, string> = {
  pc: "PC",
  fs: "FS",
  iso: "ISO",
  op09: "OP09",
  charizard: "Charizard",
  psa10: "PSA10",
  riftbound: "Riftbound",
};

/** Priority chips. Shown before the user types `#`. */
export const TOPIC_DEFAULTS = ["PC", "FS", "賣", "ISO", "OP09", "Charizard"] as const;

const TOPIC_MORE = ["寶可夢", "PSA10", "放賣", "海賊王", "Riftbound"] as const;

const TOPIC_POOL = [...TOPIC_DEFAULTS, ...TOPIC_MORE];

export function normalizeTag(raw: string): string | null {
  const cleaned = raw.trim().replace(/^#+/u, "").replace(/\s+/g, "");
  if (!cleaned || cleaned.length > 24) return null;
  if (!/^[\p{L}\p{N}_]+$/u.test(cleaned)) return null;
  const alias = ALIAS[cleaned.toLowerCase()];
  if (alias) return alias;
  if (/^[a-z]{1,6}\d{1,4}$/i.test(cleaned)) return cleaned.toUpperCase();
  return cleaned;
}

export function tagsFromCaption(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(new RegExp(TAG_RE.source, "gu"))) {
    const tag = normalizeTag(match[2] || "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

export function mergeTags(...groups: string[][]): string[] {
  return tagsFromCaption(groups.flat().map((tag) => `#${tag}`).join(" "));
}

/** Caption for display. Topic tokens move onto the chips. */
export function displayCaption(text: string): string {
  return text
    .replace(new RegExp(TAG_RE.source, "gu"), "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The `#` token the caret is inside, or null when the user is not typing one. */
export function hashPartial(text: string, cursor: number): string | null {
  const upto = text.slice(0, Math.max(0, cursor));
  const match = upto.match(/(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]*)$/u);
  return match ? match[2] : null;
}

export function topicSuggestions(partial: string | null): string[] {
  if (partial == null) return [...TOPIC_DEFAULTS];
  const q = partial.toLowerCase();
  const hits = TOPIC_POOL.filter((tag) => tag.toLowerCase().startsWith(q) || (q.length >= 1 && tag.toLowerCase().includes(q)));
  return hits.length ? hits : [...TOPIC_DEFAULTS];
}

export function insertTag(text: string, cursor: number, tag: string): { text: string; cursor: number } {
  const normalized = normalizeTag(tag);
  if (!normalized) return { text, cursor };
  if (tagsFromCaption(text).some((row) => row.toLowerCase() === normalized.toLowerCase())) return { text, cursor };
  const token = `#${normalized}`;
  const at = Math.max(0, Math.min(cursor, text.length));
  const upto = text.slice(0, at);
  const match = upto.match(/(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]*)$/u);
  if (match) {
    const start = at - match[2].length - 1;
    const next = `${text.slice(0, start)}${token} ${text.slice(at)}`;
    return { text: next, cursor: start + token.length + 1 };
  }
  const spacer = text.length && !/\s$/u.test(text) ? " " : "";
  const next = `${text}${spacer}${token} `;
  return { text: next, cursor: next.length };
}

/** Exact tag keys for a search needle. `#PC` and `pc` both hit `PC`. */
export function tagLookup(needle: string): string[] {
  const raw = needle.trim().replace(/^#+/u, "");
  if (!raw || raw.length > 24) return [];
  const forms = new Set<string>();
  const normalized = normalizeTag(raw);
  if (normalized) forms.add(normalized);
  forms.add(raw);
  if (/^[a-z0-9]+$/i.test(raw)) {
    forms.add(raw.toUpperCase());
    forms.add(raw.toLowerCase());
  }
  return [...forms];
}
