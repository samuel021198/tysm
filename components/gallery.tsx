"use client";

import { useState } from "react";

export function Gallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (!urls.length) return <div className="grid aspect-[4/5] place-items-center rounded-2xl bg-soft text-sm text-muted">No photo</div>;
  return (
    <div>
      <img src={urls[index]} alt={alt} className="aspect-[4/5] w-full rounded-2xl bg-soft object-cover" />
      {urls.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {urls.map((url, i) => (
            <button key={`${url}-${i}`} type="button" onClick={() => setIndex(i)} className={i === index ? "rounded-lg ring-2 ring-teal" : "rounded-lg"}>
              <img src={url} alt="" className="h-16 w-14 rounded-lg object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
