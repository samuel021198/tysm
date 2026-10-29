"use client";

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
  yourMax,
  isLeader,
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
  yourMax: number | null;
  isLeader: boolean;
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
  const publicBid = currentBid ?? startPrice ?? 0;
  const bidFloor = isLeader && yourMax != null ? yourMax + 1 : minBid;
  const bin = showHandover && price != null ? price : null;
  const priced = price != null;
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
      {bin != null ? (
        <div>
          <p className="text-xs font-medium text-muted">{tx(locale, "直購價", "Buy It Now")}</p>
          <p className="price text-2xl leading-none">{formatHkd(bin, locale)}</p>
          {listedAt}
        </div>
      ) : null}
      {bin != null ? talk : null}
      {live || endsAt ? (
        <div className="grid gap-1 rounded-2xl bg-soft p-3">
          <p className="text-xs font-medium text-muted">{tx(locale, "目前出價", "Current bid")}</p>
          <p className="price text-xl leading-none">{formatHkd(publicBid, locale)}</p>
          {bin != null ? null : listedAt}
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
      {bin == null ? talk : null}
      {bidsVoided ? <p className="text-sm">{tx(locale, "直購已成交，所有出價作廢。", "Buy It Now ended the auction. Bids are void.")}</p> : null}

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
          {showBid ? <button form="bid-form" className={`btn shrink-0 px-3 ${showHandover ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "出價", "Bid")}</button> : null}
          {!loggedIn && live && !showHandover ? <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-3">{tx(locale, "登入出價", "Log in")}</Link> : null}
        </BuyDock>
      ) : null}
    </>
  );
}
