import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { deskStatus, DESK_HINT } from "@/lib/order-desk";
import { sweep } from "@/lib/orders";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/orders");
  const selling = sp.role === "sell";
  const orders = await prisma.order.findMany({
    where: selling ? { sellerId: viewer.id } : { buyerId: viewer.id },
    include: {
      items: true,
      buyer: { select: { id: true, nickname: true } },
      seller: { select: { id: true, nickname: true } },
      dispute: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const locale = prefs.locale;
  const tab = "grid h-11 place-items-center rounded-full";
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <h1 className="page-title">{tx(locale, "我的訂單", "My orders")}</h1>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-soft p-1 text-sm">
        <Link href="/orders" aria-current={selling ? undefined : "page"} className={`${tab} ${selling ? "text-muted" : "bg-card font-semibold shadow-card"}`}>
          {tx(locale, "買入", "Bought")}
        </Link>
        <Link href="/orders?role=sell" aria-current={selling ? "page" : undefined} className={`${tab} ${selling ? "bg-card font-semibold shadow-card" : "text-muted"}`}>
          {tx(locale, "賣出", "Sold")}
        </Link>
      </div>
      {orders.length === 0 ? <p className="empty">{tx(locale, "暫無訂單", "No orders yet.")}</p> : null}
      <ul className="grid gap-3">
        {orders.map((order) => {
          const item = order.items[0];
          const status = deskStatus(order);
          const name = order.items.map((row) => row.title).join("、") || tx(locale, "訂單", "Order");
          const counterpart = selling ? order.buyer : order.seller;
          return (
            <li key={order.id} className="surface relative flex items-center gap-3 p-3">
              <Link href={`/orders/${order.id}`} className="absolute inset-0" aria-label={name} />
              <img src={item?.imageUrl || "/demo/back.svg"} alt="" className="pointer-events-none relative h-14 w-11 shrink-0 rounded-lg bg-soft object-cover" />
              <span className="pointer-events-none relative min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                <Link href={`/u/${counterpart.id}`} className="pointer-events-auto relative z-10 mt-0.5 block truncate text-xs text-muted">
                  {counterpart.nickname}
                </Link>
              </span>
              <span title={DESK_HINT[status]} className="pointer-events-none relative inline-flex shrink-0 rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
