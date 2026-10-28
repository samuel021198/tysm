"use client";

import Link from "next/link";
import { bidAction, offerAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { BuyDock } from "./buy-dock";
import { Countdown } from "./countdown";
import { HandoverForm } from "./handover-form";
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
  showHandover,
  showOffer,
  minOffer,
  loggedIn,
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
  showHandover: boolean;
  showOffer: boolean;
  minOffer: number | null;
  loggedIn: boolean;
  bidsVoided: boolean;
  ownerNote: string | null;
}) {
  const publicBid = currentBid ?? startPrice ?? 0;
  const bidFloor = isLeader && yourMax != null ? yourMax + 1 : minBid;

  return (
    <>
      {showHandover && price != null ? (
        <div>
          <p className="text-xs font-medium text-muted">{tx(locale, "直購價", "Buy It Now")}</p>
          <p className="price text-2xl leading-none">{formatHkd(price, locale)}</p>
        </div>
      ) : null}
      {live || endsAt ? (
        <div className="grid gap-1 rounded-2xl bg-soft p-3">
          <p className="text-xs font-medium text-muted">{tx(locale, "目前出價", "Current bid")}</p>
          <p className="price text-xl leading-none">{formatHkd(publicBid, locale)}</p>
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

      {showHandover ? <HandoverForm locale={locale} listingId={id} bargain={false} layout="stack" /> : null}
      <div className="grid gap-2">
        {showBid ? (
          <button form="bid-form" className={`btn w-full ${showHandover ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "出價", "Place bid")}</button>
        ) : null}
        {!loggedIn && live ? (
          <Link className={`btn w-full ${showHandover ? "btn-ghost" : "btn-primary"}`} href={`/login?next=/listing/${id}`}>{tx(locale, "登入後出價", "Log in to bid")}</Link>
        ) : null}
      </div>

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
          {showHandover ? <button form="handover-form" className="btn btn-primary shrink-0 px-3">{tx(locale, "傾交收", "Arrange")}</button> : null}
          {showBid ? <button form="bid-form" className={`btn shrink-0 px-3 ${showHandover ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "出價", "Bid")}</button> : null}
          {!loggedIn && live && !showHandover ? <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-3">{tx(locale, "登入出價", "Log in")}</Link> : null}
        </BuyDock>
      ) : null}
    </>
  );
}
