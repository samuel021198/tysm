/** Private handover phases. Old OrderStatus values stay in the database; the UI reads these. */

export const DEAL_BANNER = "私下交收・平台唔代收、唔擔保";
export const DEAL_ACK = "我明白：雙方自行交收，錢貨風險自負；TSM 唔處理付款、爭議或退款。";
export const DEAL_RISK = "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。";

export type DealPhase = "CHATTING" | "ARRANGED" | "PROOF" | "SELLER_PAID" | "DONE" | "CANCELLED";

export type DealMeta = {
  private?: boolean;
  meetupAgreed?: boolean;
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
  if (order.status === "AWAITING_SHIP" || meta.meetupAgreed) return "ARRANGED";
  return "CHATTING";
}

export function phaseLabel(locale: "zh-HK" | "en", phase: DealPhase): string {
  const zh: Record<DealPhase, string> = {
    CHATTING: "洽談中",
    ARRANGED: "約定中",
    PROOF: "待確認收款",
    SELLER_PAID: "已收款",
    DONE: "已完成",
    CANCELLED: "已取消",
  };
  const en: Record<DealPhase, string> = {
    CHATTING: "Talking",
    ARRANGED: "Meetup set",
    PROOF: "Proof sent",
    SELLER_PAID: "Seller confirmed payment",
    DONE: "Completed",
    CANCELLED: "Cancelled",
  };
  return (locale === "en" ? en : zh)[phase];
}

export function canUploadProof(phase: DealPhase, proofs: number): boolean {
  return proofs < 1 && (phase === "CHATTING" || phase === "ARRANGED" || phase === "PROOF");
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
  return phase === "CHATTING" || phase === "ARRANGED" || phase === "PROOF" || phase === "SELLER_PAID";
}

export function canArrange(phase: DealPhase): boolean {
  return phase === "CHATTING";
}
