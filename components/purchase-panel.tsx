"use client";

import { useState } from "react";
import Link from "next/link";
import { bidAction, cartAdd, offerAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { BuyDock } from "./buy-dock";
import { Countdown } from "./countdown";
import { Submit } from "./submit";

export function PurchasePanel({
  locale,
  id,
  price,
  currentBid,
  startPrice,
  minBid,
  yourMax,
  isLeader,
  live,
  endsAt,
  endsText,
  showBid,
  bidBanned,
  showBuy,
  quantityMax,
  showOffer,
  minOffer,
  loggedIn,
  binLocked,
  bidsVoided,
  ownerNote,
}: {
  locale: Locale;
  id: string;
  price: number | null;
  currentBid: number | null;
  startPrice: number | null;
  minBid: number;
  yourMax: number | null;
  isLeader: boolean;
  live: boolean;
  endsAt: string | null;
  endsText: string | null;
  showBid: boolean;
  bidBanned: boolean;
  showBuy: boolean;
  quantityMax: number;
  showOffer: boolean;
  minOffer: number | null;
  loggedIn: boolean;
  binLocked: boolean;
  bidsVoided: boolean;
  ownerNote: string | null;
}) {
  const [qty, setQty] = useState(1);
  const publicBid = currentBid ?? startPrice ?? 0;
  const bidFloor = isLeader && yourMax != null ? yourMax + 1 : minBid;
  const buyHref = `/checkout?buy=${id}&qty=${qty}`;

  return (
    <>
      {showBuy && price != null ? (
        <div>
          <p className="text-xs font-medium text-muted">{tx(locale, "直購價", "Buy It Now")}</p>
          <p className="price text-3xl">{formatHkd(price, locale)}</p>
        </div>
      ) : null}
      {live || endsAt ? (
        <div className="grid gap-1 rounded-2xl bg-soft p-3">
          <p className="text-xs font-medium text-muted">{tx(locale, "目前出價", "Current bid")}</p>
          <p className="price text-2xl">{formatHkd(publicBid, locale)}</p>
          {live ? (
            <p className="text-sm">
              {tx(locale, "下一口最低", "Next minimum")} {formatHkd(minBid, locale)}
            </p>
          ) : (
            <p className="text-sm">{tx(locale, "拍賣已結束", "Auction ended")}</p>
          )}
          {live && endsAt ? (
            <p className="text-sm">
              <span className="text-muted">{tx(locale, "剩餘時間", "Time left")} </span>
              <Countdown endsAt={endsAt} locale={locale} />
            </p>
          ) : null}
          {endsText ? <p className="text-xs text-muted">{tx(locale, "結束時間", "Ends")} {endsText}</p> : null}
          {yourMax != null ? (
            <p className="text-sm">{tx(locale, "你的最高出價（只有你睇到）", "Your maximum (private)")} {formatHkd(yourMax, locale)}</p>
          ) : null}
          {isLeader ? <p className="text-xs text-muted">{tx(locale, "你目前領先。加價要高過你自己的最高出價。", "You are leading. A new bid must be above your own maximum.")}</p> : null}
        </div>
      ) : null}
      {bidsVoided ? <p className="text-sm">{tx(locale, "直購已成交，所有出價作廢。", "Buy It Now ended the auction. Bids are void.")}</p> : null}
      {binLocked ? <p className="text-sm">{tx(locale, "有買家正在結帳。", "A buyer is checking out.")}</p> : null}

      {showBuy ? (
        <label className="grid gap-1 text-sm">
          {tx(locale, "數量", "Quantity")}
          <input className="field" type="number" min={1} max={quantityMax} value={qty} onChange={(event) => setQty(Math.max(1, Math.min(quantityMax, Number(event.target.value) || 1)))} />
        </label>
      ) : null}

      <div className="grid gap-2">
        {showBuy ? (
          <Link className="btn btn-primary w-full" href={buyHref}>{tx(locale, "立即購買", "Buy now")}</Link>
        ) : null}
        {showBid ? (
          <button form="bid-form" className={`btn w-full ${showBuy ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "出價", "Place bid")}</button>
        ) : null}
        {showBuy ? (
          <button form="cart-form" className="btn btn-ghost w-full">{tx(locale, "加入購物車", "Add to cart")}</button>
        ) : null}
        {!loggedIn && live ? (
          <Link className={`btn w-full ${showBuy ? "btn-ghost" : "btn-primary"}`} href={`/login?next=/listing/${id}`}>{tx(locale, "登入後出價", "Log in to bid")}</Link>
        ) : null}
      </div>

      {showBuy ? (
        <form id="cart-form" action={cartAdd}>
          <input type="hidden" name="listingId" value={id} />
          <input type="hidden" name="quantity" value={qty} />
        </form>
      ) : null}
      {showBid ? (
        <form id="bid-form" action={bidAction} className="grid gap-2">
          <input type="hidden" name="listingId" value={id} />
          <label className="grid gap-1 text-sm">
            {tx(locale, "你的最高出價 HKD", "Your maximum bid HKD")}
            <input className="field" name="max" inputMode="decimal" placeholder={String(Math.ceil(bidFloor / 100))} required />
          </label>
          <p className="text-xs text-muted">
            {isLeader
              ? tx(locale, "公開下一口仍然係上面嘅最低價。呢度只係你私下嘅上限。", "The public next bid stays the minimum above. This field is only your private ceiling.")
              : tx(locale, "系統會代你出到呢個上限，唔會一次過公開全數。", "We bid up to this ceiling for you. The full amount stays private.")}
          </p>
        </form>
      ) : null}
      {bidBanned ? <p className="text-sm text-danger">{tx(locale, "你已被禁止出價。", "Bidding is disabled on your account.")}</p> : null}

      {showOffer && minOffer != null ? (
        <form action={offerAction} className="grid gap-2">
          <input type="hidden" name="listingId" value={id} />
          <label className="grid gap-1 text-sm">
            {tx(locale, "你的議價 HKD", "Your offer HKD")}
            <input className="field" name="amount" inputMode="decimal" required />
          </label>
          <p className="text-xs text-muted">{tx(locale, "最低接受價", "Minimum offer")} {formatHkd(minOffer, locale)} · {tx(locale, "最多 3 輪，24 小時有效", "3 rounds, valid for 24 hours")}</p>
          <Submit label={tx(locale, "送出議價", "Send offer")} pendingLabel="…" />
        </form>
      ) : null}
      {ownerNote ? <p className="text-sm text-muted">{ownerNote}</p> : null}

      {live || showBuy ? (
        <BuyDock
          watchId="purchase"
          label={showBuy ? tx(locale, "直購價", "Buy now") : tx(locale, "目前出價", "Current bid")}
          price={showBuy && price != null ? formatHkd(price, locale) : formatHkd(publicBid, locale)}
          note={
            live && endsAt ? (
              <>
                {showBuy ? <span>{tx(locale, "目前出價", "Bid")} {formatHkd(publicBid, locale)} · </span> : null}
                <span>{tx(locale, "剩餘", "Left")} </span>
                <Countdown endsAt={endsAt} locale={locale} />
              </>
            ) : null
          }
        >
          {showBuy ? <Link href={buyHref} className="btn btn-primary shrink-0 px-3">{tx(locale, "立即購買", "Buy now")}</Link> : null}
          {showBid ? <button form="bid-form" className={`btn shrink-0 px-3 ${showBuy ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "出價", "Bid")}</button> : null}
          {!loggedIn && live && !showBuy ? <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-3">{tx(locale, "登入出價", "Log in")}</Link> : null}
          {showBuy ? <button form="cart-form" className="btn btn-ghost shrink-0 px-3">{tx(locale, "購物車", "Cart")}</button> : null}
        </BuyDock>
      ) : null}
    </>
  );
}
