import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { threadIdForOrder } from "@/lib/deal-phase";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { deskStatus, deskTimeline, DESK_HINT } from "@/lib/order-desk";
import { OrderIssueSheet } from "@/components/order-issue-sheet";
import { Flash } from "@/components/shell";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/orders/${id}`);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      buyer: { select: { id: true, nickname: true } },
      seller: { select: { id: true, nickname: true } },
      dispute: { select: { status: true } },
    },
  });
  if (!order || (order.buyerId !== viewer.id && order.sellerId !== viewer.id && viewer.role !== "ADMIN")) notFound();
  const locale = prefs.locale;
  const selling = viewer.id === order.sellerId;
  const party = viewer.id === order.buyerId || selling;
  const status = deskStatus(order);
  const item = order.items[0];
  const name = order.items.map((row) => row.title).join("、") || tx(locale, "訂單", "Order");
  const counterpart = selling ? order.buyer : order.seller;
  const steps = deskTimeline(status);
  const closeAt = status === "已完成" ? order.completedAt : status === "已取消" ? order.cancelledAt : null;
  const when = [formatHKT(order.createdAt, locale, false), null, closeAt ? formatHKT(closeAt, locale, false) : null];
  const listingId = item?.listingId;
  const threads = listingId
    ? await prisma.messageThread.findMany({
        where: { listingId, buyerId: order.buyerId, sellerId: order.sellerId },
        select: { id: true, createdAt: true },
      })
    : [];
  const threadId = threadIdForOrder(
    order.createdAt.getTime(),
    threads.map((row) => ({ id: row.id, createdAt: row.createdAt.getTime() })),
  );

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <Link href={selling ? "/orders?role=sell" : "/orders"} className="text-xs font-semibold text-link">
        {tx(locale, "返回訂單", "Back to orders")}
      </Link>
      <h1 className="page-title mb-0">{name}</h1>
      <article className="surface grid gap-3 p-3">
        <div className="flex items-center gap-3">
          <img src={item?.imageUrl || "/demo/back.svg"} alt="" className="h-14 w-11 shrink-0 rounded-lg bg-soft object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <Link href={`/u/${counterpart.id}`} className="mt-0.5 block truncate text-xs text-muted">
              {counterpart.nickname}
            </Link>
          </div>
          <span title={DESK_HINT[status]} className="inline-flex shrink-0 rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
            {status}
          </span>
        </div>
        <p className="text-xs text-muted">{DESK_HINT[status]}</p>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs">
          {steps.map((step, index) => (
            <li key={step.label} className={step.state === "wait" ? "text-muted" : "font-semibold"}>
              <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${step.state === "wait" ? "bg-line" : "bg-ink"}`} />
              {step.label}
              {when[index] ? <span className="mt-0.5 block font-normal text-muted">{when[index]}</span> : null}
            </li>
          ))}
        </ol>
      </article>
      {party ? <OrderIssueSheet locale={locale} orderId={order.id} blocked={status === "爭議中"} /> : null}
      {threadId ? (
        <Link className="text-center text-sm font-semibold text-link" href={`/messages/${threadId}`}>
          {tx(locale, "打開聊天", "Open chat")}
        </Link>
      ) : null}
    </div>
  );
}
