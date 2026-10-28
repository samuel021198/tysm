import { DEAL_BANNER } from "@/lib/deal-phase";

export function DealDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`shrink-0 rounded-lg bg-soft px-3 py-1.5 text-center text-xs leading-5 text-muted ${className}`}>{DEAL_BANNER}</p>
  );
}
