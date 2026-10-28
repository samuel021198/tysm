import type { Prisma } from "@prisma/client";
import type { NewsTag } from "./news";

const SLUG = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,96}$/;
const EVENT = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-Z]+)?$/;

/** Stable primary key when the caller omits `id`. */
export function newsIdForSlug(slug: string): string {
  return `news_${slug}`;
}

export type NewsIngestInput = {
  slug: string;
  title: string;
  source: string;
  teaser?: string;
  body?: string;
  coverUrl?: string | null;
  linkUrl?: string | null;
  tag?: NewsTag;
  eventAt?: Date | null;
  hot?: boolean;
  brandColor?: string;
  id?: string;
};

export type NewsIngestResult = { ok: true; value: NewsIngestInput } | { ok: false; error: string };

export type NewsUpsertPlan =
  | { ok: true; mode: "create"; data: Prisma.NewsItemCreateInput }
  | { ok: true; mode: "update"; data: Prisma.NewsItemUpdateInput }
  | { ok: false; error: "id_mismatch" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function has(row: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function readLabel(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001f]/.test(text)) return null;
  return text;
}

function readCopy(value: unknown, max: number): string | "invalid" {
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return "invalid";
  return text;
}

function readSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 80 || !SLUG.test(text)) return null;
  return text;
}

function readUrl(value: unknown, cover: boolean): string | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  if (!text) return null;
  if (text.length > 500) return "invalid";
  if (cover && text.startsWith("/") && !text.startsWith("//") && !text.includes("\\") && !text.includes("..")) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:") return "invalid";
  return text;
}

function isNewsTag(value: unknown): value is NewsTag {
  return value === "RELEASE" || value === "RESTOCK" || value === "DATE";
}

function readTag(value: unknown): NewsTag | "invalid" {
  return isNewsTag(value) ? value : "invalid";
}

function readEventAt(value: unknown): Date | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  if (!EVENT.test(text)) return "invalid";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

function readHot(value: unknown): boolean | "invalid" {
  return typeof value === "boolean" ? value : "invalid";
}

function readColor(value: unknown): string | "invalid" {
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  return COLOR.test(text) ? text : "invalid";
}

function readId(value: unknown): string | "invalid" {
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  return ID.test(text) ? text : "invalid";
}

/** Validate one publish body. Omitted optional keys stay `undefined` so an update can leave them alone. */
export function parseNewsIngest(body: unknown): NewsIngestResult {
  if (!isRecord(body)) return { ok: false, error: "invalid_body" };
  const slug = readSlug(body.slug);
  if (!slug) return { ok: false, error: "invalid_slug" };
  const title = readLabel(body.title, 200);
  if (!title) return { ok: false, error: "invalid_title" };
  const source = readLabel(body.source, 80);
  if (!source) return { ok: false, error: "invalid_source" };

  const value: NewsIngestInput = { slug, title, source };

  if (has(body, "teaser")) {
    const teaser = readCopy(body.teaser, 200);
    if (teaser === "invalid") return { ok: false, error: "invalid_teaser" };
    value.teaser = teaser;
  }
  if (has(body, "body")) {
    const copy = readCopy(body.body, 4000);
    if (copy === "invalid") return { ok: false, error: "invalid_copy" };
    value.body = copy;
  }
  if (has(body, "coverUrl")) {
    const coverUrl = readUrl(body.coverUrl, true);
    if (coverUrl === "invalid") return { ok: false, error: "invalid_cover" };
    value.coverUrl = coverUrl;
  }
  if (has(body, "linkUrl")) {
    const linkUrl = readUrl(body.linkUrl, false);
    if (linkUrl === "invalid") return { ok: false, error: "invalid_link" };
    value.linkUrl = linkUrl;
  }
  if (has(body, "tag")) {
    const tag = readTag(body.tag);
    if (tag === "invalid") return { ok: false, error: "invalid_tag" };
    value.tag = tag;
  }
  if (has(body, "eventAt")) {
    const eventAt = readEventAt(body.eventAt);
    if (eventAt === "invalid") return { ok: false, error: "invalid_event" };
    value.eventAt = eventAt;
  }
  if (has(body, "hot")) {
    const hot = readHot(body.hot);
    if (hot === "invalid") return { ok: false, error: "invalid_hot" };
    value.hot = hot;
  }
  if (has(body, "brandColor")) {
    const brandColor = readColor(body.brandColor);
    if (brandColor === "invalid") return { ok: false, error: "invalid_color" };
    value.brandColor = brandColor;
  }
  if (has(body, "id")) {
    const id = readId(body.id);
    if (id === "invalid") return { ok: false, error: "invalid_id" };
    value.id = id;
  }

  return { ok: true, value };
}

/** Create fills schema defaults. Update writes only the keys the body sent, plus title and source. */
export function planNewsUpsert(existing: { id: string } | null, input: NewsIngestInput): NewsUpsertPlan {
  if (existing) {
    if (input.id !== undefined && input.id !== existing.id) return { ok: false, error: "id_mismatch" };
    const data: Prisma.NewsItemUpdateInput = { title: input.title, source: input.source };
    if (input.teaser !== undefined) data.teaser = input.teaser;
    if (input.body !== undefined) data.body = input.body;
    if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
    if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl;
    if (input.tag !== undefined) data.tag = input.tag;
    if (input.eventAt !== undefined) data.eventAt = input.eventAt;
    if (input.hot !== undefined) data.hot = input.hot;
    if (input.brandColor !== undefined) data.brandColor = input.brandColor;
    return { ok: true, mode: "update", data };
  }

  const data = {
    id: input.id ?? newsIdForSlug(input.slug),
    slug: input.slug,
    title: input.title,
    source: input.source,
    teaser: input.teaser ?? "",
    body: input.body ?? "",
    coverUrl: input.coverUrl ?? null,
    brandColor: input.brandColor ?? "#111111",
    linkUrl: input.linkUrl ?? null,
    tag: input.tag ?? "RELEASE",
    eventAt: input.eventAt === undefined ? null : input.eventAt,
    hot: input.hot ?? false,
  } satisfies Prisma.NewsItemCreateInput;
  return { ok: true, mode: "create", data };
}
