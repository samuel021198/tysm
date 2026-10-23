import { authorizedBearer } from "@/lib/bootstrap";
import { ingestDex } from "@/lib/dex-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "error";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

export async function POST(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  if (!authorizedBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.SCRYDEX_API_KEY?.trim() || !process.env.SCRYDEX_TEAM_ID?.trim()) {
    return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }
  try {
    const counts = await ingestDex({ deadlineMs: 45_000 });
    return Response.json({ ok: true, counts });
  } catch (error) {
    console.error("dex ingest failed", safeMessage(error));
    return Response.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}
