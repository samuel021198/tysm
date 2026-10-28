import {
  DEAL_ACK,
  DEAL_BANNER,
  DEAL_RISK,
  canArrange,
  canBuyerReceive,
  canCancel,
  canMarkSold,
  canSellerConfirm,
  canUploadProof,
  dealPhase,
  phaseLabel,
  readDealMeta,
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
assert(dealPhase({ status: "IN_ESCROW" }) === "PROOF", "legacy escrow reads as waiting on the seller, without that word");
assert(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { proofs: [{ url: "https://cdn.example/a.jpg" }] } } }) === "PROOF", "a bound proof image is 待確認收款");
assert(dealPhase({ status: "SHIPPED" }) === "SELLER_PAID", "seller confirm is 已收款");
assert(dealPhase({ status: "COMPLETED" }) === "DONE", "both confirms finish the deal");
assert(dealPhase({ status: "CANCELLED" }) === "CANCELLED" && dealPhase({ status: "REFUNDED" }) === "CANCELLED", "stopped deals are cancelled");

const labels = (["CHATTING", "ARRANGED", "PROOF", "SELLER_PAID", "DONE", "CANCELLED"] as const).map((phase) => phaseLabel("zh-HK", phase));
assert(labels.join() === "洽談中,約定中,待確認收款,已收款,已完成,已取消", "zh labels are the handover states");
assert(!labels.some((label) => label.includes("待付款") || label.includes("托管") || label.includes("託管") || label.includes("放款")), "payment chips stay off the labels");

assert(canUploadProof("CHATTING", 0) && canUploadProof("ARRANGED", 0) && !canUploadProof("CHATTING", 1), "proof is the buyer CTA until one image is bound");
assert(!canSellerConfirm("CHATTING", 0) && !canSellerConfirm("PROOF", 0) && canSellerConfirm("PROOF", 1), "seller 已收款 waits for proof");
assert(!canBuyerReceive("PROOF") && canBuyerReceive("SELLER_PAID"), "buyer 已收貨 follows seller confirm");
assert(!canMarkSold("CHATTING", 0, "ACTIVE") && !canMarkSold("ARRANGED", 0, "ACTIVE"), "sold is not available while only talking");
assert(canMarkSold("PROOF", 1, "ACTIVE") && canMarkSold("SELLER_PAID", 0, "ACTIVE") && canMarkSold("DONE", 0, "ACTIVE"), "sold opens from proof onward");
assert(!canMarkSold("PROOF", 1, "SOLD") && !canCancel("CHATTING", "SOLD") && !canCancel("DONE", "ACTIVE"), "sold and finished deals do not cancel");
assert(canCancel("PROOF", "ACTIVE") && canArrange("CHATTING") && !canArrange("ARRANGED"), "either party can cancel before sold; meetup is once");

assert(readDealMeta({ deal: { private: true, proofs: [{ url: " https://cdn.example/p.jpg " }, { url: "" }] } }).proofs.length === 1, "blank proof urls are dropped");
assert(readDealMeta(null).proofs.length === 0, "missing fulfillment has no proof");

console.log("deal-phase.test.ts ok");
