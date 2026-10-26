import { authorizedBearer } from "@/lib/bootstrap";
import { sweep } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Manual calls may use `BOOTSTRAP_SECRET`. */
export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET;
  const bootstrap = process.env.BOOTSTRAP_SECRET;
  if (!cron && !bootstrap) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
  const header = request.headers.get("authorization");
  if (!authorizedBearer(header, cron) && !authorizedBearer(header, bootstrap)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await sweep();
  return Response.json({ ok: true });
}
