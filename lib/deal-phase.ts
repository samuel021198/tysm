import { formatHkd } from "./format";
import type { Locale } from "./i18n";
import { DEAL_STALE_MS } from "./rules";

/** Private handover phases. Old OrderStatus values stay in the database; the UI reads these. */

export const DEAL_BANNER = "私下交收・平台不代收、不擔保";
export const DEAL_ACK = "我明白：雙方自行交收，錢貨風險自負；TSM 不處理付款、爭議或退款。";
export const DEAL_RISK = "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。";
export const RESERVE_BADGE = "已保留";
export const RESERVE_BLOCKED = "此貨品已保留。";
export const OFFER_EMPTY = "對方目前沒有可議價的貨品。";
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
  buyerHandover: boolean;
  sellerHandover: boolean;
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
  const empty: DealMeta = { proofs: [], offer: null, buyerHandover: false, sellerHandover: false };
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
    buyerHandover: row.buyerHandover === true,
    sellerHandover: row.sellerHandover === true,
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

/** Omit 議價 from the + menu. No greyed-out row. A live offer stays available only to the proposer, who can replace it. Accepting reserves the listing. */
export function canOfferFromMenu(phase: DealPhase | null, pending: boolean, blocked = false, proposer = false, accepted = false): boolean {
  if (blocked || accepted) return false;
  if (pending && !proposer) return false;
  if (phase == null) return true;
  return phase === "CHATTING" || phase === "ARRANGED";
}

/** Seller soft-lock at the listed price, when nobody has a live offer. */
export function canSellerLock(phase: DealPhase): boolean {
  return phase === "CHATTING" || phase === "ARRANGED";
}

/** 議價 stays on screen and does nothing once the listing is 已保留 or sold. */
export function offersClosed(status: string, lockOrderId: string | null | undefined): boolean {
  return status === "SOLD" || Boolean(lockOrderId);
}

/** Stored on MessageThread.intent. An offer is not an intent; it lives on the order. */
export type ThreadIntent = "INQUIRY" | "DIRECT";

export type EntryFocus = "offer" | "buy" | "compose" | "";

/** A live offer, an accepted offer, or any phase past talking. Cancelled does not block a new entry. */
export function intentBlocked(phase: DealPhase | null, offer: "PENDING" | "ACCEPTED" | null): boolean {
  if (!phase || phase === "CANCELLED") return false;
  if (offer === "PENDING" || offer === "ACCEPTED") return true;
  return phase !== "CHATTING";
}

/** A finished or cancelled deal does not block another 直接購買. An open offer or reserve does. */
export function directBuyBlocked(phase: DealPhase | null, offer: "PENDING" | "ACCEPTED" | null): boolean {
  if (!phase || phase === "DONE" || phase === "CANCELLED") return false;
  return intentBlocked(phase, offer);
}

/** Entry writes intent only for 查詢 and 直接購買. 議價 waits until the offer is submitted. DIRECT sticks. */
export function nextThreadIntent(
  current: ThreadIntent | null,
  focus: EntryFocus,
  opts: { priced: boolean; closed: boolean; blocked: boolean },
): ThreadIntent | null {
  if (opts.blocked || opts.closed || current === "DIRECT") return current;
  if (focus === "buy" && opts.priced) return "DIRECT";
  if (focus === "compose" && current == null) return "INQUIRY";
  return current;
}

export type ThreadStamp = { id: string; createdAt: number };

/** Listing thread that was already open when the order was created. Older than every thread stays on the earliest. */
export function threadIdForOrder(orderCreatedAt: number, threads: ThreadStamp[]): string | null {
  if (!threads.length) return null;
  const sorted = [...threads].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let owner: ThreadStamp | null = null;
  for (const thread of sorted) {
    if (thread.createdAt <= orderCreatedAt) owner = thread;
  }
  return (owner ?? sorted[0]).id;
}

export type ContactOrder = { createdAt: number; phase: DealPhase };

/**
 * Thread a new 聯絡 / 查詢 may open. Null means create one.
 * A thread that already holds a DONE order stays history. Cancelled does not seal it.
 */
export function contactThreadId(threads: ThreadStamp[], orders: ContactOrder[]): string | null {
  if (!threads.length) return null;
  const reusable = threads.filter((thread) => {
    const mine = orders.filter((order) => threadIdForOrder(order.createdAt, threads) === thread.id);
    if (mine.some((order) => order.phase !== "DONE" && order.phase !== "CANCELLED")) return true;
    return !mine.some((order) => order.phase === "DONE");
  });
  if (!reusable.length) return null;
  return [...reusable].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0].id;
}

/**
 * Thread that should receive 議價. Stay on an open deal.
 * A thread that only holds DONE stays history (#132). Null means create one.
 */
export function offerThreadChoice(threadId: string, threads: ThreadStamp[], orders: ContactOrder[]): string | null {
  const mine = ordersOnThread(threadId, threads, orders);
  if (mine.some((order) => order.phase !== "DONE" && order.phase !== "CANCELLED")) return threadId;
  if (!mine.some((order) => order.phase === "DONE")) return threadId;
  const reuse = contactThreadId(threads, orders);
  if (reuse && reuse !== threadId) return reuse;
  return null;
}

/** Orders whose chat is this thread. A later 聯絡 does not inherit a finished deal. */
export function ordersOnThread<T extends ContactOrder>(threadId: string, threads: ThreadStamp[], orders: T[]): T[] {
  return orders.filter((order) => threadIdForOrder(order.createdAt, threads) === threadId);
}

/** Listing buttons skip the 3-pick. 議價 opens the price sheet. 聯絡賣家 focuses the composer. */
export function threadEntryQuery(focus: EntryFocus, intent: ThreadIntent | null, opts: { closed: boolean; pending: boolean }): string {
  if (focus === "offer" && !opts.closed && !opts.pending && intent !== "DIRECT") return "?offer=1";
  if (focus === "compose") return "?compose=1";
  return "";
}

export type PinAction = "ask" | "switch" | "seller-offer" | "direct-seller" | "direct-buyer" | "closed" | "none";

/**
 * Pin row under the product.
 * ask: 議價｜直接購買｜查詢, only when reopening with no intent and no deal.
 * switch: 議價｜直接購買 while 查詢 or before an offer. 查詢 does not lock those out.
 */
export function pinAction(input: {
  role: "buyer" | "seller";
  intent: ThreadIntent | null;
  closed: boolean;
  blocked: boolean;
  started: boolean;
  entry: boolean;
}): PinAction {
  if (input.closed) return "closed";
  if (input.blocked) return "none";
  if (input.intent === "DIRECT") return input.role === "seller" ? "direct-seller" : "direct-buyer";
  if (input.role === "seller") return "seller-offer";
  if (input.intent == null && !input.entry && !input.started) return "ask";
  return "switch";
}

/** 議價中 appears only after an offer is submitted. Direct buy has no status pill until 確認 reserves. */
export function showDealStream(phase: DealPhase, offer: "PENDING" | "ACCEPTED" | null): boolean {
  if (phase === "CHATTING" && offer !== "PENDING") return false;
  return true;
}

/** No pay proof / no ship for 3 days → counterpart reports; admin bans by hand. */
export function dealStale(phase: DealPhase, createdAt: Date, now = new Date()): boolean {
  if (phase === "DONE" || phase === "CANCELLED" || phase === "CHATTING") return false;
  return now.getTime() - createdAt.getTime() >= DEAL_STALE_MS;
}

export const DIRECT_WAIT = "待賣家回覆。";

/** Who has already tapped 確認交收. A legacy shipped row counts as the seller side. */
export function handoverFlags(order: { status: string; fulfillment?: unknown }): { buyer: boolean; seller: boolean } {
  const meta = readDealMeta(order.fulfillment);
  return {
    buyer: meta.buyerHandover || order.status === "COMPLETED",
    seller: meta.sellerHandover || order.status === "SHIPPED" || order.status === "COMPLETED",
  };
}

/** Map a stored order onto the handover the buyer and seller actually see. */
export function dealPhase(order: { status: string; fulfillment?: unknown }): DealPhase {
  if (order.status === "CANCELLED" || order.status === "REFUNDED" || order.status === "DISPUTED") return "CANCELLED";
  if (order.status === "COMPLETED") return "DONE";
  const flags = handoverFlags(order);
  if (flags.buyer && flags.seller) return "DONE";
  if (flags.buyer || flags.seller) return "SELLER_PAID";
  const meta = readDealMeta(order.fulfillment);
  if (order.status === "IN_ESCROW" || meta.proofs.length > 0) return "PROOF";
  if (meta.confirmed) return "CONFIRMED";
  if (order.status === "AWAITING_SHIP" || meta.meetupAgreed) return "ARRANGED";
  return "CHATTING";
}

export function phaseLabel(locale: "zh-HK" | "en", phase: DealPhase): string {
  const zh: Record<DealPhase, string> = {
    CHATTING: "議價中",
    ARRANGED: "待交收",
    CONFIRMED: RESERVE_BADGE,
    PROOF: "待交收",
    SELLER_PAID: "待交收",
    DONE: "已完成",
    CANCELLED: "已取消",
  };
  const en: Record<DealPhase, string> = {
    CHATTING: "Negotiating",
    ARRANGED: "To hand over",
    CONFIRMED: "Reserved",
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

/** Either party confirms handover once, after the listing is reserved. Legacy proof rows can finish the same way. */
export function canConfirmHandover(phase: DealPhase, already: boolean): boolean {
  if (already) return false;
  return phase === "CONFIRMED" || phase === "PROOF" || phase === "SELLER_PAID";
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
  | { kind: "handover" }
  | { kind: "release"; name: string }
  | { kind: "direct"; amount: number }
  | { kind: "sold" };

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
  if (kind === "accept" || kind === "decline" || kind === "withdraw" || kind === "lock" || kind === "handover" || kind === "sold") return { kind };
  if (kind === "direct") {
    const amount = (row as { amount?: unknown }).amount;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return null;
    return { kind, amount };
  }
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
    return { text: en ? `${event.name} offered ${price}.` : `${event.name} 提出議價 ${price}。`, note: event.note };
  }
  if (event.kind === "accept") return { text: en ? "Accepted." : "已接受。", note: "" };
  if (event.kind === "decline") return { text: en ? "Declined." : "已拒絕。", note: "" };
  if (event.kind === "withdraw") return { text: en ? "Withdrawn." : "已撤回。", note: "" };
  if (event.kind === "lock") return { text: en ? "Reserved." : "已保留。", note: "" };
  if (event.kind === "handover") return { text: en ? "Handover confirmed." : "已確認交收。", note: "" };
  if (event.kind === "direct") {
    const price = formatHkd(event.amount, locale);
    return { text: en ? `Asked to buy at the listed price ${price}.` : `希望以標價 ${price} 購買。`, note: "" };
  }
  if (event.kind === "sold") return { text: en ? "Sold." : "已售。", note: "" };
  return { text: en ? `${event.name} cancelled the reservation.` : `${event.name} 已取消保留。`, note: "" };
}
