import { readFileSync } from "fs";
import { PhotoStoreError, r2PrivateConfig, storeVerificationDocument, verificationObjectKey } from "./r2";
import {
  classifyVerificationDoc,
  planVerificationReview,
  privateDocKey,
  privateDocRef,
  publicVerificationKey,
  reviewDocumentAccess,
  sniffImageType,
  submitApplication,
  VERIFY_REASON_MAX,
} from "./verification";

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
assert(header.includes("<NameLine name={nickname} tier={verificationTier}") && header.includes("<VerificationPill tier={tier} />") && header.includes("function verificationPill"), "the profile name uses the same pill");
assert(form.includes("誠信（香港身份證）") && form.includes("商戶（商業登記）") && form.includes('name="reason"') && form.includes('type="file"') && form.includes("VERIFY_REASON_MAX"), "form is two tracks, a file, and a short reason");
assert(page.includes('latest?.status === "PENDING"') && page.includes("<VerifyForm"), "the form hides while pending");
assert(action.includes("submitApplication") && action.includes("status: parsed.draft.status") && action.includes("storeVerificationDocument") && action.includes("privateDocKey"), "apply stores a private ref on a PENDING row");
assert(!action.includes("storeUploadedImage") && !action.includes("uploads/verification"), "apply does not write the public upload bucket");
assert(route.includes("planVerificationReview") && route.includes("plan.setTier") && route.includes("verificationTier: plan.tier"), "approve writes the planned tier and reject does not");
assert(route.includes("reviewDocumentAccess") && route.includes("const { documentUrl, ...safe }") && route.includes("relocatePublicVerificationDocs"), "the queue strips the stored ref and can move leftover public objects");
assert(route.includes('cache-control", "private, no-store"') || route.includes('"cache-control": "private, no-store"'), "document bytes are not cached");
assert(!route.includes("storeUploadedImage") && !route.includes("putR2Object"), "review does not write the public bucket");

const i18n = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const r2 = readFileSync(new URL("./r2.ts", import.meta.url), "utf8");
assert(i18n.includes("文件暫時上傳唔到，請稍後再試。"), "missing private storage tells the applicant to retry");
assert(schema.includes("private:verification") && !schema.includes("public image store"), "the column is documented as a private ref");

const storeFn = r2.slice(r2.indexOf("export async function storeVerificationDocument"), r2.indexOf("export function imageFromDataUrl"));
assert(storeFn.includes("r2PrivateConfig") && !storeFn.includes("putR2Object") && !storeFn.includes("publicBase"), "verification uploads do not call the public put");
const publicFn = r2.slice(r2.indexOf("export async function storeUploadedImage"), r2.indexOf("export async function storeUploadedImages"));
assert(publicFn.includes("putR2Object") && !publicFn.includes("r2PrivateConfig") && !publicFn.includes("storeVerificationDocument"), "listing uploads still use the public bucket");
assert(r2.includes("if (!cfg || !isPublicVerificationKey(key)) return false"), "public delete is limited to verification keys");

const base = "https://cards.example.com";
const publicKey = `uploads/verification/${"ab".repeat(12)}.jpg`;
const publicDoc = `${base}/${publicKey}`;
const listingDoc = `${base}/uploads/listings/${"ab".repeat(12)}.jpg`;
assert(publicVerificationKey(publicDoc, base) === publicKey, "a legacy verification URL maps to its object key");
assert(publicVerificationKey(listingDoc, base) === null, "a listing URL is not a verification document");
assert(publicVerificationKey(`https://evil.example/${publicKey}`, base) === null, "another host is not our public bucket");
assert(publicVerificationKey(publicDoc, "https://other.example.com") === null, "a different public base does not match");

const minted = verificationObjectKey("image/webp");
assert(privateDocKey(privateDocRef(minted)) === minted && minted.startsWith("verification/"), "new objects use the private key prefix");
assert(privateDocKey(publicDoc) === null && privateDocKey(`private:uploads/verification/${"ab".repeat(12)}.jpg`) === null, "a public URL is not a private ref");

const id = "ck1234567890abcd";
const withheld = reviewDocumentAccess(id, publicDoc, base, false);
assert(withheld.documentPath === null && withheld.documentError === "needs_private_bucket" && !JSON.stringify(withheld).includes("cards.example.com"), "review hides a public URL until a private bucket exists");
const ready = reviewDocumentAccess(id, publicDoc, base, true);
assert(ready.documentPath === `/api/internal/verification?document=${id}` && !JSON.stringify(ready).includes(publicKey), "review points at the authenticated document route");
const privateAccess = reviewDocumentAccess(id, privateDocRef(minted), base, true);
assert(privateAccess.documentPath === ready.documentPath && !JSON.stringify(privateAccess).includes("private:"), "the queue does not return the object ref");
const dataAccess = reviewDocumentAccess(id, documentUrl, base, false);
assert(dataAccess.documentPath === ready.documentPath && !JSON.stringify(dataAccess).includes("data:"), "a legacy data URL is served through the same route");
assert(classifyVerificationDoc(listingDoc, base).kind === "blocked", "a listing object is not served as a verification document");
assert(sniffImageType("text/html", Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44])) === "image/jpeg", "jpeg bytes still count when the header is wrong");
assert(sniffImageType("text/html", Buffer.from("not-an-image-file!!")) === null, "non-images are refused");

const envKeys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PRIVATE_BUCKET"] as const;
const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
async function assertPrivateBucket() {
  process.env.R2_ACCOUNT_ID = "acct";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET = "public-bucket";
  process.env.R2_PRIVATE_BUCKET = "public-bucket";
  assert(r2PrivateConfig() === null, "private bucket cannot be the public bucket");
  process.env.R2_PRIVATE_BUCKET = "../public";
  assert(r2PrivateConfig() === null, "bucket name cannot climb out");
  process.env.R2_PRIVATE_BUCKET = "id-docs";
  assert(r2PrivateConfig()?.bucket === "id-docs" && r2PrivateConfig()?.accountId === "acct", "private bucket reuses the account keys");
  delete process.env.R2_PRIVATE_BUCKET;
  let closed = false;
  try {
    await storeVerificationDocument(documentUrl);
  } catch (error) {
    closed = error instanceof PhotoStoreError && error.code === "verify_store";
  }
  assert(closed, "verification upload fails closed without a private bucket");
}

assertPrivateBucket()
  .finally(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  })
  .then(() => {
    console.log("verification.test.ts ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
