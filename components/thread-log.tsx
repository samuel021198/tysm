"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Message scroller. The sticky bar's height is the scroll-padding, so the first bubble stays below the card at the top. */
export function ThreadLog({ sticky, children }: { sticky: ReactNode; children: ReactNode }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setHeight(Math.ceil(bar.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="thread-log" style={{ scrollPaddingTop: height }}>
      <div ref={barRef} className="sticky top-0 z-30 bg-[var(--bg)] pb-3">
        {sticky}
      </div>
      {children}
    </div>
  );
}
