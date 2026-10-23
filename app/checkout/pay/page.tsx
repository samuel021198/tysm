import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { orderStatusLabel, tx } from "@/lib/i18n";
import { shipMethodLabel } from "@/lib/shipping";
import { PayActions } from "@/components/pay-actions";

const BRAND: Record<string, [string, string]> = {
  FPS: ["轉數快 FPS", "FPS"],
  PAYME: ["PayMe", "PayMe"],
  CARD: ["信用卡 / 扣帳卡", "Card"],
};

export default async function PayPage({ searchParams }: { searchParams: Promise<{ orders?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/checkout");
  const ids = (sp.orders || "").split(",").filter(Boolean);
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, buyerId: viewer.id },
    include: { items: true, seller: true },
  });
  const locale = prefs.locale;
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div>
        <h1 className="page-title">{tx(locale, "付款", "Payment")}</h1>
        <p className="text-sm text-muted">{tx(locale, "請核對金額。確認後款項進入託管，賣家寄出同你收貨後先至完成。", "Check the total. After you confirm, funds sit in escrow until the card is delivered.")}</p>
      </div>
      {orders.map((order) => {
        const brand = BRAND[order.paymentBrand || "FPS"] ?? BRAND.FPS;
        return (
          <section key={order.id} className="surface grid gap-3 p-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img src={item.imageUrl || "/demo/back.svg"} alt="" className="h-20 w-16 rounded-xl bg-[#f4efe6] object-contain" />
                <div className="text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted">{order.seller.nickname} · × {item.quantity}</p>
                  <p>{tx(locale, "貨價", "Item")} {formatHkd(item.unitPrice * item.quantity, locale)}</p>
                  <p className="text-muted">{tx(locale, "運費", "Shipping")} {formatHkd(item.shippingFee, locale)}</p>
                </div>
              </div>
            ))}
            <div className="grid gap-1 text-sm">
              <div className="flex justify-between"><span>{tx(locale, "貨品", "Items")}</span><span>{formatHkd(order.subtotal, locale)}</span></div>
              <div className="flex justify-between"><span>{shipMethodLabel(order.shippingMethod || "SF", locale)}</span><span>{formatHkd(order.shippingTotal, locale)}</span></div>
              <div className="flex justify-between font-semibold"><span>{tx(locale, "應付總額", "Total")}</span><span className="price">{formatHkd(order.total, locale)}</span></div>
              <p className="text-muted">{tx(locale, brand[0], brand[1])} · {orderStatusLabel(locale, order.status)}</p>
            </div>
            {order.status === "PENDING_PAYMENT" ? (
              <PayActions locale={locale} orderId={order.id} />
            ) : (
              <Link className="btn btn-primary" href={`/orders/${order.id}`}>{tx(locale, "查看訂單", "View order")}</Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
