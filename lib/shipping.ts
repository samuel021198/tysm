export const SHIP_METHODS = ["SF", "LOCKER", "MEET"] as const;
export type ShipMethod = (typeof SHIP_METHODS)[number];

export type ShipQuote = {
  shippingFee: number;
  shipLockerFee: number;
  shipMeetFee: number;
  shippingDays: number;
};

export function parseShipMethod(value: string | null | undefined): ShipMethod {
  if (value === "LOCKER" || value === "MEET") return value;
  return "SF";
}

export function shipFee(listing: ShipQuote, method: ShipMethod): number {
  if (method === "LOCKER") return Math.max(0, listing.shipLockerFee);
  if (method === "MEET") return Math.max(0, listing.shipMeetFee);
  return Math.max(0, listing.shippingFee);
}

export function shipDays(listing: { shippingDays: number }, method: ShipMethod): number {
  if (method === "MEET") return 1;
  if (method === "LOCKER") return Math.min(30, Math.max(1, listing.shippingDays + 1));
  return Math.max(1, listing.shippingDays);
}

export function shipMethodLabel(method: string, locale: "zh-HK" | "en"): string {
  const zh: Record<string, string> = {
    SF: "順豐速運",
    LOCKER: "順豐智能櫃",
    MEET: "面交",
  };
  const en: Record<string, string> = {
    SF: "SF Express",
    LOCKER: "SF locker",
    MEET: "Meet-up",
  };
  const table = locale === "en" ? en : zh;
  return table[method] ?? table.SF;
}

export function courierFor(method: string): string {
  if (method === "MEET") return "面交";
  if (method === "LOCKER") return "順豐智能櫃";
  return "順豐速運";
}

export function mockTracking(orderId: string, method: string): string {
  if (method === "MEET") return "MEETUP";
  let n = 0;
  for (const char of orderId) n = (n * 33 + char.charCodeAt(0)) % 100000000;
  const digits = String(n).padStart(8, "0");
  return method === "LOCKER" ? `EF${digits}HK` : `SF${digits}HK`;
}

export function onTimePercent(orders: { shippedAt: Date | null; shipBy: Date | null }[]): number | null {
  const judged = orders.filter((order) => order.shippedAt && order.shipBy);
  if (!judged.length) return null;
  const onTime = judged.filter((order) => order.shippedAt! <= order.shipBy!).length;
  return Math.round((onTime / judged.length) * 100);
}
