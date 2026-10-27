"use client";

/** One photo wide. Horizontal swipe is native snap; vertical scroll stays with the page. */
export function PhotoStrip({ photos }: { photos: string[] }) {
  return (
    <div
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-gesture=""
      onPointerDown={(event) => event.stopPropagation()}
    >
      {photos.map((url, index) => (
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          className="block aspect-[4/5] min-w-full shrink-0 snap-center bg-soft object-cover"
        />
      ))}
    </div>
  );
}
