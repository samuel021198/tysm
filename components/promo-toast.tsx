"use client";

import { useEffect, useState } from "react";
import type { PromoToast as PromoToastKind } from "@/lib/promo";

const COPY: Record<PromoToastKind, string> = {
  earn: "＋7 token",
  spend: "推廣 −1",
};

/** Bottom tip above the tab bar. About two seconds, then it goes. */
export function PromoToast({ kind }: { kind: PromoToastKind | null }) {
  const [open, setOpen] = useState(kind != null);
  useEffect(() => {
    if (!kind) return;
    const timer = setTimeout(() => setOpen(false), 2000);
    return () => clearTimeout(timer);
  }, [kind]);
  if (!open || !kind) return null;
  return (
    <p
      role="status"
      className={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold shadow-card bottom-[calc(var(--tab-h)+0.75rem)] ${kind === "earn" ? "text-ok" : "text-muted"}`}
    >
      {COPY[kind]}
    </p>
  );
}
