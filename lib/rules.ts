export const ANTI_SNIPE_MS = 2 * 60 * 1000;
export const MAX_OFFER_ROUNDS = 3;
export const OFFER_TTL_MS = 24 * 60 * 60 * 1000;
export const PAY_TTL_MS = 24 * 60 * 60 * 1000;
export const AUTO_RELEASE_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type Proxy = { bidderId: string; maxAmount: number; updatedAt: Date };

/** Next raise: the higher of HK$10 and 5% of the current bid. Amounts are cents. */
export function bidIncrementCents(currentCents: number): number {
  const five = Math.max(1, Math.ceil((currentCents * 5) / 100));
  return Math.max(1000, five);
}

export function resolveAuction(startPrice: number, proxies: Proxy[]): { leaderId: string | null; price: number } {
  if (proxies.length === 0) return { leaderId: null, price: startPrice };
  const sorted = [...proxies].sort((a, b) => {
    if (b.maxAmount !== a.maxAmount) return b.maxAmount - a.maxAmount;
    return a.updatedAt.getTime() - b.updatedAt.getTime();
  });
  const leader = sorted[0];
  const second = sorted[1];
  if (!second) return { leaderId: leader.bidderId, price: startPrice };
  if (leader.maxAmount === second.maxAmount) {
    return { leaderId: leader.bidderId, price: leader.maxAmount };
  }
  const inc = bidIncrementCents(second.maxAmount);
  let price = second.maxAmount + inc;
  if (price > leader.maxAmount) price = leader.maxAmount;
  if (price < startPrice) price = startPrice;
  return { leaderId: leader.bidderId, price };
}

export function minimumNextBid(startPrice: number, currentPrice: number | null, hasBids: boolean): number {
  if (!hasBids || currentPrice == null) return startPrice;
  return currentPrice + bidIncrementCents(currentPrice);
}

export function validateMaxBid(args: {
  startPrice: number;
  currentPrice: number | null;
  hasBids: boolean;
  leaderId: string | null;
  bidderId: string;
  maxAmount: number;
  existingMax: number | null;
}): { ok: true } | { ok: false; reason: "below_start" | "below_min" | "raise_max" } {
  if (args.maxAmount < args.startPrice) return { ok: false, reason: "below_start" };
  if (args.leaderId === args.bidderId && args.existingMax != null) {
    if (args.maxAmount <= args.existingMax) return { ok: false, reason: "raise_max" };
    return { ok: true };
  }
  const min = minimumNextBid(args.startPrice, args.currentPrice, args.hasBids);
  if (args.maxAmount < min) return { ok: false, reason: "below_min" };
  return { ok: true };
}

export function extendedEnd(currentEnd: Date, now: Date): Date {
  if (currentEnd.getTime() - now.getTime() <= ANTI_SNIPE_MS) {
    return new Date(now.getTime() + ANTI_SNIPE_MS);
  }
  return currentEnd;
}

/** Track unpaid wins for admin. Never auto-bans — report → manual ban. */
export function nextUnpaidStrike(current: number): { consecutive: number; banned: boolean } {
  return { consecutive: current + 1, banned: false };
}

/** Stale private handover (no pay proof / no ship). Counterparty reports; admin bans by hand. */
export const DEAL_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export function canSubmitBuyerRound(currentRound: number): boolean {
  return currentRound < MAX_OFFER_ROUNDS;
}

/** One decimal percent string → basis points. "8.5" → 850. */
export function percentInputToBps(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d)?$/.test(t)) return null;
  const [a, b = "0"] = t.split(".");
  const bps = Number(a) * 100 + Number(b) * 10;
  if (bps < 0 || bps > 3000) return null;
  return bps;
}

export function bpsToPercentLabel(bps: number): string {
  const whole = Math.floor(bps / 100);
  const dec = Math.floor((bps % 100) / 10);
  return dec ? `${whole}.${dec}` : String(whole);
}

/** Commission is taken from the item subtotal only. `shippingCents` is then added to seller proceeds.
 *  Seller-chosen shipping (順豐到付 / 面交 / 店舖自取) is HK$0 on the platform, so new orders pass 0.
 *  Do not sum per-listing prepaid fees into this argument. */
export function quoteSeller(subtotalCents: number, shippingCents: number, bps: number) {
  const commissionAmount = Math.round((subtotalCents * bps) / 10000);
  const proceeds = subtotalCents - commissionAmount + shippingCents;
  return { commissionAmount, proceeds };
}

export function parseGrade(grader: string, scoreRaw: string): number | null {
  const n = Number(scoreRaw);
  if (!Number.isFinite(n)) return null;
  const doubled = Math.round(n * 2);
  if (Math.abs(doubled - n * 2) > 1e-6) return null;
  if (grader === "PSA") {
    if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  } else if (grader === "BGS") {
    if (n < 1 || n > 10.5) return null;
  } else if (grader === "CGC" || grader === "TAG") {
    if (n < 1 || n > 10) return null;
  } else return null;
  return doubled * 5;
}

export function formatGradeValue(value: number): string {
  return value % 10 === 0 ? String(value / 10) : (value / 10).toFixed(1);
}

export function gradedPhotosOk(photos: { role: string }[]): boolean {
  return photos.some((p) => p.role === "FRONT") && photos.some((p) => p.role === "BACK");
}

export function conditionLabel(input: {
  conditionTrack: "RAW" | "GRADED";
  rawGrade?: string | null;
  grader?: string | null;
  gradeValue?: number | null;
}): string {
  if (input.conditionTrack === "RAW") return `Raw ${input.rawGrade ?? ""}`.trim();
  const score = input.gradeValue != null ? formatGradeValue(input.gradeValue) : "";
  return `${input.grader ?? ""} ${score}`.trim();
}
