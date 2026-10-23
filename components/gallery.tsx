"use client";

import { useState } from "react";

export function Gallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (!urls.length) return <div className="grid aspect-[4/3] place-items-center bg-soft text-sm text-muted md:aspect-[4/5] md:rounded-[1.35rem]">No photo</div>;
  return (
    <div className="-mx-3 md:mx-0">
      <img src={urls[index]} alt={alt} className="aspect-[4/3] w-full bg-[#f4efe6] object-contain md:aspect-[4/5] md:rounded-[1.35rem]" />
      {urls.length > 1 ? (
        <div className="chips mt-3 md:mx-0">
          {urls.map((url, i) => (
            <button key={`${url}-${i}`} type="button" onClick={() => setIndex(i)} className={`h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f4efe6] ring-2 ${i === index ? "ring-teal" : "ring-[#5c3a4a]/35"}`}>
              <img src={url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
