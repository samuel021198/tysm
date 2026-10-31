import { authorizedBearer } from "@/lib/bootstrap";
import { seedWave1 } from "@/lib/seed-wave1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
    const counts = await seedWave1();
    return Response.json({ ok: true, counts });
  } catch (error) {
    console.error("seed-wave1 failed", safeMessage(error));
    return Response.json({ ok: false, error: "seed_failed" }, { status: 500 });
  }
}
