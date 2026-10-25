import { authorizedBearer } from "@/lib/bootstrap";
import { backfillCatalogTitles, ingestDex } from "@/lib/dex-ingest";
import { ingestOnePiece, ingestRiftbound, ingestTopps } from "@/lib/game-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel Pro. Soft deadline below stays under this so the handler can return JSON. */
export const maxDuration = 300;

const INGEST_DEADLINE_MS = 240_000;

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "error";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

function invalid(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

function readCursor(value: unknown): string | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const cursor = value.trim();
  if (!cursor) return null;
  if (cursor.length > 80 || !/^(en|ja):[A-Za-z0-9._-]+(?:#\d+)?$/.test(cursor)) return "invalid";
  return cursor;
}

function readSets(value: unknown): number | undefined | "invalid" {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) return "invalid";
  return parsed;
}

function readLang(value: unknown): "en" | "ja" | "all" | "invalid" {
  if (value == null || value === "" || value === "all") return "all";
  if (value === "en" || value === "ja") return value;
  return "invalid";
}

function readGame(value: unknown): "pokemon" | "one-piece" | "riftbound" | "topps-basketball" | "topps-soccer" | "invalid" {
  if (value == null || value === "" || value === "pokemon") return "pokemon";
  if (value === "one-piece" || value === "op") return "one-piece";
  if (value === "riftbound") return "riftbound";
  if (value === "topps-basketball") return "topps-basketball";
  if (value === "topps-soccer") return "topps-soccer";
  return "invalid";
}

function readBackfill(value: unknown): boolean | "invalid" {
  if (value == null || value === "" || value === false || value === "false" || value === 0) return false;
  if (value === true || value === "true" || value === 1) return true;
  return "invalid";
}

function readIdCursor(value: unknown): string | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const cursor = value.trim();
  if (!cursor) return null;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(cursor)) return "invalid";
  return cursor;
}

async function readOptions(request: Request) {
  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  const text = await request.text();
  if (text.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return invalid("invalid_json");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalid("invalid_json");
    body = parsed as Record<string, unknown>;
  }
  const pick = (key: string) => (Object.prototype.hasOwnProperty.call(body, key) ? body[key] : url.searchParams.get(key));
  const backfillTitles = readBackfill(pick("backfillTitles"));
  if (backfillTitles === "invalid") return invalid("invalid_backfill");
  if (backfillTitles) {
    const cursor = readIdCursor(pick("cursor"));
    if (cursor === "invalid") return invalid("invalid_cursor");
    return { backfillTitles: true as const, cursor };
  }
  const cursor = readCursor(pick("cursor"));
  if (cursor === "invalid") return invalid("invalid_cursor");
  const sets = readSets(pick("sets"));
  if (sets === "invalid") return invalid("invalid_sets");
  const lang = readLang(pick("lang"));
  if (lang === "invalid") return invalid("invalid_lang");
  const game = readGame(pick("game"));
  if (game === "invalid") return invalid("invalid_game");
  if ((game === "riftbound" || game === "topps-basketball" || game === "topps-soccer") && lang === "ja") return invalid("invalid_lang");
  return { backfillTitles: false as const, cursor, maxSets: sets, langs: lang === "all" ? undefined : [lang], game };
}

export async function POST(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  if (!authorizedBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const options = await readOptions(request);
  if (options instanceof Response) return options;
  try {
    if (options.backfillTitles) {
      const result = await backfillCatalogTitles({ deadlineMs: INGEST_DEADLINE_MS, cursor: options.cursor });
      return Response.json({ ok: true, mode: "backfillTitles", ...result });
    }
    const shared = { deadlineMs: INGEST_DEADLINE_MS, cursor: options.cursor, maxSets: options.maxSets };
    const result =
      options.game === "one-piece"
        ? await ingestOnePiece({ ...shared, langs: options.langs })
        : options.game === "riftbound"
          ? await ingestRiftbound(shared)
          : options.game === "topps-basketball"
            ? await ingestTopps("TOPPS_BASKETBALL", shared)
            : options.game === "topps-soccer"
              ? await ingestTopps("TOPPS_SOCCER", shared)
              : await ingestDex({ ...shared, langs: options.langs });
    return Response.json({ ok: true, game: options.game, ...result });
  } catch (error) {
    console.error("dex ingest failed", safeMessage(error));
    return Response.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}
