import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { dealPhase } from "@/lib/deal-phase";
import { meetupNote, sellerPayment } from "@/lib/deals";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { DealPanel } from "@/components/deal-panel";
import { Flash } from "@/components/shell";
import { replyReviewAction } from "@/actions/social";

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
      items: { include: { listing: true } },
      reviews: { include: { author: true, subject: true } },
      buyer: true,
      seller: true,
    },
  });
  if (!order || (order.buyerId !== viewer.id && order.sellerId !== viewer.id && viewer.role !== "ADMIN")) notFound();
  const locale = prefs.locale;
  const buyer = viewer.id === order.buyerId;
  const seller = viewer.id === order.sellerId;
  const phase = dealPhase(order);
  const listingId = order.items[0]?.listingId;
  const thread = listingId
    ? await prisma.messageThread.findFirst({
        where: { listingId, buyerId: order.buyerId, sellerId: order.sellerId },
      })
    : null;
  const note = meetupNote(order.fulfillment, order.items[0]?.listing ?? null);

  return (
    <div className="grid gap-4">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <h1 className="page-title mb-0">{tx(locale, "交收", "Handover")}</h1>
      {(buyer || seller) ? (
        <DealPanel
          locale={locale}
          viewerId={viewer.id}
          next={`/orders/${id}`}
          payment={sellerPayment(order.seller)}
          order={order}
        />
      ) : null}
      <ul className="text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <Link href={`/listing/${item.listingId}`}>{item.title}</Link>
            {item.conditionLabel ? ` · ${item.conditionLabel}` : ""} · {formatHkd(item.unitPrice, locale)} × {item.quantity}
          </li>
        ))}
      </ul>
      <p className="price text-xl">{formatHkd(order.total, locale)}</p>
      <p className="text-xs text-muted">{tx(locale, "議定金額只供顯示，平台不代收款。", "The amount is shown only. The platform does not take payment.")}</p>
      {note ? <p className="text-sm">{tx(locale, "面交", "Meet-up")} · {note}</p> : null}
      <p className="text-sm text-muted">
        {tx(locale, "買家", "Buyer")} {order.buyer.nickname} · {tx(locale, "賣家", "Seller")} {order.seller.nickname}
      </p>
      {thread ? <Link className="text-sm font-semibold text-link" href={`/messages/${thread.id}`}>{tx(locale, "打開聊天", "Open chat")}</Link> : null}
      {phase === "DONE" && order.reviews.length ? (
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
        </section>
      ) : null}
    </div>
  );
}
