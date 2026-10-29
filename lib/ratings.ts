import { dealPhase } from "./deal-phase";

/** One short line, same ceiling as a handover note. */
export const RATING_COMMENT_MAX = 80;

export type RatingError = "not_done" | "once" | "party" | "stars" | "rating_comment";

export type RateDealInput = {
  status: string;
  buyerId: string;
  sellerId: string;
  authorId: string;
  alreadyRatedBy: readonly string[];
  stars: number;
  comment: string;
};

export type RateDealOk = { ok: true; subjectId: string; stars: number; comment: string };
export type RateDealResult = RateDealOk | { ok: false; error: RatingError };

/** Empty is allowed. A line break becomes a space. Null means it is longer than one line. */
export function cleanRatingComment(raw: string): { ok: true; comment: string } | { ok: false } {
  const comment = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (comment.length > RATING_COMMENT_MAX) return { ok: false };
  return { ok: true, comment };
}

/** Buyer rates seller, seller rates buyer. Only after DONE, and only once. */
export function rateDeal(input: RateDealInput): RateDealResult {
  if (dealPhase({ status: input.status }) !== "DONE") return { ok: false, error: "not_done" };
  const buyer = input.authorId === input.buyerId;
  const seller = input.authorId === input.sellerId;
  if (input.buyerId === input.sellerId || (!buyer && !seller)) return { ok: false, error: "party" };
  if (input.alreadyRatedBy.includes(input.authorId)) return { ok: false, error: "once" };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { ok: false, error: "stars" };
  const comment = cleanRatingComment(input.comment);
  if (!comment.ok) return { ok: false, error: "rating_comment" };
  return {
    ok: true,
    subjectId: buyer ? input.sellerId : input.buyerId,
    stars: input.stars,
    comment: comment.comment,
  };
}

/** One decimal. Null when nobody has rated — callers must not invent a score. */
export function ratingFromAggregate(average: number | null | undefined, count: number): { average: number; count: number } | null {
  if (count < 1 || average == null || !Number.isFinite(average)) return null;
  return { average: Math.round(average * 10) / 10, count };
}

export function aggregateRating(stars: readonly number[]): { average: number; count: number } | null {
  if (stars.length === 0) return null;
  const sum = stars.reduce((total, value) => total + value, 0);
  return ratingFromAggregate(sum / stars.length, stars.length);
}

export function readRatingStars(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^[1-5]$/.test(value)) return Number(value);
  return 0;
}
