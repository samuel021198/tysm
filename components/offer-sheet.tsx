"use client";

import { useState } from "react";
import { makeDealOfferAction } from "@/actions/trade";
import { OFFER_EMPTY, offerEntry } from "@/lib/deal-phase";
import { centsToInput, formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";

export type OfferChoice = {
  id: string;
  title: string;
  priceCents: number | null;
  cover: string | null;
};

export function OfferSheet({
  locale,
  threadId,
  bound,
  choices,
  onClose,
}: {
  locale: Locale;
  threadId: string;
  bound: OfferChoice | null;
  choices: OfferChoice[];
  onClose: () => void;
}) {
  const entry = offerEntry(Boolean(bound), choices.length);
  const [picked, setPicked] = useState<OfferChoice | null>(entry === "bound" ? bound : entry === "auto" ? (choices[0] ?? null) : null);
  const listing = picked;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={tx(locale, "提出要約", "Make offer")}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "關閉", "Close")} onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card">
        {entry === "empty" ? (
          <p className="py-6 text-center text-sm">{tx(locale, OFFER_EMPTY, "They have nothing you can offer on right now")}</p>
        ) : null}
        {entry === "pick" && !listing ? (
          <div className="grid gap-2">
            <p className="text-sm font-semibold">{tx(locale, "揀一件貨", "Choose a listing")}</p>
            <ul className="grid gap-1">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-soft" onClick={() => setPicked(choice)}>
                    <img src={choice.cover || "/demo/back.svg"} alt="" className="h-14 w-11 rounded-lg bg-soft object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{choice.title}</span>
                      {choice.priceCents != null ? <span className="price mt-0.5 block text-sm">{formatHkd(choice.priceCents, locale)}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {listing ? (
          <form action={makeDealOfferAction} className="grid gap-3">
            <input type="hidden" name="threadId" value={threadId} />
            <input type="hidden" name="listingId" value={listing.id} />
            <div>
              {entry === "pick" ? (
                <button type="button" className="mb-2 text-xs font-semibold text-link" onClick={() => setPicked(null)}>
                  {tx(locale, "返回", "Back")}
                </button>
              ) : null}
              <p className="font-semibold">{listing.title}</p>
              {listing.priceCents != null ? <p className="price mt-1 text-sm">{formatHkd(listing.priceCents, locale)}</p> : null}
            </div>
            <label className="grid gap-1 text-xs font-semibold">
              {tx(locale, "最終價錢", "Final price")}
              <input
                className="field"
                name="price"
                inputMode="decimal"
                required
                defaultValue={listing.priceCents != null ? centsToInput(listing.priceCents) : ""}
                placeholder="HK$"
                aria-label={tx(locale, "最終價錢", "Final price")}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              {tx(locale, "交收備註", "Handover note")}
              <input
                className="field"
                name="note"
                maxLength={80}
                placeholder={tx(locale, "時間／地點／方式", "Time, place, or method")}
                aria-label={tx(locale, "交收備註", "Handover note")}
              />
            </label>
            <button className="btn btn-primary w-full">{tx(locale, "提出要約", "Make offer")}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
