import { authorizedBearer } from "@/lib/bootstrap";
import { seedDemoLogins } from "@/lib/seed-demo-logins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "error";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

/** Upserts Mars, Tyu, and MueL password hashes. Bearer BOOTSTRAP_SECRET. Body is ignored. Does not wipe. */
export async function POST(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  if (!authorizedBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const counts = await seedDemoLogins();
    return Response.json({ ok: true, counts });
  } catch (error) {
    if (error instanceof Error && error.message === "demo_phone_taken") {
      return Response.json({ ok: false, error: "demo_phone_taken" }, { status: 409 });
    }
    console.error("seed-demo-logins failed", safeMessage(error));
    return Response.json({ ok: false, error: "seed_failed" }, { status: 500 });
  }
}
