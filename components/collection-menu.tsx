"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toggleCollectionVisibility } from "@/actions/collect";
import { tx, type Locale } from "@/lib/i18n";
import { useHoldSwipe } from "./use-hold-swipe";

/** Owner long-press or swipe-left on a collection thumb. */
export function CollectionMenu({
  locale,
  sellHref,
  itemId,
  visibility,
  next,
  children,
}: {
  locale: Locale;
  sellHref: string | null;
  itemId: string;
  visibility: "PUBLIC" | "PRIVATE";
  next: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const row = "flex h-11 w-full items-center px-3 text-left text-sm font-medium";
  const privacy = visibility === "PUBLIC" ? tx(locale, "改為私人", "Make private") : tx(locale, "改為公開", "Make public");
  const gesture = useHoldSwipe({ onLongPress: () => setOpen(true), onSwipeLeft: () => setOpen(true), edgeGuard: true });

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className="relative"
      data-card-swipe=""
      {...gesture}
      onContextMenu={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
    >
      {children}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={() => setOpen(false)}>
          <div
            role="menu"
            aria-label={tx(locale, "更多", "More")}
            className="w-full max-w-lg border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:max-w-xs md:rounded-2xl md:pb-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {sellHref ? (
              <Link href={sellHref} role="menuitem" className={row}>
                {tx(locale, "放賣", "List for sale")}
              </Link>
            ) : null}
            <form action={toggleCollectionVisibility}>
              <input type="hidden" name="id" value={itemId} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" role="menuitem" className={row}>
                {privacy}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
