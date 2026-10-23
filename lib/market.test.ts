import { minimumNextBid } from "./rules";
import { courierFor, mockTracking, onTimePercent, parseShipMethod, shipDays, shipFee } from "./shipping";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const quote = { shippingFee: 2000, shipLockerFee: 1200, shipMeetFee: 0, shippingDays: 2 };
assert(shipFee(quote, "SF") === 2000, "sf fee");
assert(shipFee(quote, "LOCKER") === 1200, "locker is cheaper");
assert(shipFee(quote, "MEET") === 0, "meet-up can be free");
assert(shipDays(quote, "LOCKER") === 3, "locker adds a day");
assert(shipDays(quote, "MEET") === 1, "meet-up is arranged quickly");
assert(parseShipMethod("nope") === "SF", "unknown method falls back to SF");
assert(courierFor("LOCKER") === "順豐智能櫃", "locker courier");
assert(mockTracking("seed_order_shipped", "SF").startsWith("SF"), "sf tracking");
assert(mockTracking("seed_order_shipped", "MEET") === "MEETUP", "meet-up has no waybill");

const early = new Date("2026-10-01T00:00:00Z");
const later = new Date("2026-10-02T00:00:00Z");
assert(onTimePercent([{ shippedAt: early, shipBy: later }]) === 100, "shipped before the deadline is on time");
assert(onTimePercent([{ shippedAt: later, shipBy: early }]) === 0, "late ship");
assert(onTimePercent([{ shippedAt: early, shipBy: null }]) === null, "missing deadline is not counted as 0%");
assert(minimumNextBid(50000, 82000, true) === 84000, "HK$820 next bid is HK$840");

console.log("market ok");
