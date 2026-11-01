import { syncAdminPasswordFromEnv } from "@/lib/admin-password";
import { authorizedBearer } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hashes ADMIN_PASSWORD onto user_admin. Bearer BOOTSTRAP_SECRET. Body is ignored. */
export async function POST(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  if (!authorizedBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await syncAdminPasswordFromEnv();
  if (result === "skipped") return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  if (result === "missing") return Response.json({ ok: false, error: "missing" }, { status: 404 });
  return Response.json({ ok: true });
}
