import Link from "next/link";
import { arrangeDealAction, cancelDealAction, confirmAction, confirmDealAction, markSoldAction, releaseReserveAction, sellerPaidAction } from "@/actions/trade";
import {
  canArrange,
  canBuyerReceive,
  canCancel,
  canMarkSold,
  canReleaseReserve,
  canSellerConfirm,
  canSellerLock,
  canUploadProof,
  DEAL_BANNER,
  dealBlocked,
  dealPhase,
  phaseLabel,
  PROOF_WAIT,
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

export function DealPanel({
  locale,
  viewerId,
  next,
  order,
  reviewed,
  payment,
}: {
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
}) {
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

  return (
    <section className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-30 grid gap-2 rounded-2xl border border-line bg-card/95 p-3 shadow-card backdrop-blur md:top-16">
      <p className="text-xs font-semibold">{DEAL_BANNER}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{phaseLabel(locale, phase)}</span>
        {sold ? <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{tx(locale, "已售出", "Sold")}</span> : null}
      </div>
      <div className="text-sm">
        {order.items.map((item) => (
          <p key={item.id}>
            <Link href={`/listing/${item.listingId}`} className="font-medium">{item.title}</Link>
          </p>
        ))}
        <p className="price mt-1 text-lg leading-none">{formatHkd(order.total, locale)}</p>
        <p className="mt-1 text-xs text-muted">{tx(locale, "議定金額只供顯示，平台唔會收款。", "The amount is shown only. The platform does not charge it.")}</p>
        {note ? <p className="mt-1 text-xs">{tx(locale, "面交", "Meet-up")} · {note}</p> : null}
      </div>
      {blocked ? <p className="text-sm font-medium">{tx(locale, RESERVE_BLOCKED, "This item is already reserved")}</p> : null}
      {buyer && !blocked && (phase === "CHATTING" || phase === "ARRANGED") ? (
        <p className="text-sm text-muted">{tx(locale, PROOF_WAIT, "Wait for the seller to confirm the deal before uploading payment proof")}</p>
      ) : null}
      {seller && !blocked && listing?.status === "ACTIVE" && canSellerLock(phase) ? (
        <form action={confirmDealAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className={primary}>{tx(locale, "確認交易", "Confirm deal")}</button>
        </form>
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
      {seller && !blocked && canReleaseReserve(phase) ? (
        <form action={releaseReserveAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-ghost w-full">{tx(locale, "解除保留", "Release reserve")}</button>
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
          <button className="text-left text-xs text-muted underline">{tx(locale, "取消交收", "Cancel handover")}</button>
        </form>
      ) : null}
      {next.startsWith("/messages/") ? (
        <Link className="text-xs font-semibold text-link" href={`/orders/${order.id}`}>{tx(locale, "交收詳情", "Handover details")}</Link>
      ) : null}
    </section>
  );
}
