"use client";

import { useEffect, useState, type ReactNode } from "react";

export function BuyDock({
  watchId,
  label,
  price,
  children,
}: {
  watchId: string;
  label: string;
  price: string;
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
    <div
      className="fixed inset-x-0 z-30 px-3 md:hidden"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-card/95 px-3 py-2 shadow-card backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted">{label}</p>
          <p className="price truncate text-lg">{price}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
