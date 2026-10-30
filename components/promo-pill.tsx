/** Small accent beside a price. Hidden when the listing is not promoted. */
export function PromoPill({ promoted }: { promoted?: boolean }) {
  if (!promoted) return null;
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold leading-none text-ink">
      推廣
    </span>
  );
}
