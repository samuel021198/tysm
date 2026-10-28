import Link from "next/link";
import { acceptDealOfferAction, arrangeDealAction, cancelDealAction, confirmAction, declineDealOfferAction, markSoldAction, releaseReserveAction, sellerPaidAction, withdrawDealOfferAction } from "@/actions/trade";
import {
  canArrange,
  canBuyerReceive,
  canCancel,
  canMarkSold,
  canReleaseReserve,
  canSellerConfirm,
  canUploadProof,
  DEAL_BANNER,
  dealBlocked,
  dealEventCopy,
  dealPhase,
  phaseLabel,
  readDealMeta,
  RESERVE_BLOCKED,
  showPaymentDetails,
} from "@/lib/deal-phase";
import { meetupNote } from "@/lib/deals";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { ProofForm } from "./proof-form";

type Item = {
  id: string;
  title: string;
  listingId: string;
  unitPrice: number;
  listing: {
    status: string;
    binLockOrderId: string | null;
    meetupDistrict: string | null;
    meetupWindow: string | null;
    meetupNotes: string | null;
  };
};

type PaymentInfo = { method: string; account: string; holder: string };

type DealProps = {
  locale: Locale;
  viewerId: string;
  next: string;
  reviewed: boolean;
  payment: PaymentInfo | null;
  order: {
    id: string;
    status: string;
    buyerId: string;
    sellerId: string;
    total: number;
    fulfillment: unknown;
    items: Item[];
  };
};

function DealView({
  locale,
  viewerId,
  next,
  order,
  reviewed,
  payment,
  pin = true,
  variant,
}: DealProps & {
  /** Window-sticky on the order page. Ignored for the in-flow stream bubble. */
  pin?: boolean;
  variant: "card" | "stream";
}) {
  const stream = variant === "stream";
  const phase = dealPhase(order);
  const meta = readDealMeta(order.fulfillment);
  const proofs = meta.proofs.length;
  const buyer = viewerId === order.buyerId;
  const seller = viewerId === order.sellerId;
  const listing = order.items[0]?.listing ?? null;
  const sold = order.items.some((item) => item.listing.status === "SOLD");
  const blocked = order.items.some((item) => dealBlocked(phase, item.listing.status, item.listing.binLockOrderId, order.id));
  const note = meetupNote(order.fulfillment, listing);
  const primary = "btn btn-primary w-full";
  const showPayment = !blocked && payment && showPaymentDetails(phase, meta.confirmed === true, proofs) ? payment : null;
  const pending = meta.offer?.status === "PENDING" ? meta.offer : null;
  const accepted = meta.offer?.status === "ACCEPTED" ? meta.offer : null;
  const offerLine = pending ? dealEventCopy(locale, { kind: "offer", name: pending.name, amount: pending.amount, note: pending.note }) : null;

  return (
    <section
      aria-label={phaseLabel(locale, phase)}
      className={
        stream
          ? "mx-auto grid w-full max-w-[18rem] gap-2 rounded-2xl border border-line bg-card px-3 py-2.5"
          : `${pin ? "sticky top-[calc(3rem+env(safe-area-inset-top))] md:top-16" : ""} z-30 grid gap-2 rounded-2xl border border-line bg-card/95 p-3 shadow-card backdrop-blur`
      }
    >
      {stream ? null : <p className="text-xs font-semibold">{DEAL_BANNER}</p>}
      <div className={`flex flex-wrap items-center gap-2 ${stream ? "justify-center" : ""}`}>
        <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{phaseLabel(locale, phase)}</span>
        {sold ? <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{tx(locale, "已售出", "Sold")}</span> : null}
      </div>
      <div className={`text-sm ${stream ? "text-center" : ""}`}>
        {order.items.map((item) => (
          <p key={item.id}>
            <Link href={`/listing/${item.listingId}`} className="font-medium">{item.title}</Link>
          </p>
        ))}
        <p className={`price mt-1 leading-none ${stream ? "text-sm" : "text-lg"}`}>{formatHkd(order.total, locale)}</p>
        {stream ? null : <p className="mt-1 text-xs text-muted">{tx(locale, "議定金額只供顯示，平台唔會收款。", "The amount is shown only. The platform does not charge it.")}</p>}
        {note ? <p className="mt-1 text-xs">{tx(locale, "面交", "Meet-up")} · {note}</p> : null}
      </div>
      {blocked ? <p className="text-sm font-medium">{tx(locale, RESERVE_BLOCKED, "This item is already reserved")}</p> : null}
      {pending && offerLine && (buyer || seller) ? (
        <div className={`grid gap-2 ${stream ? "justify-items-center text-center" : ""}`}>
          <p className="text-sm font-medium">{offerLine.text}</p>
          {offerLine.note ? <p className="text-xs text-muted">{offerLine.note}</p> : null}
          {viewerId === pending.by ? (
            <>
              <p className="text-xs text-muted">{tx(locale, "等待對方回應", "Waiting for a reply")}</p>
              <form action={withdrawDealOfferAction} className="w-full">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={next} />
                <button className="btn btn-ghost w-full">{tx(locale, "撤回要約", "Withdraw")}</button>
              </form>
            </>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2">
              <form action={acceptDealOfferAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={next} />
                <button className={primary}>{tx(locale, "接受要約", "Accept")}</button>
              </form>
              <form action={declineDealOfferAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={next} />
                <button className="btn btn-ghost w-full">{tx(locale, "拒絕", "Decline")}</button>
              </form>
            </div>
          )}
        </div>
      ) : null}
      {phase === "CONFIRMED" && accepted ? (
        <p className={`text-sm font-medium ${stream ? "text-center" : ""}`}>{dealEventCopy(locale, { kind: "accept" }).text}</p>
      ) : null}
      {showPayment ? (
        <div className="rounded-xl bg-soft px-3 py-2 text-sm">
          <p className="text-xs font-semibold">{tx(locale, "付款資料", "Payment details")}</p>
          <p className="mt-1">{[showPayment.method, showPayment.holder, showPayment.account].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-xs text-muted">{tx(locale, "私下轉帳。平台唔會收款。", "Pay the seller directly. The platform does not take payment.")}</p>
        </div>
      ) : null}
      {buyer && !blocked && canUploadProof(phase, proofs) ? <ProofForm locale={locale} orderId={order.id} next={next} /> : null}
      {seller && canSellerConfirm(phase, proofs) ? (
        <form action={sellerPaidAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className={primary}>{tx(locale, "已收款", "Payment received")}</button>
        </form>
      ) : null}
      {buyer && canBuyerReceive(phase) ? (
        <form action={confirmAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className={primary}>{tx(locale, "已收貨", "Item received")}</button>
        </form>
      ) : null}
      {phase === "DONE" && (buyer || seller) && !reviewed ? (
        <Link className={primary} href={`/orders/${order.id}#review`}>{tx(locale, "去評價", "Review")}</Link>
      ) : null}
      {seller && canMarkSold(phase, proofs, sold ? "SOLD" : "ACTIVE") ? (
        <form action={markSoldAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-ghost w-full">{tx(locale, "標記已出售", "Mark sold")}</button>
        </form>
      ) : null}
      {(buyer || seller) && !blocked && canReleaseReserve(phase) ? (
        <form action={releaseReserveAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-ghost w-full">{tx(locale, "解除保留", "Release hold")}</button>
        </form>
      ) : null}
      {(buyer || seller) && !blocked && canArrange(phase) ? (
        <form action={arrangeDealAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-ghost w-full">{tx(locale, "約定交收", "Set meetup")}</button>
        </form>
      ) : null}
      {(buyer || seller) && canCancel(phase, sold ? "SOLD" : "ACTIVE") ? (
        <form action={cancelDealAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className={stream ? "w-full text-center text-xs text-muted underline" : "text-left text-xs text-muted underline"}>{tx(locale, "取消交收", "Cancel handover")}</button>
        </form>
      ) : null}
      {next.startsWith("/messages/") ? (
        <Link className={stream ? "text-center text-xs font-semibold text-link" : "text-xs font-semibold text-link"} href={`/orders/${order.id}`}>{tx(locale, "交收詳情", "Handover details")}</Link>
      ) : null}
    </section>
  );
}

/** Order / 交收詳情 card. Stays pinned on that page. */
export function DealPanel(props: DealProps & { pin?: boolean }) {
  return <DealView {...props} variant="card" />;
}

/** In-flow system bubble on the thread. Same phase gates as the detail card, no sticky bar. */
export function DealStream(props: DealProps) {
  return <DealView {...props} variant="stream" pin={false} />;
}
