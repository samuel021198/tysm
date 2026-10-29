import { readFileSync } from "fs";
import { planVerificationReview, submitApplication, VERIFY_REASON_MAX } from "./verification";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const documentUrl = `data:image/jpeg;base64,${"a".repeat(32)}`;

const applied = submitApplication({ pending: false, track: "TRUSTED", documentUrl, reason: "  想賣卡  " });
assert(applied.ok && applied.draft.status === "PENDING" && applied.draft.track === "TRUSTED" && applied.draft.reason === "想賣卡", "apply creates PENDING");

const merchant = submitApplication({ pending: false, track: "MERCHANT", documentUrl, reason: "開舖" });
assert(merchant.ok && merchant.draft.status === "PENDING" && merchant.draft.track === "MERCHANT", "merchant apply is also PENDING");

const blocked = submitApplication({ pending: true, track: "MERCHANT", documentUrl, reason: "開舖" });
assert(!blocked.ok && blocked.error === "verify_pending", "cannot re-apply while PENDING");

const approved = planVerificationReview({
  applicationStatus: "PENDING",
  track: "TRUSTED",
  currentTier: "NORMAL",
  decision: "APPROVED",
});
assert(approved.ok && approved.setTier && approved.tier === "TRUSTED" && approved.applicationStatus === "APPROVED", "APPROVED sets the trusted tier");

const approvedMerchant = planVerificationReview({
  applicationStatus: "PENDING",
  track: "MERCHANT",
  currentTier: "NORMAL",
  decision: "APPROVED",
});
assert(approvedMerchant.ok && approvedMerchant.setTier && approvedMerchant.tier === "MERCHANT", "APPROVED sets the merchant tier");

const rejected = planVerificationReview({
  applicationStatus: "PENDING",
  track: "MERCHANT",
  currentTier: "NORMAL",
  decision: "REJECTED",
});
assert(rejected.ok && !rejected.setTier && rejected.tier === "NORMAL" && rejected.applicationStatus === "REJECTED", "REJECTED does not set tier");

const keepTrusted = planVerificationReview({
  applicationStatus: "PENDING",
  track: "MERCHANT",
  currentTier: "TRUSTED",
  decision: "REJECTED",
});
assert(keepTrusted.ok && !keepTrusted.setTier && keepTrusted.tier === "TRUSTED", "REJECTED leaves an existing tier in place");

assert(!submitApplication({ pending: false, track: "TRUSTED", documentUrl, reason: "" }).ok, "a blank reason is refused");
assert(!submitApplication({ pending: false, track: "TRUSTED", documentUrl, reason: "字".repeat(VERIFY_REASON_MAX + 1) }).ok, "a long reason is refused");
assert(submitApplication({ pending: false, track: "TRUSTED", documentUrl, reason: "字".repeat(VERIFY_REASON_MAX) }).ok, "200 characters fit");
assert(!submitApplication({ pending: false, track: "OTHER", documentUrl, reason: "想賣卡" }).ok, "an unknown track is refused");
assert(!submitApplication({ pending: false, track: "TRUSTED", documentUrl: "https://example.com/id.jpg", reason: "想賣卡" }).ok, "a remote url is not a document");

const page = readFileSync(new URL("../app/me/settings/verify/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/verify-form.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/me/settings/[section]/page.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/profile-header.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../actions/verification.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/internal/verification/route.ts", import.meta.url), "utf8");

assert(account.includes('href="/me/settings/verify"') && account.includes("申請認證"), "account section links to apply");
assert(!settings.includes("/me/settings/verify"), "verify is not a new settings root row");
assert(page.includes("審核中") && page.includes("已通過") && page.includes("唔過"), "applicant sees the three statuses");
assert(page.includes("viewer.nickname") && page.includes("<VerificationPill tier={viewer.verificationTier} />"), "approved state shows the existing pill beside the name");
assert(!page.includes("#E8F5E9") && !page.includes("#FFF3E0"), "the apply page does not invent badge colors");
assert(header.includes("<VerificationPill tier={verificationTier} />") && header.includes("function verificationPill"), "the profile name uses the same pill");
assert(form.includes("誠信（香港身份證）") && form.includes("商戶（商業登記）") && form.includes('name="reason"') && form.includes('type="file"') && form.includes("VERIFY_REASON_MAX"), "form is two tracks, a file, and a short reason");
assert(page.includes('latest?.status === "PENDING"') && page.includes("<VerifyForm"), "the form hides while pending");
assert(action.includes("submitApplication") && action.includes("status: parsed.draft.status") && action.includes('storeUploadedImage') && action.includes('"uploads/verification"'), "apply stores a PENDING row through the shared upload helper");
assert(route.includes("planVerificationReview") && route.includes("plan.setTier") && route.includes("verificationTier: plan.tier"), "approve writes the planned tier and reject does not");

console.log("verification.test.ts ok");
