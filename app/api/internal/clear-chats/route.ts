import { authorizedBearer } from "@/lib/bootstrap";
import { clearChats } from "@/lib/clear-chats";
import { prisma } from "@/lib/db";

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
  try {
    const deleted = await clearChats(prisma);
    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error("clear-chats failed", safeMessage(error));
    return Response.json({ ok: false, error: "clear_failed" }, { status: 500 });
  }
}
