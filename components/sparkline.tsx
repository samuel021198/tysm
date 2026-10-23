export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 72;
  const h = 22;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (w - 2) + 1;
      const y = max === min ? h / 2 : h - 2 - ((value - min) / (max - min)) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-5 w-16 ${up ? "text-[#1f7a62]" : "text-[#9e2d3a]"} ${className}`} aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
