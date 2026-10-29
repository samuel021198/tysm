import { isAllowedMediaUrl } from "./format";

export const VERIFY_REASON_MAX = 200;

export type VerificationTrackName = "TRUSTED" | "MERCHANT";
export type VerificationApplicationStatusName = "PENDING" | "APPROVED" | "REJECTED";
type VerificationTierName = "NORMAL" | "TRUSTED" | "MERCHANT";

export type VerificationDraft = {
  track: VerificationTrackName;
  documentUrl: string;
  reason: string;
  status: "PENDING";
};

export type VerificationApplyError = "verify_pending" | "verify_track" | "verify_reason" | "verify_photo";

/** A new application is always PENDING. An open PENDING row blocks another one. */
export function submitApplication(input: {
  pending: boolean;
  track: unknown;
  documentUrl: unknown;
  reason: unknown;
}): { ok: true; draft: VerificationDraft } | { ok: false; error: VerificationApplyError } {
  if (input.pending) return { ok: false, error: "verify_pending" };
  const track = input.track === "TRUSTED" || input.track === "MERCHANT" ? input.track : null;
  if (!track) return { ok: false, error: "verify_track" };
  const reason = String(input.reason ?? "").trim().replace(/\s+/g, " ");
  if (reason.length < 1 || reason.length > VERIFY_REASON_MAX) return { ok: false, error: "verify_reason" };
  const documentUrl = String(input.documentUrl ?? "").trim();
  if (!documentUrl.startsWith("data:image/") || !isAllowedMediaUrl(documentUrl)) return { ok: false, error: "verify_photo" };
  return { ok: true, draft: { track, documentUrl, reason, status: "PENDING" } };
}

export type VerificationReviewPlan =
  | { ok: false; error: "verify_state" }
  | {
      ok: true;
      applicationStatus: "APPROVED" | "REJECTED";
      tier: VerificationTierName;
      setTier: boolean;
    };

/** APPROVED writes the track onto the user. REJECTED leaves the current tier alone. */
export function planVerificationReview(input: {
  applicationStatus: VerificationApplicationStatusName;
  track: VerificationTrackName;
  currentTier: VerificationTierName;
  decision: "APPROVED" | "REJECTED";
}): VerificationReviewPlan {
  if (input.applicationStatus !== "PENDING") return { ok: false, error: "verify_state" };
  if (input.decision === "REJECTED") {
    return { ok: true, applicationStatus: "REJECTED", tier: input.currentTier, setTier: false };
  }
  return { ok: true, applicationStatus: "APPROVED", tier: input.track, setTier: true };
}

export function parseVerificationDecision(
  payload: unknown,
): { ok: true; applicationId: string; decision: "APPROVED" | "REJECTED" } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") return { ok: false, error: "invalid_json" };
  const body = payload as { applicationId?: unknown; decision?: unknown };
  const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  if (!/^[a-z0-9]{8,40}$/i.test(applicationId)) return { ok: false, error: "verify_id" };
  if (body.decision !== "APPROVED" && body.decision !== "REJECTED") return { ok: false, error: "verify_decision" };
  return { ok: true, applicationId, decision: body.decision };
}
