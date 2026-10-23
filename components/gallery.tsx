"use client";

import { useState } from "react";
import { tx, type Locale } from "@/lib/i18n";

const ROLE: Record<string, [string, string]> = {
  FRONT: ["正面", "Front"],
  BACK: ["背面", "Back"],
  GALLERY: ["細節", "Detail"],
};

export function Gallery({ photos, alt, locale }: { photos: { url: string; role: string }[]; alt: string; locale: Locale }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return <div className="grid aspect-[4/3] place-items-center bg-soft text-sm text-muted md:aspect-[4/5] md:rounded-[1.35rem]">No photo</div>;
  const current = photos[index] ?? photos[0];
  return (
    <div className="-mx-3 md:mx-0">
      <img src={current.url} alt={alt} className="aspect-[4/3] w-full bg-[#f4efe6] object-contain md:aspect-[4/5] md:rounded-[1.35rem]" />
      {photos.length > 1 ? (
        <div className="chips mt-3 md:mx-0">
          {photos.map((photo, i) => (
            <button key={`${photo.url}-${i}`} type="button" onClick={() => setIndex(i)} className={`grid h-20 w-16 shrink-0 gap-0.5 overflow-hidden rounded-xl bg-[#f4efe6] p-1 ring-2 ${i === index ? "ring-teal" : "ring-[#5c3a4a]/35"}`}>
              <img src={photo.url} alt="" className="h-12 w-full object-contain" />
              <span className="truncate text-[10px] font-medium leading-none">{tx(locale, ...(ROLE[photo.role] ?? ROLE.GALLERY))}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
