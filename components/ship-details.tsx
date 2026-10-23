import type { Locale } from "@/lib/i18n";
import { describeShip } from "@/lib/shipping";

export function ShipDetails({
  locale,
  method,
  fulfillment,
}: {
  locale: Locale;
  method: string | null;
  fulfillment: unknown;
}) {
  const lines = describeShip(locale, method, fulfillment);
  if (!lines.length) return null;
  return (
    <div className="grid gap-1 text-sm">
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  );
}
