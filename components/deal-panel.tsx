import Link from "next/link";
import { acceptDealOfferAction, confirmHandoverAction, declineDealOfferAction, withdrawDealOfferAction } from "@/actions/trade";
import {
  canConfirmHandover,
  DEAL_BANNER,
  dealBlocked,
  dealEventCopy,
  dealPhase,
  handoverFlags,
  phaseLabel,
  readDealMeta,
  RESERVE_BLOCKED,
} from "@/lib/deal-phase";
import { meetupNote } from "@/lib/deals";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { DealRatingForm } from "./deal-rating-form";
import { ReviseOfferButton, type OfferChoice } from "./offer-sheet";

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
  /** This viewer's post-deal rating. Null means not yet. Omit outside the chat bubble. */
  rating?: { stars: number; comment?: string } | null;
  payment: PaymentInfo | null;
  names?: { buyer: string; seller: string };
  /** Counterparty 改價回覆. Same make-offer form, prefilled. */
  revise?: {
    threadId: string;
    riskAcked: boolean;
    listing: OfferChoice;
    priceCents: number;
    note: string;
  } | null;
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
  rating,
  names,
  revise = null,
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
  const buyer = viewerId === order.buyerId;
  const seller = viewerId === order.sellerId;
  const flags = handoverFlags(order);
  const mine = buyer ? flags.buyer : seller ? flags.seller : false;
  const peer = buyer ? flags.seller : seller ? flags.buyer : false;
  const listing = order.items[0]?.listing ?? null;
  const sold = order.items.some((item) => item.listing.status === "SOLD");
  const blocked = order.items.some((item) => dealBlocked(phase, item.listing.status, item.listing.binLockOrderId, order.id));
  const note = meetupNote(order.fulfillment, listing);
  const primary = "btn btn-primary w-full";
  const pending = meta.offer?.status === "PENDING" ? meta.offer : null;
  const accepted = meta.offer?.status === "ACCEPTED" ? meta.offer : null;
  const offerLine = pending ? dealEventCopy(locale, { kind: "offer", name: pending.name, amount: pending.amount, note: pending.note }) : null;
  const waitingRaw = pending ? (pending.by === order.buyerId ? names?.seller : pending.by === order.sellerId ? names?.buyer : "") : "";
  const waitingLabel = waitingRaw?.trim() || tx(locale, "對方", "them");

  return (
    <section
      aria-label={phaseLabel(locale, phase)}
      className={
        stream
          ? "mx-auto grid w-full max-w-[18rem] gap-2 rounded-2xl border border-line bg-card px-3 py-2.5"
          : `${pin ? "sticky top-[calc(3rem+env(safe-area-inset-top))] md:top-16" : ""} z-30 grid gap-2 rounded-2xl border border-line bg-card/95 p-3 shadow-card backdrop-blur`
      }
    >
      <div className={`flex flex-wrap items-center gap-2 ${stream ? "justify-center" : ""}`}>
        <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{phaseLabel(locale, phase)}</span>
        {sold ? <span className="inline-flex h-7 items-center rounded-full bg-soft px-2.5 text-xs font-semibold">{tx(locale, "已售出", "Sold")}</span> : null}
      </div>
      {stream ? (
        pending || note ? (
          <div className="text-center text-sm">
            {pending ? <p className="text-sm font-semibold leading-none">{formatHkd(pending.amount, locale)}</p> : null}
            {pending?.note ? <p className="mt-1 text-xs">{pending.note}</p> : null}
            {!pending && note ? <p className="text-xs">{tx(locale, "面交", "Meet-up")} · {note}</p> : null}
          </div>
        ) : null
      ) : (
        <div className="text-sm">
          {order.items.map((item) => (
            <p key={item.id}>
              <Link href={`/listing/${item.listingId}`} className="font-medium">{item.title}</Link>
            </p>
          ))}
          <p className="price mt-1 text-lg leading-none">{formatHkd(order.total, locale)}</p>
          <p className="mt-1 text-xs text-muted">{tx(locale, "金額僅供顯示，平台不經手收款。", "The amount is shown only. The platform does not take payment.")}</p>
          {note ? <p className="mt-1 text-xs">{tx(locale, "面交", "Meet-up")} · {note}</p> : null}
        </div>
      )}
      {blocked ? <p className={`text-sm font-medium ${stream ? "text-center" : ""}`}>{tx(locale, RESERVE_BLOCKED, "This item is locked.")}</p> : null}
      {pending && offerLine && (buyer || seller) ? (
        <div className={`grid gap-2 ${stream ? "justify-items-center text-center" : ""}`}>
          {stream ? (
            <>
              <p className="text-xs">{tx(locale, `提出：${pending.name}`, `Proposed by ${pending.name}`)}</p>
              <p className="text-xs">{tx(locale, `等待：${waitingLabel}`, `Waiting on ${waitingLabel}`)}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{offerLine.text}</p>
              {offerLine.note ? <p className="text-xs text-muted">{offerLine.note}</p> : null}
            </>
          )}
          {stream && viewerId === pending.by ? (
            <form action={withdrawDealOfferAction} className="w-full">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="next" value={next} />
              <button className="btn btn-ghost w-full">{tx(locale, "撤回", "Withdraw")}</button>
            </form>
          ) : null}
          {stream && !blocked && viewerId !== pending.by ? (
            <div className="grid w-full gap-2">
              <form action={acceptDealOfferAction} className="w-full">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={next} />
                <button className={primary}>{tx(locale, "接受", "Accept")}</button>
              </form>
              {revise ? (
                <ReviseOfferButton
                  locale={locale}
                  threadId={revise.threadId}
                  listing={revise.listing}
                  priceCents={revise.priceCents}
                  note={revise.note}
                  riskAcked={revise.riskAcked}
                />
              ) : null}
              <form action={declineDealOfferAction} className="w-full">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={next} />
                <button className="btn btn-ghost w-full">{tx(locale, "拒絕", "Decline")}</button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === "CONFIRMED" && accepted ? (
        <div className={stream ? "text-center" : ""}>
          <p className="text-sm font-medium">{dealEventCopy(locale, { kind: "accept" }).text}</p>
          {accepted.note ? <p className="mt-1 text-xs">{accepted.note}</p> : null}
        </div>
      ) : null}
      {stream && (buyer || seller) && !blocked && canConfirmHandover(phase, mine) ? (
        <form action={confirmHandoverAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="next" value={next} />
          <button className={primary}>{tx(locale, "確認交收", "Confirm handover")}</button>
        </form>
      ) : null}
      {stream && (buyer || seller) && mine && !peer ? <p className="text-center text-sm">{tx(locale, "待對方確認交收。", "Waiting for the other person to confirm.")}</p> : null}
      {stream && phase === "DONE" && (buyer || seller) ? (
        <div className="grid gap-2">
          {rating ? (
            <div className="text-center text-xs text-muted">
              <p>{tx(locale, `已評分 ${"★".repeat(rating.stars)}`, `Rated ${"★".repeat(rating.stars)}`)}</p>
              {rating.comment ? <p>{rating.comment}</p> : null}
            </div>
          ) : (
            <DealRatingForm locale={locale} orderId={order.id} />
          )}
        </div>
      ) : null}
      {next.startsWith("/messages/") ? (
        <Link className={stream ? "text-center text-xs font-semibold text-link" : "text-xs font-semibold text-link"} href={`/orders/${order.id}`}>{tx(locale, "交收詳情", "Handover details")}</Link>
      ) : null}
      {stream ? null : <p className="text-xs text-muted">{DEAL_BANNER}</p>}
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
