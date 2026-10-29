"use client";

import Link from "next/link";
import { useState } from "react";
import { openThread } from "@/actions/social";
import { bidAction, buyItNowAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { BuyDock } from "./buy-dock";
import { Countdown } from "./countdown";
import { Icon } from "./icons";

export function PurchasePanel({
  locale,
  id,
  price,
  currentBid,
  startPrice,
  minBid,
  showBin = false,
  live,
  endsAt,
  endsText,
  showBid,
  bidBanned,
  showHandover,
  offerClosed = false,
  /** This buyer already has an open deal, so 直接購買 / 即買 would come back 交收狀態不允許. */
  buyClosed = false,
  hasBids = false,
  loggedIn,
  bidsVoided,
  ownerNote,
  timeLabel = null,
  timeAt = null,
}: {
  locale: Locale;
  id: string;
  price: number | null;
  currentBid: number | null;
  startPrice: number | null;
  minBid: number;
  /** Auction Buy It Now. Fixed-price listings keep 直接購買 on showHandover. */
  showBin?: boolean;
  live: boolean;
  endsAt: string | null;
  endsText: string | null;
  showBid: boolean;
  bidBanned: boolean;
  showHandover: boolean;
  /** Grey 議價 while the listing is 已保留 or sold. 聯絡賣家 stays on. */
  offerClosed?: boolean;
  buyClosed?: boolean;
  hasBids?: boolean;
  loggedIn: boolean;
  bidsVoided: boolean;
  ownerNote: string | null;
  /** One relative line under the price. */
  timeLabel?: string | null;
  timeAt?: string | null;
}) {
  const [bidOpen, setBidOpen] = useState(false);
  const [confirmBin, setConfirmBin] = useState(false);
  const publicBid = hasBids ? (currentBid ?? startPrice ?? 0) : (startPrice ?? currentBid ?? 0);
  const bidLabel = hasBids ? tx(locale, "目前出價", "Current bid") : tx(locale, "起標價", "Starting price");
  const bidFloor = minBid;
  const showBuy = showHandover && price != null && !buyClosed;
  const binVisible = showBin && price != null;
  const canBin = binVisible && !buyClosed;
  const binLabel = `${tx(locale, "即買", "Buy now")} ${formatHkd(price ?? 0, locale)}`;
  const contactLabel = tx(locale, "聯絡賣家", "Message the seller");
  const talk = showHandover ? (
    <div>
      <form id="listing-offer" action={openThread} hidden>
        <input type="hidden" name="listingId" value={id} />
        <input type="hidden" name="focus" value="offer" />
      </form>
      {showBuy ? (
        <form id="listing-buy" action={openThread} hidden>
          <input type="hidden" name="listingId" value={id} />
          <input type="hidden" name="focus" value="buy" />
        </form>
      ) : null}
      <form id="listing-chat" action={openThread} hidden>
        <input type="hidden" name="listingId" value={id} />
        <input type="hidden" name="focus" value="compose" />
      </form>
      <div className="grid gap-2">
        <div className={`grid items-stretch gap-2 ${showBuy ? "grid-cols-2" : "grid-cols-1"}`}>
          <button form="listing-offer" className="btn btn-primary h-full w-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>議價</button>
          {showBuy ? <button form="listing-buy" className="btn btn-primary h-full w-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>直接購買</button> : null}
        </div>
        <button form="listing-chat" className="btn btn-ghost w-full" type="submit">聯絡賣家</button>
      </div>
    </div>
  ) : null;
  const listedAt = timeLabel ? (
    <time dateTime={timeAt || undefined} className="mt-1 block text-xs font-normal leading-4 text-muted">
      {timeLabel}
    </time>
  ) : null;

  return (
    <>
      {showHandover && price != null ? (
        <div>
          <p className="text-xs font-medium text-muted">{tx(locale, "直購價", "Buy It Now")}</p>
          <p className="price text-2xl leading-none">{formatHkd(price, locale)}</p>
          {listedAt}
        </div>
      ) : null}
      {showHandover ? talk : null}
      {canBin ? (
        <form id="listing-bin" action={buyItNowAction} hidden>
          <input type="hidden" name="listingId" value={id} />
        </form>
      ) : null}
      {live || endsAt ? (
        <div className="grid gap-2">
          {binVisible ? (
            <div>
              <p className="text-xs font-medium text-muted">{tx(locale, "即買", "Buy now")}</p>
              <p className="price text-2xl leading-none">{formatHkd(price ?? 0, locale)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium text-muted">{bidLabel}</p>
            <p className="price text-2xl leading-none">{formatHkd(publicBid, locale)}</p>
            {showHandover || binVisible ? null : listedAt}
          </div>
          {live && endsAt ? (
            <p className="text-sm" title={endsText ?? undefined}>
              <span className="text-muted">{tx(locale, "剩餘時間", "Time left")} </span>
              <Countdown endsAt={endsAt} locale={locale} />
            </p>
          ) : (
            <p className="text-sm">{tx(locale, "拍賣已結束", "Auction ended")}</p>
          )}
          {live ? <p className="text-sm">{tx(locale, "下一口最低", "Next minimum")} {formatHkd(minBid, locale)}</p> : null}
          <div className={`grid gap-2 ${canBin ? "grid-cols-2" : "grid-cols-1"}`}>
            {showBid ? (
              <button type="button" className="btn btn-primary h-11" onClick={() => setBidOpen(true)}>{tx(locale, "出價", "Bid")}</button>
            ) : null}
            {!loggedIn && live ? (
              <Link className="btn btn-primary h-11" href={`/login?next=/listing/${id}`}>{tx(locale, "登入後出價", "Log in to bid")}</Link>
            ) : null}
            {canBin ? (
              <button type="button" className="btn btn-primary h-11" onClick={() => setConfirmBin(true)}>{binLabel}</button>
            ) : null}
          </div>
        </div>
      ) : null}
      {bidsVoided ? <p className="text-sm">{tx(locale, "直購已成交，所有出價作廢。", "Buy It Now ended the auction. Bids are void.")}</p> : null}

      {bidBanned ? <p className="text-sm text-danger">{tx(locale, "你已被禁止出價。", "Bidding is disabled on your account.")}</p> : null}
      {bidOpen ? <BidSheet locale={locale} id={id} placeholder={String(Math.ceil(bidFloor / 100))} onClose={() => setBidOpen(false)} /> : null}

      {ownerNote ? <p className="text-sm text-muted">{ownerNote}</p> : null}

      {live || showHandover ? (
        <BuyDock
          watchId="purchase"
          label={live ? bidLabel : showHandover && price != null ? tx(locale, "直購價", "Price") : bidLabel}
          price={live ? formatHkd(publicBid, locale) : showHandover && price != null ? formatHkd(price, locale) : formatHkd(publicBid, locale)}
          note={
            live && endsAt ? (
              <>
                {binVisible ? <span>{binLabel} · </span> : null}
                <span>{tx(locale, "剩餘", "Left")} </span>
                <Countdown endsAt={endsAt} locale={locale} />
              </>
            ) : null
          }
        >
          {showHandover ? (
            <div className="grid shrink-0 grid-cols-[1fr_auto] items-stretch gap-1.5">
              <div className={`grid gap-1.5 ${showBuy ? "grid-cols-2" : "grid-cols-1"}`}>
                <button form="listing-offer" className="btn btn-primary h-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>議價</button>
                {showBuy ? <button form="listing-buy" className="btn btn-primary h-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>直接購買</button> : null}
              </div>
              <button form="listing-chat" className="btn btn-ghost h-full px-2" type="submit" aria-label={contactLabel} title={contactLabel}>
                <Icon name="messages" className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
          {canBin ? (
            <button type="button" className="btn btn-primary h-full shrink-0 px-3" onClick={() => setConfirmBin(true)}>{binLabel}</button>
          ) : null}
          {showBid ? (
            <button type="button" className="btn btn-primary shrink-0 px-3" onClick={() => setBidOpen(true)}>{tx(locale, "出價", "Bid")}</button>
          ) : null}
          {!loggedIn && live && !showHandover ? <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-3">{tx(locale, "登入出價", "Log in")}</Link> : null}
        </BuyDock>
      ) : null}
      {confirmBin && price != null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={tx(locale, "即買", "Buy now")}>
          <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "取消", "Cancel")} onClick={() => setConfirmBin(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card">
            <p className="text-sm font-semibold">{tx(locale, "即買", "Buy now")}</p>
            <p className="price mt-1 text-2xl leading-none">{formatHkd(price, locale)}</p>
            <p className="mt-2 text-sm text-muted">{tx(locale, "確認後拍賣結束，貨品會保留俾你傾交收。", "Confirming ends the auction and reserves the card for handover.")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost w-full" onClick={() => setConfirmBin(false)}>取消</button>
              <button type="submit" form="listing-bin" className="btn btn-primary w-full">確認</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function BidSheet({ locale, id, placeholder, onClose }: { locale: Locale; id: string; placeholder: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={tx(locale, "出價", "Bid")}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "關閉", "Close")} onClick={onClose} />
      <form action={bidAction} className="relative z-10 grid w-full max-w-lg gap-3 rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card">
        <input type="hidden" name="listingId" value={id} />
        <input className="field" name="amount" inputMode="decimal" required autoFocus aria-label={tx(locale, "出價", "Bid")} placeholder={placeholder} />
        <button className="btn btn-primary w-full" type="submit">{tx(locale, "出價", "Bid")}</button>
      </form>
    </div>
  );
}
