import { dealPhase } from "./deal-phase";
import { dealKind, footprintStatusLabel, offerGroup, offerKind, openDealGroup } from "./footprint";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(openDealGroup("CHATTING") === "offering", "talking, including a live offer, is 要約中");
assert(openDealGroup("CONFIRMED") === "locked", "seller lock is 已鎖貨");
assert(openDealGroup("ARRANGED") === "handover" && openDealGroup("PROOF") === "handover" && openDealGroup("SELLER_PAID") === "handover", "meetup, proof, and handover confirm are 待交收");
assert(openDealGroup("CANCELLED") === "ended" && openDealGroup("DONE") === null, "cancel folds into 已結束; a finished deal leaves 交易中");
assert(footprintStatusLabel("zh-HK", "offering") === "要約中" && footprintStatusLabel("zh-HK", "locked") === "已鎖貨" && footprintStatusLabel("zh-HK", "handover") === "待交收" && footprintStatusLabel("zh-HK", "done") === "已完成", "row labels use the locked status words");

assert(offerGroup("PENDING") === "offering" && offerGroup("COUNTERED") === "offering", "the seller inbox stays inside 要約中");
assert(offerGroup("DECLINED") === "ended" && offerGroup("CANCELLED") === "ended" && offerGroup("EXPIRED") === "ended", "decline, withdraw, and expiry are not a fourth tab");
assert(offerGroup("ACCEPTED") === null, "an accepted offer is the order row");
assert(offerKind("CANCELLED") === "withdrawn" && offerKind("DECLINED") === "declined", "withdraw and decline keep their own ended label");

assert(dealKind(dealPhase({ status: "AWAITING_SHIP" })) === "handover", "legacy awaiting-ship is still 待交收");
assert(dealKind(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, proofs: [] } } })) === "locked", "a seller lock is 已鎖貨");
assert(dealKind(dealPhase({ status: "COMPLETED" })) === "done", "completed deals are 已出售 or 已購買");
assert(dealKind(dealPhase({ status: "DISPUTED" })) === "cancelled", "a stopped deal is 已結束");

console.log("footprint.test.ts ok");
