"use client";

import { useState } from "react";
import Link from "next/link";
import { openThread } from "@/actions/social";
import { bidAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { BuyDock } from "./buy-dock";
import { Countdown } from "./countdown";

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
  loggedIn: boolean;
  bidsVoided: boolean;
  ownerNote: string | null;
  /** One relative line under the price. */
  timeLabel?: string | null;
  timeAt?: string | null;
}) {
  const [bidOpen, setBidOpen] = useState(false);
  const publicBid = currentBid ?? startPrice ?? 0;
  const bidFloor = minBid;
  const bin = (showHandover || showBin) && price != null ? price : null;
  const priced = showHandover && price != null;
  const talk = showHandover ? (
    <div>
      <form id="listing-offer" action={openThread} hidden>
        <input type="hidden" name="listingId" value={id} />
        <input type="hidden" name="focus" value="offer" />
      </form>
      {priced ? (
        <form id="listing-buy" action={openThread} hidden>
          <input type="hidden" name="listingId" value={id} />
          <input type="hidden" name="focus" value="buy" />
        </form>
      ) : null}
      <form id="listing-chat" action={openThread} hidden>
        <input type="hidden" name="listingId" value={id} />
        <input type="hidden" name="focus" value="compose" />
      </form>
      <div className={`grid items-stretch gap-2 ${priced ? "grid-cols-3" : "grid-cols-2"}`}>
        <button form="listing-offer" className="btn btn-primary h-full w-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>議價</button>
        {priced ? <button form="listing-buy" className="btn btn-primary h-full w-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>直接購買</button> : null}
        <button form="listing-chat" className="btn btn-primary h-full w-full px-2" type="submit">聯絡賣家</button>
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
      {bin != null && showHandover ? (
        <div>
          <p className="text-xs font-medium text-muted">{tx(locale, "直購價", "Buy It Now")}</p>
          <p className="price text-2xl leading-none">{formatHkd(bin, locale)}</p>
          {listedAt}
        </div>
      ) : null}
      {showHandover ? talk : null}
      {showBin ? (
        <form id="listing-buy" action={openThread} hidden>
          <input type="hidden" name="listingId" value={id} />
          <input type="hidden" name="focus" value="buy" />
        </form>
      ) : null}
      {live || endsAt ? (
        <div className="grid gap-2">
          <div>
            <p className="text-xs font-medium text-muted">{tx(locale, "目前出價", "Current bid")}</p>
            <p className="price text-2xl leading-none">{formatHkd(publicBid, locale)}</p>
            {showHandover ? null : listedAt}
          </div>
          {live && endsAt ? (
            <p className="text-sm" title={endsText ?? undefined}>
              <span className="text-muted">{tx(locale, "剩餘時間", "Time left")} </span>
              <Countdown endsAt={endsAt} locale={locale} />
            </p>
          ) : (
            <p className="text-sm">{tx(locale, "拍賣已結束", "Auction ended")}</p>
          )}
          <div className={`grid gap-2 ${showBin ? "grid-cols-2" : "grid-cols-1"}`}>
            {showBid ? (
              <button type="button" className="btn btn-primary h-11" onClick={() => setBidOpen(true)}>{tx(locale, "出價", "Bid")}</button>
            ) : null}
            {!loggedIn && live ? (
              <Link className="btn btn-primary h-11" href={`/login?next=/listing/${id}`}>{tx(locale, "登入後出價", "Log in to bid")}</Link>
            ) : null}
            {showBin && price != null ? (
              <button form="listing-buy" className="btn btn-primary h-11" type="submit">{tx(locale, "即買", "Buy It Now")}</button>
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
          label={showHandover && price != null ? tx(locale, "直購價", "Price") : tx(locale, "目前出價", "Current bid")}
          price={showHandover && price != null ? formatHkd(price, locale) : formatHkd(publicBid, locale)}
          note={
            live && endsAt ? (
              <>
                {showHandover ? <span>{tx(locale, "目前出價", "Bid")} {formatHkd(publicBid, locale)} · </span> : null}
                <span>{tx(locale, "剩餘", "Left")} </span>
                <Countdown endsAt={endsAt} locale={locale} />
              </>
            ) : null
          }
        >
          {showHandover ? (
            <div className={`grid shrink-0 gap-1.5 ${priced ? "grid-cols-3" : "grid-cols-2"}`}>
              <button form="listing-offer" className="btn btn-primary h-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>議價</button>
              {priced ? <button form="listing-buy" className="btn btn-primary h-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>直接購買</button> : null}
              <button form="listing-chat" className="btn btn-primary h-full px-2" type="submit">聯絡賣家</button>
            </div>
          ) : null}
          {showBin ? (
            <button form="listing-buy" className="btn btn-primary h-full shrink-0 px-3" type="submit">{tx(locale, "即買", "Buy It Now")}</button>
          ) : null}
          {showBid ? (
            <button type="button" className="btn btn-primary shrink-0 px-3" onClick={() => setBidOpen(true)}>{tx(locale, "出價", "Bid")}</button>
          ) : null}
          {!loggedIn && live && !showHandover ? <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-3">{tx(locale, "登入出價", "Log in")}</Link> : null}
        </BuyDock>
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
