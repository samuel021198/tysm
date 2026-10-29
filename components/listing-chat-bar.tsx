"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chooseDirectBuy, chooseInquiry } from "@/actions/social";
import { confirmDirectBuyAction, markDirectSoldAction } from "@/actions/trade";
import { DIRECT_WAIT, type PinAction } from "@/lib/deal-phase";
import { formatHkd } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { NameLine, type VerificationTierName } from "./profile-header";
import { OfferSheet } from "./offer-sheet";

/** Pinned listing row. Sticks to the top of the message list while it scrolls. */
export function ListingChatBar({
  locale,
  threadId,
  listingId,
  title,
  priceCents,
  cover,
  openOffer = false,
  offerClosed = false,
  riskAcked = false,
  mode,
  priced = false,
  seller = null,
}: {
  locale: Locale;
  threadId: string;
  listingId: string;
  title: string;
  priceCents: number | null;
  cover: string | null;
  /** Landed from the listing 議價 button. */
  openOffer?: boolean;
  /** 已保留 or sold: the button stays, and does not open a new offer. */
  offerClosed?: boolean;
  riskAcked?: boolean;
  mode: PinAction;
  /** Listing has a buy-now price. Direct buy stays off auctions. */
  priced?: boolean;
  /** Name, verification pill, and ★ under the price. The pill sits outside the product link. */
  seller?: {
    id: string;
    nickname: string;
    tier: VerificationTierName;
    rating: { average: number; count: number } | null;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(riskAcked);
  if (riskAcked && !acked) setAcked(true);

  useEffect(() => {
    if (!openOffer || offerClosed) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("offer") !== "1") return;
    setOpen(true);
    params.delete("offer");
    const q = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [openOffer, offerClosed]);

  const bargain = mode === "ask" || mode === "switch" || mode === "seller-offer" || mode === "closed";
  const row = mode === "ask" || mode === "switch";
  const cols = mode === "ask" ? (priced ? "grid-cols-3" : "grid-cols-2") : priced ? "grid-cols-2" : "grid-cols-1";

  return (
    <>
      <div className="sticky top-0 z-20 bg-bg pb-2 pt-2">
        <div className="rounded-2xl border border-line bg-card p-2">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link href={`/listing/${listingId}`} className="shrink-0">
                <img src={cover || "/demo/back.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-soft object-cover" />
              </Link>
              <span className="min-w-0 flex-1">
                <Link href={`/listing/${listingId}`} className="block min-w-0">
                  <span className="block truncate text-sm font-semibold">{title}</span>
                  {priceCents != null ? <span className="price mt-0.5 block text-sm">{formatHkd(priceCents, locale)}</span> : null}
                </Link>
                {seller ? (
                  <NameLine
                    className="mt-0.5 text-xs"
                    name={<Link href={`/shop/${seller.id}`} className="font-medium">{seller.nickname}</Link>}
                    nameClassName="truncate"
                    tier={seller.tier}
                    locale={locale}
                    rating={seller.rating}
                  />
                ) : null}
              </span>
            </div>
            {bargain && !row ? (
              <button type="button" className="btn btn-primary shrink-0 px-3 disabled:opacity-40" disabled={offerClosed} onClick={() => setOpen(true)}>
                議價
              </button>
            ) : null}
          </div>
          {row ? (
            <div className={`mt-2 grid gap-2 ${cols}`}>
              <button type="button" className="btn btn-primary h-full w-full px-2 disabled:opacity-40" disabled={offerClosed} onClick={() => setOpen(true)}>
                議價
              </button>
              {priced ? (
                <form action={chooseDirectBuy}>
                  <input type="hidden" name="threadId" value={threadId} />
                  <button className="btn btn-primary h-full w-full px-2 disabled:opacity-40" type="submit" disabled={offerClosed}>直接購買</button>
                </form>
              ) : null}
              {mode === "ask" ? (
                <form action={chooseInquiry}>
                  <input type="hidden" name="threadId" value={threadId} />
                  <button className="btn btn-primary h-full w-full px-2" type="submit">查詢</button>
                </form>
              ) : null}
            </div>
          ) : null}
          {mode === "direct-seller" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <form action={confirmDirectBuyAction}>
                <input type="hidden" name="threadId" value={threadId} />
                <button className="btn btn-primary h-full w-full px-2" type="submit">確認</button>
              </form>
              <form action={markDirectSoldAction}>
                <input type="hidden" name="threadId" value={threadId} />
                <button className="btn btn-ghost h-full w-full px-2" type="submit">已售</button>
              </form>
            </div>
          ) : null}
          {mode === "direct-buyer" ? <p className="mt-2 text-center text-xs text-muted">{DIRECT_WAIT}</p> : null}
        </div>
      </div>
      {open ? (
        <OfferSheet
          locale={locale}
          threadId={threadId}
          bound={{ id: listingId, title, priceCents, cover }}
          choices={[]}
          acked={acked}
          persisted={riskAcked}
          priceOnly
          onAcked={() => setAcked(true)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
