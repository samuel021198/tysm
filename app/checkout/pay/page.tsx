import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { orderStatusLabel, tx } from "@/lib/i18n";
import { payAction } from "@/actions/trade";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ orders?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/checkout");
  const ids = (sp.orders || "").split(",").filter(Boolean);
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, buyerId: viewer.id },
    include: { items: true },
  });
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{tx(prefs.locale, "模擬付款", "Mock payment")}</h1>
      <p className="text-sm text-muted">{tx(prefs.locale, "成功會進入已託管。失敗會留在待付款。爭議會交給管理員。", "Success moves the order into escrow. Failure leaves it awaiting payment. Dispute sends it to an admin.")}</p>
      {orders.map((order) => (
        <section key={order.id} className="surface p-4">
          <p className="font-medium">{formatHkd(order.total, prefs.locale)} · {orderStatusLabel(prefs.locale, order.status)}</p>
          <ul className="my-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id}>{item.title} × {item.quantity}</li>
            ))}
          </ul>
          {order.status === "PENDING_PAYMENT" ? (
            <form action={payAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <button className="btn btn-primary" name="outcome" value="success">{tx(prefs.locale, "模擬成功", "Mock success")}</button>
              <button className="btn-ghost btn" name="outcome" value="fail">{tx(prefs.locale, "模擬失敗", "Mock fail")}</button>
              <button className="btn-ghost btn" name="outcome" value="dispute">{tx(prefs.locale, "模擬爭議", "Mock dispute")}</button>
            </form>
          ) : (
            <Link href={`/orders/${order.id}`}>{tx(prefs.locale, "查看訂單", "View order")}</Link>
          )}
        </section>
      ))}
    </div>
  );
}
