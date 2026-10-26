"use client";

import { useState } from "react";
import { tx, type Locale } from "@/lib/i18n";

export function Gallery({ photos, alt, locale }: { photos: { url: string; role: string }[]; alt: string; locale: Locale }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return <div className="grid aspect-[4/3] place-items-center bg-soft text-sm text-muted md:aspect-[4/5] md:rounded-2xl">No photo</div>;
  const current = photos[index] ?? photos[0];
  return (
    <div className="-mx-3 md:mx-0">
      <img src={current.url} alt={alt} className="aspect-[4/3] w-full bg-soft object-contain md:aspect-[4/5] md:rounded-2xl" />
      {photos.length > 1 ? (
        <div className="chips mt-3 md:mx-0">
          {photos.map((photo, i) => (
            <button key={`${photo.url}-${i}`} type="button" onClick={() => setIndex(i)} className={`grid h-20 w-16 shrink-0 gap-0.5 overflow-hidden rounded-xl bg-soft p-1 ring-2 ${i === index ? "ring-accent" : "ring-line"}`}>
              <img src={photo.url} alt="" className="h-12 w-full object-contain" />
              <span className="truncate text-[10px] font-medium leading-none">{i === 0 ? tx(locale, "封面", "Cover") : i + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
