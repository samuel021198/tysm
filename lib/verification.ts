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

const PRIVATE_DOC_PREFIX = "private:";
const PRIVATE_DOC_KEY = /^verification\/[a-f0-9]{32}\.(jpg|png|webp)$/;
const PUBLIC_DOC_KEY = /^uploads\/verification\/[a-f0-9]{24}\.(jpg|png|webp)$/;

export function isVerificationObjectKey(key: string): boolean {
  return PRIVATE_DOC_KEY.test(key);
}

export function isPublicVerificationKey(key: string): boolean {
  return PUBLIC_DOC_KEY.test(key);
}

export function privateDocRef(key: string): string {
  return `${PRIVATE_DOC_PREFIX}${key}`;
}

/** Stored private ref. Public https URLs are not refs. */
export function privateDocKey(ref: string): string | null {
  if (!ref.startsWith(PRIVATE_DOC_PREFIX)) return null;
  const key = ref.slice(PRIVATE_DOC_PREFIX.length);
  return isVerificationObjectKey(key) ? key : null;
}

/** Public-bucket key for a verification file stored before the private bucket. Listing keys do not match. */
export function publicVerificationKey(documentUrl: string, publicBase: string): string | null {
  const base = publicBase.replace(/\/$/, "");
  if (!base.startsWith("https://") || !documentUrl.startsWith(`${base}/`)) return null;
  let path: string;
  try {
    path = decodeURIComponent(new URL(documentUrl).pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
  return isPublicVerificationKey(path) ? path : null;
}

export type VerificationDocKind =
  | { kind: "private"; key: string }
  | { kind: "legacy-data" }
  | { kind: "legacy-public"; key: string }
  | { kind: "blocked" };

export function classifyVerificationDoc(documentUrl: string, publicBase: string | null): VerificationDocKind {
  const key = privateDocKey(documentUrl);
  if (key) return { kind: "private", key };
  if (documentUrl.startsWith("data:image/") && isAllowedMediaUrl(documentUrl)) return { kind: "legacy-data" };
  if (publicBase) {
    const publicKey = publicVerificationKey(documentUrl, publicBase);
    if (publicKey) return { kind: "legacy-public", key: publicKey };
  }
  return { kind: "blocked" };
}

/** Review API shape. Never echoes the stored URL or object ref. */
export function reviewDocumentAccess(
  id: string,
  documentUrl: string,
  publicBase: string | null,
  privateReady: boolean,
): { documentPath: string | null; documentError?: string } {
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return { documentPath: null, documentError: "verify_id" };
  const kind = classifyVerificationDoc(documentUrl, publicBase);
  const path = `/api/internal/verification?document=${encodeURIComponent(id)}`;
  if (kind.kind === "private" || kind.kind === "legacy-data") return { documentPath: path };
  if (kind.kind === "legacy-public") {
    return privateReady ? { documentPath: path } : { documentPath: null, documentError: "needs_private_bucket" };
  }
  return { documentPath: null, documentError: "verify_document" };
}

export function sniffImageType(contentType: string, body: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  const header = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (header === "image/jpeg" || header === "image/png" || header === "image/webp") return header;
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return "image/png";
  if (body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
