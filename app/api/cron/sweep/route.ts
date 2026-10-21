import { sweep } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  await sweep();
  return Response.json({ ok: true });
}
