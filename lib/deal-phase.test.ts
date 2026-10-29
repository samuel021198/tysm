import {
  DEAL_ACK,
  DEAL_BANNER,
  DEAL_RISK,
  OFFER_EMPTY,
  RESERVE_BADGE,
  RESERVE_BLOCKED,
  canArrange,
  canBuyerReceive,
  canCancel,
  canMarkSold,
  canOfferFromMenu,
  canReleaseReserve,
  canSeePayment,
  canSellerLock,
  showPaymentDetails,
  canConfirmHandover,
  canSellerConfirm,
  canUploadProof,
  handoverFlags,
  cleanOfferNote,
  dealEventBody,
  dealEventCopy,
  latestOpenOfferMessage,
  supersededOfferBody,
  offerAckGate,
  offerEntry,
  offerFormLocked,
  offersClosed,
  readDealEvent,
  dealBlocked,
  dealPhase,
  phaseLabel,
  readDealMeta,
  reservedByOther,
} from "./deal-phase";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(DEAL_BANNER === "私下交收・平台唔代收、唔擔保", "banner copy is locked");
assert(DEAL_ACK === "我明白：雙方自行交收，錢貨風險自負；TSM 唔處理付款、爭議或退款。", "ack copy is locked");
assert(DEAL_RISK === "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。", "risk copy is locked");

assert(dealPhase({ status: "PENDING_PAYMENT" }) === "CHATTING", "a new deal is talking");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { meetupAgreed: true, proofs: [] } } }) === "ARRANGED", "meetup agreement is optional and stays before proof");
assert(dealPhase({ status: "AWAITING_SHIP" }) === "ARRANGED", "legacy awaiting-ship reads as meetup set");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, proofs: [] } } }) === "CONFIRMED", "accept reserve is 已保留 before handover");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, meetupAgreed: true, proofs: [] } } }) === "CONFIRMED", "a meetup stays reserved once the offer is accepted");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, buyerHandover: true, proofs: [] } } }) === "SELLER_PAID", "one confirm is 待交收");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, buyerHandover: true, sellerHandover: true, proofs: [] } } }) === "DONE", "both confirms finish even before the status write is reread");
assert(dealPhase({ status: "IN_ESCROW" }) === "PROOF", "legacy escrow reads as 待交收, without a payment word");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, proofs: [{ url: "https://cdn.example/a.jpg" }] } } }) === "PROOF", "a legacy proof row stays 待交收");
assert(dealPhase({ status: "SHIPPED" }) === "SELLER_PAID", "a legacy seller confirm stays 待交收 until the buyer confirms");
assert(dealPhase({ status: "SHIPPED", fulfillment: { deal: { buyerHandover: true, proofs: [] } } }) === "DONE", "legacy seller confirm plus buyer confirm is done");
assert(dealPhase({ status: "COMPLETED" }) === "DONE", "both confirms finish the deal");
assert(dealPhase({ status: "CANCELLED" }) === "CANCELLED" && dealPhase({ status: "REFUNDED" }) === "CANCELLED", "stopped deals are cancelled");

const labels = (["CHATTING", "ARRANGED", "CONFIRMED", "PROOF", "SELLER_PAID", "DONE", "CANCELLED"] as const).map((phase) => phaseLabel("zh-HK", phase));
assert(labels.join() === "議價中,待交收,已保留,待交收,待交收,已完成,已取消", "zh labels stay inside the locked status words");
assert(phaseLabel("zh-HK", "CONFIRMED") === RESERVE_BADGE && RESERVE_BADGE === "已保留", "the reserve badge is 已保留");
assert(RESERVE_BLOCKED === "此貨品已保留。", "other threads use the reserved copy");
assert(OFFER_EMPTY === "對方目前沒有可議價的貨品。", "an unbound chat with nothing to negotiate says so");
assert(!labels.some((label) => label.includes("待付款") || label.includes("托管") || label.includes("託管") || label.includes("放款") || label.includes("已確認") || label.includes("要約") || label.includes("已鎖貨")), "payment chips and old offer words stay off the labels");

assert(!canUploadProof("CHATTING", 0) && !canUploadProof("ARRANGED", 0) && canUploadProof("CONFIRMED", 0) && !canUploadProof("CONFIRMED", 1), "proof opens only after the offer is accepted, and only once");
assert(canOfferFromMenu(null, false) && canOfferFromMenu("CHATTING", false) && canOfferFromMenu("ARRANGED", false), "either party can offer while talking");
assert(!canOfferFromMenu("CHATTING", true) && canOfferFromMenu("CHATTING", true, false, true) && canOfferFromMenu("ARRANGED", true, false, true), "only the proposer keeps + while an offer is live, so they can replace it");
assert(!canOfferFromMenu("CONFIRMED", false) && !canOfferFromMenu("PROOF", false) && !canOfferFromMenu("SELLER_PAID", false) && !canOfferFromMenu("DONE", false) && !canOfferFromMenu("CANCELLED", false) && !canOfferFromMenu("CHATTING", false, true) && !canOfferFromMenu("CONFIRMED", true, false, true) && !canOfferFromMenu("CHATTING", false, false, false, true), "the + item is omitted once accepted, locked, finished, or blocked");
assert(canSellerLock("CHATTING") && canSellerLock("ARRANGED") && !canSellerLock("CONFIRMED") && !canSellerLock("PROOF") && !canSellerLock("DONE"), "seller 確認交易 is only before the lock");
assert(offersClosed("SOLD", null) && offersClosed("ACTIVE", "order_1") && !offersClosed("ACTIVE", null) && !offersClosed("ACTIVE", ""), "議價 closes when the listing is 已保留 or sold");
assert(offerEntry(true, 4) === "bound" && offerEntry(false, 0) === "empty" && offerEntry(false, 1) === "auto" && offerEntry(false, 2) === "pick", "a bound thread skips the picker; an unbound thread follows the active count");
assert(offerFormLocked(false, false) && !offerFormLocked(false, true) && !offerFormLocked(true, false), "price and note unlock after the checkbox or a stored ack");
const missingAck = offerAckGate(false, null);
const postedAck = offerAckGate(false, "1");
const storedAck = offerAckGate(true, null);
assert(!missingAck.ok && missingAck.error === "deal_ack", "an offer without the checkbox is refused");
assert(postedAck.ok && postedAck.record, "the first checkbox is stored on the account");
assert(storedAck.ok && !storedAck.record, "a stored ack is not required again");
assert(canReleaseReserve("CONFIRMED") && !canReleaseReserve("CHATTING") && !canReleaseReserve("PROOF"), "release is the pre-proof unlock");
assert(!canSeePayment("CHATTING") && !canSeePayment("ARRANGED") && canSeePayment("CONFIRMED") && canSeePayment("PROOF"), "payment details stay hidden until the lock");
assert(showPaymentDetails("CONFIRMED", true, 0) && showPaymentDetails("PROOF", true, 1) && !showPaymentDetails("DONE", false, 0) && !showPaymentDetails("CHATTING", false, 0), "payment copy follows the lock, not old completed rows");
assert(reservedByOther("order_a", "order_b") && !reservedByOther("order_a", "order_a") && !reservedByOther(null, "order_b"), "another deal's lock blocks this thread");
assert(dealBlocked("CHATTING", "ACTIVE", "order_a", "order_b") && !dealBlocked("CONFIRMED", "ACTIVE", "order_a", "order_a"), "only the locked deal continues");
assert(dealBlocked("ARRANGED", "SOLD", null, "order_b") && !dealBlocked("PROOF", "SOLD", null, "order_a"), "a sold listing keeps other threads out of payment");
assert(!canSellerConfirm("CHATTING", 0) && !canSellerConfirm("CONFIRMED", 0) && !canSellerConfirm("PROOF", 0) && canSellerConfirm("PROOF", 1), "the old seller gate still waits for a stored proof");
assert(!canBuyerReceive("PROOF") && canBuyerReceive("SELLER_PAID"), "the old buyer gate still follows a shipped row");
assert(canConfirmHandover("CONFIRMED", false) && canConfirmHandover("PROOF", false) && canConfirmHandover("SELLER_PAID", false) && !canConfirmHandover("CONFIRMED", true) && !canConfirmHandover("CHATTING", false) && !canConfirmHandover("ARRANGED", false) && !canConfirmHandover("DONE", false), "either side confirms once after the item is reserved");
assert(handoverFlags({ status: "SHIPPED" }).seller && !handoverFlags({ status: "SHIPPED" }).buyer && handoverFlags({ status: "COMPLETED" }).buyer && handoverFlags({ status: "COMPLETED" }).seller, "legacy shipped counts as the seller; completed counts as both");
assert(!canMarkSold("CHATTING", 0, "ACTIVE") && !canMarkSold("ARRANGED", 0, "ACTIVE") && !canMarkSold("CONFIRMED", 0, "ACTIVE"), "sold is not available before proof");
assert(canMarkSold("PROOF", 1, "ACTIVE") && canMarkSold("SELLER_PAID", 0, "ACTIVE") && canMarkSold("DONE", 0, "ACTIVE"), "sold opens from proof onward");
assert(!canMarkSold("PROOF", 1, "SOLD") && !canCancel("CHATTING", "SOLD") && !canCancel("DONE", "ACTIVE"), "sold and finished deals do not cancel");
assert(canCancel("CONFIRMED", "ACTIVE") && canCancel("PROOF", "ACTIVE") && canArrange("CHATTING") && !canArrange("ARRANGED"), "either party can cancel before sold; meetup is once");

assert(readDealMeta({ deal: { private: true, confirmed: true, proofs: [{ url: " https://cdn.example/p.jpg " }, { url: "" }] } }).proofs.length === 1, "blank proof urls are dropped");
assert(readDealMeta({ deal: { confirmed: true, proofs: [] } }).confirmed === true, "the lock flag round-trips");
assert(readDealMeta({ deal: { proofs: [] } }).confirmed !== true, "a new deal is not reserved");
assert(readDealMeta(null).proofs.length === 0 && readDealMeta(null).offer === null, "missing fulfillment has no proof or offer");
assert(readDealMeta({ deal: { proofs: [], offer: { by: "u", name: "Alex", amount: 500, note: "旺角", status: "PENDING" } } }).offer?.amount === 500, "a pending offer round-trips");
assert(readDealMeta({ deal: { proofs: [], offer: { by: "", name: "Alex", amount: 500, note: "", status: "PENDING" } } }).offer === null, "a blank offerer is dropped");
assert(readDealMeta({ deal: { proofs: [], buyerHandover: true } }).buyerHandover === true && readDealMeta({ deal: { proofs: [] } }).sellerHandover === false, "handover flags round-trip");
const note = cleanOfferNote("  旺角\n7pm ");
assert(note.ok && note.note === "旺角 7pm", "a handover note is one line");
assert(!cleanOfferNote("x".repeat(81)).ok && cleanOfferNote("").ok, "an empty note is allowed and a long one is not");
assert(offerEntry(true, 0) === "bound", "a bound thread does not care that the counterparty has no other listings");
const offered = dealEventCopy("zh-HK", { kind: "offer", name: "Alex", amount: 12300, note: "旺角" });
assert(offered.text === "Alex 提出議價 HK$123.00。" && offered.note === "旺角", "the offer bubble names the price");
assert(dealEventCopy("zh-HK", { kind: "accept" }).text === "已接受。", "accept copy is one short sentence");
assert(dealEventCopy("zh-HK", { kind: "lock" }).text === "已保留。", "reserve copy is one sentence");
assert(dealEventCopy("zh-HK", { kind: "decline" }).text === "已拒絕。" && dealEventCopy("zh-HK", { kind: "withdraw" }).text === "已撤回。", "decline and withdraw copy is one sentence");
assert(dealEventCopy("zh-HK", { kind: "handover" }).text === "已確認交收。", "each handover confirm is one sentence");
assert(dealEventCopy("zh-HK", { kind: "release", name: "Alex" }).text === "Alex 已取消保留。", "release names who cancelled the reservation");
assert(![offered.text, dealEventCopy("zh-HK", { kind: "accept" }).text, dealEventCopy("zh-HK", { kind: "decline" }).text, dealEventCopy("zh-HK", { kind: "withdraw" }).text, dealEventCopy("zh-HK", { kind: "lock" }).text, dealEventCopy("zh-HK", { kind: "handover" }).text].some((text) => text.includes("要約")), "bubbles do not say 要約");
const body = dealEventBody({ kind: "offer", name: "Alex", amount: 12300, note: "旺角" });
assert(readDealEvent(body)?.kind === "offer" && readDealEvent(dealEventBody({ kind: "lock" }))?.kind === "lock" && readDealEvent("hello") === null && readDealEvent("\u2063nope") === null, "only marked events render as system bubbles");
const replaced = supersededOfferBody(body);
const replacedEvent = replaced ? readDealEvent(replaced) : null;
assert(replacedEvent?.kind === "offer" && replacedEvent.superseded === true && replacedEvent.amount === 12300 && replacedEvent.note === "旺角", "replacing an offer keeps the old terms and marks 已取代");
assert(replaced != null && supersededOfferBody(replaced) === null && supersededOfferBody("hello") === null, "a gray bubble is not stamped again");
const older = { id: "a", body };
const newer = { id: "b", body: dealEventBody({ kind: "offer", name: "Bea", amount: 200, note: "" }) };
assert(latestOpenOfferMessage([older, newer])?.id === "b", "the live card is the newest offer bubble");
assert(latestOpenOfferMessage([{ id: "a", body: replaced! }, newer])?.id === "b", "a superseded bubble is not the live offer");
assert(latestOpenOfferMessage([{ id: "a", body: replaced! }]) === null, "a thread of only replaced offers has no live bubble");

console.log("deal-phase.test.ts ok");
