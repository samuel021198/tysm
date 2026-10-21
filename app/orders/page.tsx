import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT } from "@/lib/format";
import { orderStatusLabel, tx } from "@/lib/i18n";
import { sweep } from "@/lib/orders";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await sweep();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/orders");
  const selling = sp.role === "sell";
  const orders = await prisma.order.findMany({
    where: selling ? { sellerId: viewer.id } : { buyerId: viewer.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">{tx(prefs.locale, "訂單", "Orders")}</h1>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/orders" className={!selling ? "font-semibold" : ""}>{tx(prefs.locale, "我買的", "Purchases")}</Link>
        <Link href="/orders?role=sell" className={selling ? "font-semibold" : ""}>{tx(prefs.locale, "我賣的", "Sales")}</Link>
      </div>
      {orders.length === 0 ? <p>{tx(prefs.locale, "未有訂單。", "No orders yet.")}</p> : null}
      <ul className="grid gap-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className="block rounded-2xl border border-line p-4">
              <span className="font-medium">{orderStatusLabel(prefs.locale, order.status)}</span>
              <span className="ml-2">{formatHkd(order.total, prefs.locale)}</span>
              <span className="ml-2 text-sm text-muted">{formatHKT(order.createdAt, prefs.locale)}</span>
              <p className="mt-1 text-sm">{order.items.map((item) => item.title).join("、")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
