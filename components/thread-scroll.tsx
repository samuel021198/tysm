"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const pins = new Set<() => void>();

/** A send should show the latest row even if the reader had scrolled up. */
export function pinThreadToEnd() {
  pins.forEach((pin) => pin());
}

/** Opens on the latest row. Stays there when a new row arrives, unless the reader has scrolled up.
 * ponytail: a photo that finishes loading later can still push the last row down. Upgrade: pin again on image load only while still at the bottom.
 */
export function ThreadScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pin = useRef(true);

  useLayoutEffect(() => {
    const force = () => {
      pin.current = true;
    };
    pins.add(force);
    return () => {
      pins.delete(force);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !pin.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 1) return;
    el.scrollTop = el.scrollHeight;
  });

  return (
    <div
      ref={ref}
      className="thread-log"
      onScroll={(event) => {
        const el = event.currentTarget;
        pin.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
      }}
    >
      {children}
    </div>
  );
}
