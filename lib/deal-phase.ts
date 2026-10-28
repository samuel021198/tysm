/** Private handover phases. Old OrderStatus values stay in the database; the UI reads these. */

export const DEAL_BANNER = "私下交收・平台唔代收、唔擔保";
export const DEAL_ACK = "我明白：雙方自行交收，錢貨風險自負；TSM 唔處理付款、爭議或退款。";
export const DEAL_RISK = "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。";
export const RESERVE_BADGE = "保留中";
export const RESERVE_BLOCKED = "呢件貨已有人確認，保留中";
export const PROOF_WAIT = "等賣家確認交易後先上傳付款證明";

export type DealPhase = "CHATTING" | "ARRANGED" | "CONFIRMED" | "PROOF" | "SELLER_PAID" | "DONE" | "CANCELLED";

export type DealMeta = {
  private?: boolean;
  meetupAgreed?: boolean;
  confirmed?: boolean;
  proofs: { url: string }[];
};

export function readDealMeta(fulfillment: unknown): DealMeta {
  const empty: DealMeta = { proofs: [] };
  if (!fulfillment || typeof fulfillment !== "object" || Array.isArray(fulfillment)) return empty;
  const deal = (fulfillment as { deal?: unknown }).deal;
  if (!deal || typeof deal !== "object" || Array.isArray(deal)) return empty;
  const row = deal as Record<string, unknown>;
  const proofs: { url: string }[] = [];
  if (Array.isArray(row.proofs)) {
    for (const item of row.proofs) {
      if (!item || typeof item !== "object") continue;
      const url = (item as { url?: unknown }).url;
      if (typeof url === "string" && url.trim()) proofs.push({ url: url.trim() });
    }
  }
  return {
    private: row.private === true,
    meetupAgreed: row.meetupAgreed === true,
    confirmed: row.confirmed === true,
    proofs,
  };
}

/** Map a stored order onto the handover the buyer and seller actually see. */
export function dealPhase(order: { status: string; fulfillment?: unknown }): DealPhase {
  if (order.status === "CANCELLED" || order.status === "REFUNDED" || order.status === "DISPUTED") return "CANCELLED";
  if (order.status === "COMPLETED") return "DONE";
  if (order.status === "SHIPPED") return "SELLER_PAID";
  const meta = readDealMeta(order.fulfillment);
  if (order.status === "IN_ESCROW" || meta.proofs.length > 0) return "PROOF";
  if (meta.confirmed) return "CONFIRMED";
  if (order.status === "AWAITING_SHIP" || meta.meetupAgreed) return "ARRANGED";
  return "CHATTING";
}

export function phaseLabel(locale: "zh-HK" | "en", phase: DealPhase): string {
  const zh: Record<DealPhase, string> = {
    CHATTING: "洽談中",
    ARRANGED: "約定中",
    CONFIRMED: RESERVE_BADGE,
    PROOF: "待確認收款",
    SELLER_PAID: "已收款",
    DONE: "已完成",
    CANCELLED: "已取消",
  };
  const en: Record<DealPhase, string> = {
    CHATTING: "Talking",
    ARRANGED: "Meetup set",
    CONFIRMED: "Reserved",
    PROOF: "Proof sent",
    SELLER_PAID: "Seller confirmed payment",
    DONE: "Completed",
    CANCELLED: "Cancelled",
  };
  return (locale === "en" ? en : zh)[phase];
}

/** Seller lock. Buyer never confirms this step. */
export function canSellerLock(phase: DealPhase): boolean {
  return phase === "CHATTING" || phase === "ARRANGED";
}

/** Seller can drop the reserve before proof, so another buyer can be locked. */
export function canReleaseReserve(phase: DealPhase): boolean {
  return phase === "CONFIRMED";
}

export function reservedByOther(lockOrderId: string | null | undefined, orderId: string): boolean {
  return Boolean(lockOrderId && lockOrderId !== orderId);
}

/** Other open deals stay out of payment. A sold listing blocks them even after the lock is cleared. */
export function dealBlocked(phase: DealPhase, listingStatus: string, lockOrderId: string | null | undefined, orderId: string): boolean {
  if (phase === "PROOF" || phase === "SELLER_PAID" || phase === "DONE" || phase === "CANCELLED") return false;
  if (listingStatus === "SOLD") return true;
  return reservedByOther(lockOrderId, orderId);
}

/** Proof and payment details open only after this deal holds the reserve. */
export function canUploadProof(phase: DealPhase, proofs: number): boolean {
  return phase === "CONFIRMED" && proofs < 1;
}

export function canSeePayment(phase: DealPhase): boolean {
  return phase === "CONFIRMED" || phase === "PROOF" || phase === "SELLER_PAID" || phase === "DONE";
}

/** Payment details follow this deal's lock or an already-bound proof. Older completed rows stay quiet. */
export function showPaymentDetails(phase: DealPhase, confirmed: boolean, proofs: number): boolean {
  return canSeePayment(phase) && (confirmed || proofs > 0);
}

export function canSellerConfirm(phase: DealPhase, proofs: number): boolean {
  return phase === "PROOF" && proofs > 0;
}

export function canBuyerReceive(phase: DealPhase): boolean {
  return phase === "SELLER_PAID";
}

/** Seller may mark the listing sold once proof is in, or any later phase. */
export function canMarkSold(phase: DealPhase, proofs: number, listingStatus: string): boolean {
  if (listingStatus === "SOLD") return false;
  if (phase === "SELLER_PAID" || phase === "DONE") return true;
  return phase === "PROOF" && proofs > 0;
}

export function canCancel(phase: DealPhase, listingStatus: string): boolean {
  if (listingStatus === "SOLD" || phase === "DONE" || phase === "CANCELLED") return false;
  return phase === "CHATTING" || phase === "ARRANGED" || phase === "CONFIRMED" || phase === "PROOF" || phase === "SELLER_PAID";
}

export function canArrange(phase: DealPhase): boolean {
  return phase === "CHATTING";
}
