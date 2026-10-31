import { readFileSync } from "node:fs";
import { BLOCK_CONFIRM, REPORT_NOTE_MAX, REPORT_REASONS, blockAway, composeReportReason } from "./safety";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(REPORT_REASONS.join("|") === "假貨／唔啱圖|欺詐／唔交收|騷擾|垃圾廣告|其他", "the five locked reasons");
assert(REPORT_NOTE_MAX === 80, "其他 note stays within 80 characters");
assert(BLOCK_CONFIRM === "封鎖後唔見對方貨同訊息", "block confirm is the locked sentence");
assert(composeReportReason("騷擾", "ignore") === "騷擾", "a preset reason is stored as that label");
assert(composeReportReason("假貨／唔啱圖", "") === "假貨／唔啱圖", "the first reason round-trips");
assert(composeReportReason("其他", "") === "其他", "其他 can be sent with no note");
assert(composeReportReason("其他", "  補一句  ") === "其他：補一句", "其他 keeps a short note");
assert(composeReportReason("其他", "x".repeat(81)) === null, "a note over 80 characters is rejected");
assert(composeReportReason("nope", "") === null, "an unknown reason is rejected");
assert(blockAway("/", "u") === "/", "the feed stays put");
assert(blockAway("/search?q=a", "u") === "/search", "search stays put");
assert(blockAway("/post/p", "u") === "/", "a post page is left, it would 404");
assert(blockAway("/listing/l", "u") === "/", "a listing page is left");
assert(blockAway("/shop/u", "u") === "/" && blockAway("/shop/u/followers", "u") === "/", "their shop is left");
assert(blockAway("/u/u", "u") === "/", "their profile is left");
assert(blockAway("/messages/t", "u") === "/messages", "a thread returns to the inbox");
assert(blockAway("https://evil.test", "u") === "/", "an off-site next is dropped");

const sheet = readFileSync(new URL("../components/safety-menu.tsx", import.meta.url), "utf8");
assert(sheet.includes("REPORT_REASONS.map") && sheet.includes("type=\"radio\"") && sheet.includes("name=\"reason\"") && sheet.includes("maxLength={REPORT_NOTE_MAX}"), "one reason, and the note is capped");
assert(sheet.includes("reportAction") && sheet.includes("BLOCK_CONFIRM") && sheet.includes("blockUser"), "submit stores a report; block confirms first");
assert(sheet.includes("PersonMenu") && sheet.includes("⋯"), "profile and chat share the ellipsis");

const menu = readFileSync(new URL("../components/post-menu.tsx", import.meta.url), "utf8");
const shop = readFileSync(new URL("../app/shop/[id]/page.tsx", import.meta.url), "utf8");
const thread = readFileSync(new URL("../app/messages/[id]/page.tsx", import.meta.url), "utf8");
const listing = readFileSync(new URL("../app/listing/[id]/page.tsx", import.meta.url), "utf8");
assert(menu.includes("ReportSheet") && menu.includes("BlockButton"), "a post ellipsis opens report and block");
assert(shop.includes("PersonMenu") && shop.includes('reportType="USER"') && !shop.includes("檢舉這位會員"), "a profile ellipsis reports the member");
assert(thread.includes("PersonMenu") && thread.includes('reportType="THREAD"'), "a chat ellipsis reports the thread");
assert(listing.includes("PersonMenu") && listing.includes('reportType="LISTING"') && listing.includes("notIn: hidden"), "a listing ellipsis reports it and hides blocked offers");

const flash = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
assert(flash.includes('report: ["已收到"'), "sending a report toasts 已收到");
const privacy = readFileSync(new URL("../app/me/settings/[section]/page.tsx", import.meta.url), "utf8");
assert(privacy.includes("已封鎖") && privacy.includes("解除封鎖") && privacy.includes("unblockUser"), "privacy lists blocked members with unblock");
const footprint = readFileSync(new URL("./footprint.ts", import.meta.url), "utf8");
assert(footprint.includes("hidden.has(otherId)"), "footprint drops offers and threads from someone you blocked");

console.log("safety.test.ts ok");
