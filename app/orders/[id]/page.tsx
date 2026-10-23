import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT } from "@/lib/format";
import { bpsToPercentLabel } from "@/lib/rules";
import { orderStatusLabel, tx } from "@/lib/i18n";
import { sweep } from "@/lib/orders";
import { Flash } from "@/components/shell";
import { appealAction, cancelOrderAction, confirmAction, disputeAction, payAction, shipAction } from "@/actions/trade";
import { PayActions } from "@/components/pay-actions";
import { shipMethodLabel } from "@/lib/shipping";
import { replyReviewAction, reviewAction } from "@/actions/social";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await sweep();
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/orders/${id}`);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      dispute: true,
      reviews: { include: { author: true, subject: true } },
      buyer: true,
      seller: true,
    },
  });
  if (!order || (order.buyerId !== viewer.id && order.sellerId !== viewer.id && viewer.role !== "ADMIN")) notFound();
  const locale = prefs.locale;
  const buyer = viewer.id === order.buyerId;
  const seller = viewer.id === order.sellerId;
  const snap = order.addressSnapshot as { recipient?: string; phone?: string; line1?: string; district?: string } | null;
  const addresses = buyer && order.status === "PENDING_PAYMENT" ? await prisma.address.findMany({ where: { userId: viewer.id } }) : [];
  const chain = ["PENDING_PAYMENT", "IN_ESCROW", "AWAITING_SHIP", "SHIPPED", "COMPLETED"];

  return (
    <div className="grid gap-4">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <h1 className="text-2xl font-semibold">{orderStatusLabel(locale, order.status)}</h1>
      <p className="text-sm text-muted">
        {chain.map((status) => (status === order.status ? `【${orderStatusLabel(locale, status)}】` : orderStatusLabel(locale, status))).join(" → ")}
        {order.status === "DISPUTED" || order.status === "REFUNDED" || order.status === "CANCELLED" ? ` · ${orderStatusLabel(locale, order.status)}` : ""}
      </p>
      <ul className="text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <Link href={`/listing/${item.listingId}`}>{item.title}</Link> · {item.conditionLabel} · {formatHkd(item.unitPrice, locale)} × {item.quantity} + {tx(locale, "運費", "shipping")} {formatHkd(item.shippingFee, locale)}
          </li>
        ))}
      </ul>
      <p>{tx(locale, "貨品", "Items")} {formatHkd(order.subtotal, locale)} · {shipMethodLabel(order.shippingMethod || "SF", locale)} {formatHkd(order.shippingTotal, locale)}</p>
      <p className="price text-2xl">{tx(locale, "合計", "Total")} {formatHkd(order.total, locale)}</p>
      {order.trackingNumber || order.courierName ? (
        <p className="text-sm">
          {order.courierName || shipMethodLabel(order.shippingMethod || "SF", locale)}
          {order.trackingNumber ? ` · ${tx(locale, "運單", "Tracking")} ${order.trackingNumber}` : ""}
        </p>
      ) : null}
      {seller || viewer.role === "ADMIN" ? (
        <p className="text-sm">
          {tx(locale, "佣金", "Commission")} {bpsToPercentLabel(order.commissionBps)}% · {formatHkd(order.commissionAmount, locale)} · {tx(locale, "賣家實收", "Seller receives")} {formatHkd(order.sellerProceeds, locale)}
        </p>
      ) : null}
      <p className="text-sm text-muted">
        {tx(locale, "買家", "Buyer")} {order.buyer.nickname} · {tx(locale, "賣家", "Seller")} {order.seller.nickname}
        {order.payBy && order.status === "PENDING_PAYMENT" ? ` · ${tx(locale, "請於", "Pay by")} ${formatHKT(order.payBy, locale)}` : ""}
        {order.shipBy ? ` · ${tx(locale, "建議寄出", "Ship by")} ${formatHKT(order.shipBy, locale)}` : ""}
        {order.autoReleaseAt && order.status === "SHIPPED" ? ` · ${tx(locale, "自動完成", "Auto release")} ${formatHKT(order.autoReleaseAt, locale)}` : ""}
      </p>
      {snap?.line1 ? <p className="text-sm">{snap.recipient} · {snap.phone} · {snap.district} {snap.line1}</p> : <p className="text-sm">{tx(locale, "未有收貨地址。", "No shipping address yet.")}</p>}

      {buyer && order.status === "PENDING_PAYMENT" && !snap?.line1 ? (
        <form action={payAction} className="grid max-w-lg gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          {addresses.map((address) => (
            <label key={address.id} className="flex gap-2 text-sm">
              <input type="radio" name="addressId" value={address.id} required />
              {address.recipient} {address.district} {address.line1}
            </label>
          ))}
          <button className="btn btn-primary w-fit">{tx(locale, "儲存地址", "Save address")}</button>
        </form>
      ) : null}
      {buyer && order.status === "PENDING_PAYMENT" && snap?.line1 ? (
        <PayActions locale={locale} orderId={order.id} />
      ) : null}
      {buyer && order.status === "PENDING_PAYMENT" ? (
        <form action={cancelOrderAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="text-sm underline">{tx(locale, "取消訂單", "Cancel order")}</button>
        </form>
      ) : null}
      {seller && order.status === "IN_ESCROW" ? (
        <form action={shipAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn btn-primary" name="step" value="pack">{tx(locale, "標記待寄出", "Mark awaiting shipment")}</button>
        </form>
      ) : null}
      {seller && order.status === "AWAITING_SHIP" ? (
        <form action={shipAction} className="grid max-w-lg gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <label className="grid gap-1 text-sm">
            {tx(locale, "快遞", "Courier")}
            <select className="field" name="courier" defaultValue={order.courierName || shipMethodLabel(order.shippingMethod || "SF", "zh-HK")}>
              <option>順豐速運</option>
              <option>順豐智能櫃</option>
              <option>面交</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            {tx(locale, "運單號碼", "Tracking number")}
            <input className="field" name="tracking" placeholder={order.shippingMethod === "MEET" ? tx(locale, "面交可留空", "Optional for meet-up") : "SF12345678HK"} />
          </label>
          <button className="btn btn-primary w-fit" name="step" value="ship">{tx(locale, "確認寄出", "Confirm shipment")}</button>
        </form>
      ) : null}
      {buyer && order.status === "SHIPPED" ? (
        <form action={confirmAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn btn-primary">{tx(locale, "確認收貨並完成託管", "Confirm delivery and release escrow")}</button>
        </form>
      ) : null}
      {buyer && ["IN_ESCROW", "AWAITING_SHIP", "SHIPPED"].includes(order.status) && !order.dispute ? (
        <form action={disputeAction} className="grid max-w-lg gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <textarea className="field" name="reason" required minLength={4} placeholder={tx(locale, "爭議原因", "Dispute reason")} />
          <button className="btn-ghost btn w-fit">{tx(locale, "開啟爭議", "Open dispute")}</button>
        </form>
      ) : null}
      {order.dispute ? (
        <section className="surface p-4 text-sm">
          <h2 className="font-semibold">{tx(locale, "爭議", "Dispute")} · {order.dispute.status}</h2>
          <p className="mt-1">{order.dispute.reason}</p>
          {order.dispute.decisionNote ? <p className="mt-1">{order.dispute.decisionNote}</p> : null}
          {order.dispute.appealReason ? <p className="mt-1">{tx(locale, "上訴", "Appeal")}: {order.dispute.appealReason}</p> : null}
          {order.dispute.returnShippingDue ? <p className="mt-2 text-danger">{tx(locale, "買家勝訴：賣家須支付退回運費。", "Buyer won: the seller pays return shipping.")}</p> : null}
          {((order.dispute.status === "BUYER_WINS" && seller) || (order.dispute.status === "SELLER_WINS" && buyer)) ? (
            <form action={appealAction} className="mt-3 grid gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <textarea className="field" name="reason" required minLength={4} placeholder={tx(locale, "上訴只可以一次", "You can appeal once")} />
              <button className="btn-ghost btn w-fit">{tx(locale, "提出上訴", "Appeal")}</button>
            </form>
          ) : null}
        </section>
      ) : null}
      {order.status === "COMPLETED" ? (
        <section className="grid gap-3">
          <h2 className="font-semibold">{tx(locale, "評價", "Reviews")}</h2>
          {order.reviews.map((review) => (
            <article key={review.id} className="text-sm">
              <p>{review.author.nickname} → {review.subject.nickname} · {"★".repeat(review.stars)}</p>
              <p>{review.comment}</p>
              {review.reply ? <p className="text-muted">{tx(locale, "回覆", "Reply")}: {review.reply}</p> : null}
              {review.subjectId === viewer.id && !review.reply ? (
                <form action={replyReviewAction} className="mt-2 grid gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="reviewId" value={review.id} />
                  <textarea className="field" name="reply" required />
                  <button className="btn-ghost btn w-fit">{tx(locale, "回覆", "Reply")}</button>
                </form>
              ) : null}
            </article>
          ))}
          {order.completedAt && order.completedAt.getTime() + 30 * 24 * 60 * 60 * 1000 > Date.now() && !order.reviews.some((review) => review.authorId === viewer.id) && (buyer || seller) ? (
            <form action={reviewAction} className="grid max-w-lg gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <select className="field" name="stars" defaultValue="5">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <option key={stars} value={stars}>{stars}</option>
                ))}
              </select>
              <textarea className="field" name="comment" required />
              <button className="btn btn-primary w-fit">{tx(locale, "送出評價", "Post review")}</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
