import { priorSalePrices } from "./comps";
import { minimumNextBid } from "./rules";
import { buildFulfillment, courierFor, intersectOffered, mockTracking, onTimePercent, parseShipMethod, shipDays, shipFee } from "./shipping";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const quote = { shippingDays: 2 };
assert(shipFee(quote, "SF_COD") === 0 && shipFee(quote, "MEET") === 0 && shipFee(quote, "PICKUP") === 0, "platform shipping is HK$0");
assert(shipDays(quote, "LOCKER") === 3, "legacy locker adds a day");
assert(shipDays(quote, "MEET") === 1 && shipDays(quote, "PICKUP") === 1, "handover is arranged quickly");
const preorderDay = new Date("2026-11-01T00:00:00+08:00");
assert(
  shipDays({ shippingDays: 3, stockType: "PREORDER", preorderShipDate: preorderDay }, "SF_COD", new Date("2026-10-25T00:00:00+08:00")) === 7,
  "preorder SF uses the ship date",
);
assert(shipDays({ shippingDays: 3, stockType: "PREORDER", preorderShipDate: preorderDay }, "MEET", new Date("2026-10-25T00:00:00+08:00")) === 1, "meetup stays a handover");
assert(parseShipMethod("SF_COD") === "SF_COD" && parseShipMethod("SF") === null && parseShipMethod("nope") === null, "only seller-chosen methods are selectable");
assert(courierFor("LOCKER") === "順豐智能櫃" && courierFor("SF_COD") === "順豐到付" && courierFor("PICKUP") === "店舖自取", "courier names");
assert(mockTracking("seed_order_shipped", "SF_COD").startsWith("SF"), "sf tracking");
assert(mockTracking("seed_order_shipped", "MEET") === "MEETUP" && mockTracking("x", "PICKUP") === "PICKUP", "handover has no waybill");
const both = { shipSfCod: true, shipMeetup: true, shipPickup: false };
const pickup = { shipSfCod: true, shipMeetup: false, shipPickup: true };
const meetOnly = { shipSfCod: false, shipMeetup: true, shipPickup: false };
assert(intersectOffered([{ choice: both, storeReady: true }, { choice: pickup, storeReady: true }]).join() === "SF_COD", "same seller uses the intersection");
assert(intersectOffered([{ choice: meetOnly, storeReady: true }, { choice: pickup, storeReady: false }]).length === 0, "no shared method blocks the group");
assert(intersectOffered([{ choice: pickup, storeReady: false }]).join() === "SF_COD", "pickup is hidden when the shop address is missing");
const meetup = buildFulfillment("MEET", [{ id: "a", title: "卡", meetupDistrict: "灣仔", meetupWindow: null, meetupNotes: "先約" }], null);
assert(meetup?.meetups[0]?.district === "灣仔", "meetup snapshot keeps the district");
assert(buildFulfillment("MEET", [{ id: "a", title: "卡", meetupDistrict: "  ", meetupWindow: null, meetupNotes: null }], null) === null, "meetup without a district is not a snapshot");
assert(buildFulfillment("PICKUP", [], { storeName: "舖", storeDistrict: "油尖旺", storeLine1: "西洋菜南街 1 號", storeHours: null })?.store?.line1 === "西洋菜南街 1 號", "pickup snapshots the shop");
assert(buildFulfillment("PICKUP", [], { storeName: null, storeDistrict: "", storeLine1: "", storeHours: null }) === null, "pickup without a shop is not a snapshot");

const early = new Date("2026-10-01T00:00:00Z");
const later = new Date("2026-10-02T00:00:00Z");
assert(onTimePercent([{ shippedAt: early, shipBy: later }]) === 100, "shipped before the deadline is on time");
assert(onTimePercent([{ shippedAt: later, shipBy: early }]) === 0, "late ship");
assert(onTimePercent([{ shippedAt: early, shipBy: null }]) === null, "missing deadline is not counted as 0%");
assert(minimumNextBid(50000, 82000, true) === 84000, "HK$820 next bid is HK$840");
assert(priorSalePrices([{ listingId: "a", unitPrice: 12800 }, { listingId: "b", unitPrice: 8600 }], "b").join() === "12800", "a card's own sale is not the last price");
assert(priorSalePrices([{ listingId: "a", unitPrice: 0 }], "b").length === 0, "a zero sale is not a comparison");

console.log("market ok");
