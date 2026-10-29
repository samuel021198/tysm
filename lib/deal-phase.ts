import { formatHkd } from "./format";
import type { Locale } from "./i18n";

/** Private handover phases. Old OrderStatus values stay in the database; the UI reads these. */

export const DEAL_BANNER = "私下交收・平台唔代收、唔擔保";
export const DEAL_ACK = "我明白：雙方自行交收，錢貨風險自負；TSM 唔處理付款、爭議或退款。";
export const DEAL_RISK = "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。";
export const RESERVE_BADGE = "已鎖貨";
export const RESERVE_BLOCKED = "此貨品已鎖定。";
export const OFFER_EMPTY = "對方而家冇可要約嘅貨";
export const OFFER_NOTE_MAX = 80;

export type DealPhase = "CHATTING" | "ARRANGED" | "CONFIRMED" | "PROOF" | "SELLER_PAID" | "DONE" | "CANCELLED";

export type DealOffer = {
  by: string;
  name: string;
  amount: number;
  note: string;
  status: "PENDING" | "ACCEPTED";
};

export type DealMeta = {
  private?: boolean;
  meetupAgreed?: boolean;
  confirmed?: boolean;
  proofs: { url: string }[];
  offer: DealOffer | null;
};

function readOffer(value: unknown): DealOffer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const by = row.by;
  const name = row.name;
  const amount = row.amount;
  const note = row.note;
  const status = row.status;
  if (typeof by !== "string" || !by || typeof name !== "string" || !name.trim()) return null;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) return null;
  if (typeof note !== "string" || note.length > OFFER_NOTE_MAX) return null;
  if (status !== "PENDING" && status !== "ACCEPTED") return null;
  return { by, name: name.trim(), amount, note, status };
}

export function readDealMeta(fulfillment: unknown): DealMeta {
  const empty: DealMeta = { proofs: [], offer: null };
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
    offer: readOffer(row.offer),
  };
}

/** Empty is allowed. Null means the note is longer than one short line. */
export function cleanOfferNote(raw: string): { ok: true; note: string } | { ok: false } {
  const note = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (note.length > OFFER_NOTE_MAX) return { ok: false };
  return { ok: true, note };
}

/** Bound chat skips the picker. An unbound chat uses how many of the other person's active listings there are. */
export function offerEntry(bound: boolean, activeCount: number): "bound" | "empty" | "auto" | "pick" {
  if (bound) return "bound";
  if (activeCount <= 0) return "empty";
  if (activeCount === 1) return "auto";
  return "pick";
}

/** Price and note stay locked until this account has acked, or the checkbox is on. */
export function offerFormLocked(acked: boolean, checked: boolean): boolean {
  return !acked && !checked;
}

/** Server gate. A stored ack skips the checkbox; a posted checkbox records one. */
export function offerAckGate(
  acked: boolean,
  posted: unknown,
): { ok: true; record: boolean } | { ok: false; error: "deal_ack" } {
  if (acked) return { ok: true, record: false };
  if (posted === "1") return { ok: true, record: true };
  return { ok: false, error: "deal_ack" };
}

/** Omit「提出要約」from the + menu. No greyed-out row. A live offer stays available only to the proposer, who can replace it. Accepting locks the listing. */
export function canOfferFromMenu(phase: DealPhase | null, pending: boolean, blocked = false, proposer = false, accepted = false): boolean {
  if (blocked || accepted) return false;
  if (pending && !proposer) return false;
  if (phase == null) return true;
  return phase === "CHATTING" || phase === "ARRANGED";
}

/** Seller soft-lock at the listed price, when nobody has a live offer. Proof stays closed until this deal is 已鎖貨. */
export function canSellerLock(phase: DealPhase): boolean {
  return phase === "CHATTING" || phase === "ARRANGED";
}

/** 議價 stays on screen and does nothing once the listing is 已保留 or sold. */
export function offersClosed(status: string, lockOrderId: string | null | undefined): boolean {
  return status === "SOLD" || Boolean(lockOrderId);
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
    CHATTING: "要約中",
    ARRANGED: "待交收",
    CONFIRMED: RESERVE_BADGE,
    PROOF: "待交收",
    SELLER_PAID: "待交收",
    DONE: "已完成",
    CANCELLED: "已取消",
  };
  const en: Record<DealPhase, string> = {
    CHATTING: "Offer",
    ARRANGED: "To hand over",
    CONFIRMED: "Locked",
    PROOF: "To hand over",
    SELLER_PAID: "To hand over",
    DONE: "Completed",
    CANCELLED: "Cancelled",
  };
  return (locale === "en" ? en : zh)[phase];
}

/** Either party can drop the reserve before proof, so the listing can be offered again. */
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

const DEAL_MARK = "\u2063";

export type DealEvent =
  | { kind: "offer"; name: string; amount: number; note: string; superseded?: boolean }
  | { kind: "accept" }
  | { kind: "decline" }
  | { kind: "withdraw" }
  | { kind: "lock" }
  | { kind: "release"; name: string };

export function dealEventBody(event: DealEvent): string {
  return DEAL_MARK + JSON.stringify(event);
}

export function readDealEvent(body: string): DealEvent | null {
  if (!body.startsWith(DEAL_MARK)) return null;
  let row: unknown;
  try {
    row = JSON.parse(body.slice(DEAL_MARK.length));
  } catch {
    return null;
  }
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const kind = (row as { kind?: unknown }).kind;
  if (kind === "accept" || kind === "decline" || kind === "withdraw" || kind === "lock") return { kind };
  if (kind === "release") {
    const name = (row as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) return null;
    return { kind, name: name.trim() };
  }
  if (kind !== "offer") return null;
  const name = (row as { name?: unknown }).name;
  const amount = (row as { amount?: unknown }).amount;
  const note = (row as { note?: unknown }).note;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return null;
  if (typeof note !== "string" || note.length > OFFER_NOTE_MAX) return null;
  const superseded = (row as { superseded?: unknown }).superseded === true;
  return { kind, name: name.trim(), amount, note, ...(superseded ? { superseded: true } : {}) };
}

/** Stamp the previous offer bubble. Null when the body is not a live offer. */
export function supersededOfferBody(body: string): string | null {
  const event = readDealEvent(body);
  if (!event || event.kind !== "offer" || event.superseded) return null;
  return dealEventBody({ kind: "offer", name: event.name, amount: event.amount, note: event.note, superseded: true });
}

/** The newest live offer bubble. Messages must already be oldest-first. */
export function latestOpenOfferMessage<T extends { id: string; body: string }>(messages: readonly T[]): T | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const event = readDealEvent(messages[i].body);
    if (event?.kind === "offer" && !event.superseded) return messages[i];
  }
  return null;
}

export function dealEventCopy(locale: Locale, event: DealEvent): { text: string; note: string } {
  const en = locale === "en";
  if (event.kind === "offer") {
    const price = formatHkd(event.amount, locale);
    return { text: en ? `${event.name} made an offer of ${price}.` : `${event.name} 提出要約 ${price}。`, note: event.note };
  }
  if (event.kind === "accept") return { text: en ? "Offer accepted." : "要約已接受。", note: "" };
  if (event.kind === "decline") return { text: en ? "Offer declined." : "要約已拒絕。", note: "" };
  if (event.kind === "withdraw") return { text: en ? "Offer withdrawn." : "要約已撤回。", note: "" };
  if (event.kind === "lock") return { text: en ? "The item is locked." : "貨品已鎖定。", note: "" };
  return { text: en ? `${event.name} released the lock.` : `${event.name} 已解除鎖定。`, note: "" };
}
