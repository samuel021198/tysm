import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { authorizedBearer } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { parseNewsIngest, planNewsUpsert } from "@/lib/news-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "error";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

function fail(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return fail("unconfigured", 503);
  if (!authorizedBearer(request.headers.get("authorization"), secret)) return fail("unauthorized", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const parsed = parseNewsIngest(payload);
  if (!parsed.ok) return fail(parsed.error, 400);

  try {
    const existing = await prisma.newsItem.findUnique({ where: { slug: parsed.value.slug }, select: { id: true } });
    const plan = planNewsUpsert(existing, parsed.value);
    if (!plan.ok) return fail(plan.error, 400);
    const item =
      plan.mode === "create"
        ? await prisma.newsItem.create({ data: plan.data })
        : await prisma.newsItem.update({ where: { slug: parsed.value.slug }, data: plan.data });
    revalidatePath("/news");
    revalidatePath(`/news/${item.slug}`);
    return Response.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("conflict", 409);
    console.error("news ingest failed", safeMessage(error));
    return fail("ingest_failed", 500);
  }
}
