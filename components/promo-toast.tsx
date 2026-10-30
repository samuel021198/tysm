"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { promoTipParts, type PromoTip } from "@/lib/promo";
import { Icon } from "./icons";

/** Bottom tip above the tab bar. About two seconds, then it goes. Reopens when a new kind arrives. */
export function PromoToast({ kind, locale = "zh-HK" }: { kind: PromoTip | null; locale?: Locale }) {
  const [open, setOpen] = useState(kind != null);
  useEffect(() => {
    if (!kind) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const timer = setTimeout(() => setOpen(false), 2000);
    return () => clearTimeout(timer);
  }, [kind]);
  if (!open || !kind) return null;
  const parts = promoTipParts(kind, locale === "en" ? "en" : "zh-HK");
  return (
    <p
      role="status"
      className={`pointer-events-none fixed left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold shadow-card bottom-[calc(var(--tab-h)+0.75rem)] ${kind === "earn" ? "text-ok" : "text-muted"}`}
    >
      <Icon name="ticket" className="h-3.5 w-3.5 shrink-0" />
      <span>
        {parts.lead}
        {parts.pop ? <span className="promo-pop">{parts.pop}</span> : null}
        {parts.tail}
      </span>
    </p>
  );
}
