"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Sticky deal bar overlays the scroller. Content inset matches its height so the first bubble starts below the card. */
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
    <div className="thread-log">
      <div className="thread-log-scroll" style={{ paddingTop: height, scrollPaddingTop: height }}>
        {children}
      </div>
      <div ref={barRef} className="absolute inset-x-0 top-0 z-30 pb-3">
        {sticky}
      </div>
    </div>
  );
}
