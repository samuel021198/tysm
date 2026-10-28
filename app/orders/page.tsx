import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { DEAL_RISK, dealPhase, phaseLabel } from "@/lib/deal-phase";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
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
      <h1 className="page-title">{tx(prefs.locale, "交收", "Handovers")}</h1>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-soft p-1 text-sm">
        <Link href="/orders" className={`grid h-11 place-items-center rounded-full ${!selling ? "bg-card font-semibold shadow-card" : "text-muted"}`}>{tx(prefs.locale, "我買的", "Purchases")}</Link>
        <Link href="/orders?role=sell" className={`grid h-11 place-items-center rounded-full ${selling ? "bg-card font-semibold shadow-card" : "text-muted"}`}>{tx(prefs.locale, "我賣的", "Sales")}</Link>
      </div>
      {orders.length === 0 ? <p className="empty">{tx(prefs.locale, "未有交收。", "No handovers yet.")} {DEAL_RISK}</p> : null}
      <ul className="grid gap-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className="surface block p-4">
              <span className="font-medium">{phaseLabel(prefs.locale, dealPhase(order))}</span>
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
