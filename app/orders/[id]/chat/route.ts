import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attachDealThread } from "@/lib/deals";

/** Footprint rows without a thread still land in the chat, not the detail page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/orders/${id}/chat`);
  const order = await prisma.order.findUnique({ where: { id }, select: { buyerId: true, sellerId: true } });
  if (!order || (order.buyerId !== viewer.id && order.sellerId !== viewer.id && viewer.role !== "ADMIN")) notFound();
  const threadId = await attachDealThread(id);
  if (!threadId) redirect(`/orders/${id}`);
  redirect(`/messages/${threadId}`);
}
