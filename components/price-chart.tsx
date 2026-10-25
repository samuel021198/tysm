import { formatJpy } from "@/lib/format";
import type { SnkrPoint } from "@/lib/snkrdunk";

function compactJpy(yen: number): string {
  if (yen >= 10000) {
    const man = yen / 10000;
    const text = man >= 10 ? String(Math.round(man)) : man.toFixed(1).replace(/\.0$/, "");
    return `¥${text}萬`;
  }
  return formatJpy(yen);
}

export function PriceChart({ points, label }: { points: SnkrPoint[]; label: string }) {
  if (points.length < 2) return null;
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const w = 320;
  const h = 148;
  const padL = 52;
  const padR = 8;
  const padT = 10;
  const padB = 8;
  const coords = prices.map((price, index) => {
    const x = padL + (index / (prices.length - 1)) * (w - padL - padR);
    const y = max === min ? (padT + h - padB) / 2 : padT + (1 - (price - min) / (max - min)) * (h - padT - padB);
    return [x, y] as const;
  });
  const line = coords.map((pair) => pair.join(",")).join(" ");
  const area = `${coords[0]![0]},${h - padB} ${line} ${coords[coords.length - 1]![0]},${h - padB}`;
  const ticks = max === min ? [max] : [max, Math.round((max + min) / 2), min];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="mt-2 h-40 w-full text-ink">
      {ticks.map((tick) => {
        const y = max === min ? (padT + h - padB) / 2 : padT + (1 - (tick - min) / (max - min)) * (h - padT - padB);
        return (
          <g key={tick}>
            <text x="0" y={y + 3} fill="currentColor" opacity="0.55" fontSize="10">
              {compactJpy(tick)}
            </text>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" />
          </g>
        );
      })}
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
