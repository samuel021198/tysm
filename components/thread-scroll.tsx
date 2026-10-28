"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Opens on the latest row. The log is only a scroller — nothing overlays it and nothing pads the top.
 * ponytail: one shot on mount. A photo that finishes loading later can push the deal bubble down if the user has not scrolled. Upgrade: pin again on image load only while still at the bottom.
 */
export function ThreadScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <div ref={ref} className="thread-log">
      {children}
    </div>
  );
}
