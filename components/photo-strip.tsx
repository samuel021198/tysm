"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Full-bleed snap pages plus dots. A drag does not open the post; a tap does. */
export function PhotoStrip({
  photos,
  href,
  imageClass = "block max-h-[70vh] w-full bg-soft object-contain",
}: {
  photos: string[];
  href?: string;
  imageClass?: string;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [index, setIndex] = useState(0);

  function sync() {
    const el = scroller.current;
    if (!el || el.clientWidth < 1) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min(photos.length - 1, next)));
  }

  function go(i: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "manipulation" }}
        data-gesture=""
        aria-roledescription="carousel"
        onScroll={sync}
        onPointerDown={(event) => {
          start.current = { x: event.clientX, y: event.clientY };
          dragged.current = false;
        }}
        onPointerMove={(event) => {
          const origin = start.current;
          if (!origin) return;
          if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) dragged.current = true;
        }}
        onClick={(event) => {
          if (dragged.current) {
            event.preventDefault();
            event.stopPropagation();
            dragged.current = false;
            return;
          }
          if (!href) return;
          const path = href.split("?")[0].split("#")[0];
          if (window.location.pathname === path) return;
          router.push(href);
        }}
      >
        {photos.map((url, i) => (
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className={`min-w-full shrink-0 snap-center ${imageClass}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-1 py-1.5">
        {photos.map((url, i) => (
          <button
            key={`${url}-dot-${i}`}
            type="button"
            aria-label={`${i + 1} / ${photos.length}`}
            aria-current={i === index ? "true" : undefined}
            className="grid h-6 w-6 place-items-center"
            onClick={(event) => {
              event.stopPropagation();
              go(i);
            }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-ink" : "bg-ink/30"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
