"use client";

import { useState } from "react";
import { ackP2pRisk, makeDealOfferAction } from "@/actions/trade";
import { DEAL_ACK, OFFER_EMPTY, offerEntry, offerFormLocked } from "@/lib/deal-phase";
import { centsToInput, formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { DealDisclaimer } from "./deal-disclaimer";

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
  acked,
  persisted,
  prefill = null,
  priceOnly = false,
  submitLabel,
  onAcked,
  onClose,
}: {
  locale: Locale;
  threadId: string;
  bound: OfferChoice | null;
  choices: OfferChoice[];
  /** This visit, including a checkbox just ticked. */
  acked: boolean;
  /** Already stored on the account when the thread loaded. */
  persisted: boolean;
  /** 改價回覆 opens this same form with the live price and note. */
  prefill?: { priceCents: number; note: string } | null;
  /** Listing and chat 議價. Price only; the + menu keeps the note. */
  priceOnly?: boolean;
  /** Overrides the submit label. A counter sends with 送出. */
  submitLabel?: string;
  onAcked: () => void;
  onClose: () => void;
}) {
  const entry = offerEntry(Boolean(bound), choices.length);
  const [picked, setPicked] = useState<OfferChoice | null>(entry === "bound" ? bound : entry === "auto" ? (choices[0] ?? null) : null);
  const listing = picked;
  const locked = offerFormLocked(acked, false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={priceOnly ? "議價" : tx(locale, "議價", "Offer")}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "關閉", "Close")} onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card">
        <DealDisclaimer className="mb-3" />
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
          <form
            action={async (formData) => {
              await makeDealOfferAction(formData);
              onClose();
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="threadId" value={threadId} />
            <input type="hidden" name="listingId" value={listing.id} />
            {acked && !persisted ? <input type="hidden" name="ack" value="1" /> : null}
            {!acked ? (
              <label className="flex items-start gap-2.5 rounded-2xl border border-line bg-soft px-3 py-2.5 text-sm leading-5">
                <input
                  type="checkbox"
                  name="ack"
                  value="1"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#3d8ea3]"
                  onChange={(event) => {
                    if (!event.target.checked) return;
                    onAcked();
                    void ackP2pRisk();
                  }}
                />
                <span>{DEAL_ACK}</span>
              </label>
            ) : null}
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
              {priceOnly ? "價錢" : tx(locale, "最終價錢", "Final price")}
              <input
                className="field disabled:opacity-40"
                name="price"
                inputMode="decimal"
                required
                disabled={locked}
                autoFocus={priceOnly}
                defaultValue={prefill ? centsToInput(prefill.priceCents) : listing.priceCents != null ? centsToInput(listing.priceCents) : ""}
                placeholder="HK$"
                aria-label={priceOnly ? "價錢" : tx(locale, "最終價錢", "Final price")}
              />
            </label>
            {priceOnly && prefill?.note ? <input type="hidden" name="note" value={prefill.note} /> : null}
            {priceOnly ? null : (
              <label className="grid gap-1 text-xs font-semibold">
                {tx(locale, "交收備註", "Handover note")}
                <input
                  className="field disabled:opacity-40"
                  name="note"
                  maxLength={80}
                  disabled={locked}
                  defaultValue={prefill?.note ?? ""}
                  placeholder={tx(locale, "時間／地點／方式", "Time, place, or method")}
                  aria-label={tx(locale, "交收備註", "Handover note")}
                />
              </label>
            )}
            <button className="btn btn-primary w-full disabled:opacity-40" disabled={locked}>{submitLabel ?? (priceOnly ? "議價" : tx(locale, "議價", "Offer"))}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/** Counterparty entry into the same make-offer form. Submit replaces the live offer. */
export function ReviseOfferButton({
  locale,
  threadId,
  listing,
  priceCents,
  note,
  riskAcked,
  label,
  priceOnly = false,
  submitLabel,
}: {
  locale: Locale;
  threadId: string;
  listing: OfferChoice;
  priceCents: number;
  note: string;
  riskAcked: boolean;
  /** Seller counter. Buyer re-bid keeps 改價回覆. */
  label?: string;
  priceOnly?: boolean;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(riskAcked);
  if (riskAcked && !acked) setAcked(true);
  return (
    <>
      <button type="button" className="btn btn-ghost w-full" onClick={() => setOpen(true)}>
        {label ?? tx(locale, "改價回覆", "Revise price")}
      </button>
      {open ? (
        <OfferSheet
          locale={locale}
          threadId={threadId}
          bound={listing}
          choices={[]}
          acked={acked}
          persisted={riskAcked}
          prefill={{ priceCents, note }}
          priceOnly={priceOnly}
          submitLabel={submitLabel}
          onAcked={() => setAcked(true)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
