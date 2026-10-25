/** Tile / header line: `SV2a 001`. Numeric locals keep three digits. `193/165` becomes `193`. */
export function compactSetLine(setCode?: string | null, collectorNumber?: string | null): string {
  const code = (setCode || "").replace(/\s+/g, " ").trim();
  const local = (collectorNumber || "").split("/")[0]?.trim() || "";
  const number = /^\d+$/.test(local) ? local.padStart(3, "0") : local;
  return [code, number].filter(Boolean).join(" ");
}
