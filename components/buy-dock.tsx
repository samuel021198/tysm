"use client";

import { useEffect, useState, type ReactNode } from "react";

export function BuyDock({
  watchId,
  label,
  price,
  note,
  children,
}: {
  watchId: string;
  label: string;
  price: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 z-30 px-3 md:hidden" style={{ bottom: "var(--tab-h)" }}>
      <div className="flex flex-wrap items-center gap-2 rounded-[1.25rem] bg-card px-3 py-2 shadow-card">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted">{label}</p>
          <p className="price truncate text-lg">{price}</p>
          {note ? <p className="text-xs leading-5 text-ink">{note}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
