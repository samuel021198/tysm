import { dealPhase } from "./deal-phase";
import { dealKind, offerGroup, offerKind, openDealGroup } from "./footprint";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(openDealGroup("CHATTING") === "offering", "talking, including a live offer, is 要約中");
assert(openDealGroup("ARRANGED") === "handover" && openDealGroup("CONFIRMED") === "handover", "meetup and reserve are 待交收");
assert(openDealGroup("PROOF") === "finishing" && openDealGroup("SELLER_PAID") === "finishing", "proof and payment confirm are 待完成");
assert(openDealGroup("CANCELLED") === "ended" && openDealGroup("DONE") === null, "cancel folds into 已結束; a finished deal leaves 交易中");

assert(offerGroup("PENDING") === "offering" && offerGroup("COUNTERED") === "offering", "the seller inbox stays inside 要約中");
assert(offerGroup("DECLINED") === "ended" && offerGroup("CANCELLED") === "ended" && offerGroup("EXPIRED") === "ended", "decline, withdraw, and expiry are not a fourth tab");
assert(offerGroup("ACCEPTED") === null, "an accepted offer is the order row");
assert(offerKind("CANCELLED") === "withdrawn" && offerKind("DECLINED") === "declined", "withdraw and decline keep their own ended label");

assert(dealKind(dealPhase({ status: "AWAITING_SHIP" })) === "handover", "legacy awaiting-ship is still 待交收");
assert(dealKind(dealPhase({ status: "COMPLETED" })) === "done", "completed deals are 已出售 or 已購買");
assert(dealKind(dealPhase({ status: "DISPUTED" })) === "cancelled", "a stopped deal is 已結束");

console.log("footprint.test.ts ok");
