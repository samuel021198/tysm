"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatHkd } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
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

  return (
    <>
      <div className="sticky top-0 z-20 bg-bg pb-2 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-2">
          <Link href={`/listing/${listingId}`} className="flex min-w-0 flex-1 items-center gap-2">
            <img src={cover || "/demo/back.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-soft object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{title}</span>
              {priceCents != null ? <span className="price mt-0.5 block text-sm">{formatHkd(priceCents, locale)}</span> : null}
            </span>
          </Link>
          <button type="button" className="btn btn-primary shrink-0 px-3 disabled:opacity-40" disabled={offerClosed} onClick={() => setOpen(true)}>
            議價
          </button>
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
