import type { Prisma, User } from "@prisma/client";
import { prisma } from "./db";

/** Demo grant. One token promotes one listing for one Hong Kong day. */
export const PROMO_GRANT = 7;
export const PROMO_PER_DAY = 1;

export type PromoPlan = "off" | "arm" | "keep" | "charge";
export type PromoToast = "earn" | "spend";

/**
 * Hong Kong calendar day as YYYY-MM-DD.
 * ponytail: same Intl zone as sell-wizard's private hkDay. Upgrade path: one shared helper if a third caller appears.
 */
export function hkDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(now);
}

export function promoToastKind(value: string | null | undefined): PromoToast | null {
  return value === "earn" || value === "spend" ? value : null;
}

/** Null balance still needs the one-time grant. A number, including 0, does not. */
export function grantIfUnset(balance: number | null): number | null {
  return balance == null ? PROMO_GRANT : null;
}

export function canSpend(balance: number | null): boolean {
  return balance != null && balance >= PROMO_PER_DAY;
}

/**
 * want off → stop the pill, keep today's stamp so turning it back on is free.
 * Not live yet → remember the choice, charge when it goes ACTIVE.
 * Already charged today → leave the balance alone.
 */
export function planPromo(input: { want: boolean; live: boolean; promoDay: string | null; today: string }): PromoPlan {
  if (!input.want) return "off";
  if (!input.live) return "arm";
  if (input.promoDay === input.today) return "keep";
  return "charge";
}

export function promoFields(plan: PromoPlan, promoDay: string | null, today: string): { promoted: boolean; promoDay: string | null } {
  if (plan === "off") return { promoted: false, promoDay };
  if (plan === "arm") return { promoted: true, promoDay };
  return { promoted: true, promoDay: today };
}

export class PromoShortError extends Error {
  constructor() {
    super("tokens");
    this.name = "PromoShortError";
  }
}

/** One-time grant. Safe to call on every session; a set balance is left alone. */
export async function ensurePromoGrant(user: User): Promise<User> {
  if (grantIfUnset(user.promoBalance) == null) return user;
  const wrote = await prisma.user.updateMany({
    where: { id: user.id, promoBalance: null },
    data: { promoBalance: PROMO_GRANT, promoToast: "earn" },
  });
  if (!wrote.count) {
    return (await prisma.user.findUnique({ where: { id: user.id } })) ?? { ...user, promoBalance: PROMO_GRANT, promoToast: "earn" };
  }
  return { ...user, promoBalance: PROMO_GRANT, promoToast: "earn" };
}

export async function takePromoToast(userId: string, value: string | null | undefined): Promise<PromoToast | null> {
  const kind = promoToastKind(value);
  if (!kind) return null;
  await prisma.user.updateMany({ where: { id: userId, promoToast: kind }, data: { promoToast: null } });
  return kind;
}

/** undefined want leaves an existing listing's promo flag alone (CSV and locked edits). */
export async function commitPromo(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    want: boolean | undefined;
    live: boolean;
    promoted: boolean;
    promoDay: string | null;
    now: Date;
  },
): Promise<{ promoted: boolean; promoDay: string | null }> {
  if (input.want == null) return { promoted: input.promoted, promoDay: input.promoDay };
  const today = hkDay(input.now);
  const plan = planPromo({ want: input.want, live: input.live, promoDay: input.promoDay, today });
  if (plan === "charge") {
    const spent = await tx.user.updateMany({
      where: { id: input.userId, promoBalance: { gte: PROMO_PER_DAY } },
      data: { promoBalance: { decrement: PROMO_PER_DAY }, promoToast: "spend" },
    });
    if (!spent.count) throw new PromoShortError();
  }
  return promoFields(plan, input.promoDay, today);
}

/**
 * Charge 1 token per live promoted listing whose last charge is not today.
 * Short balance turns that listing off.
 * ponytail: one scan of due rows, then a transaction per seller. Upgrade path: a queue if promoted listings leave the demo scale.
 */
export async function settlePromos(now = new Date(), sellerId?: string): Promise<boolean> {
  const today = hkDay(now);
  const due = await prisma.listing.findMany({
    where: {
      promoted: true,
      status: "ACTIVE",
      quantityAvailable: { gt: 0 },
      binLockOrderId: null,
      ...(sellerId ? { sellerId } : {}),
      OR: [{ promoDay: null }, { promoDay: { not: today } }],
    },
    select: { id: true, sellerId: true },
    orderBy: { id: "asc" },
  });
  let spentAny = false;
  const bySeller = new Map<string, string[]>();
  for (const row of due) {
    const ids = bySeller.get(row.sellerId) ?? [];
    ids.push(row.id);
    bySeller.set(row.sellerId, ids);
  }
  for (const [seller, ids] of bySeller) {
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const marked = await tx.listing.updateMany({
          where: { id, promoted: true, OR: [{ promoDay: null }, { promoDay: { not: today } }] },
          data: { promoDay: today },
        });
        if (!marked.count) continue;
        const spent = await tx.user.updateMany({
          where: { id: seller, promoBalance: { gte: PROMO_PER_DAY } },
          data: { promoBalance: { decrement: PROMO_PER_DAY }, promoToast: "spend" },
        });
        if (!spent.count) {
          await tx.listing.update({ where: { id }, data: { promoted: false, promoDay: null } });
        } else {
          spentAny = true;
        }
      }
    });
  }
  return spentAny;
}
