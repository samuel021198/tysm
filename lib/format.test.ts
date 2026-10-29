import { DEMO_ACCOUNTS, DEMO_CODE, demoAccountByHandle } from "./demo-login";
import { bidFloorText, formatJpy, hkPartsToInput, isAllowedMediaUrl, parseTarget } from "./format";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(hkPartsToInput("23", "10", "2026", "18", "5") === "2026-10-23T18:05", "day month year, 24-hour");
assert(hkPartsToInput("29", "2", "2024", "0", "0") === "2024-02-29T00:00", "leap day");
assert(hkPartsToInput("29", "2", "2026", "0", "0") === "", "non-leap day");
assert(hkPartsToInput("31", "4", "2026", "0", "0") === "", "april 31");
assert(hkPartsToInput("10", "23", "2026", "18", "0") === "", "month 23 is not a date");
assert(hkPartsToInput("", "10", "2026", "18", "0") === "", "incomplete");
assert(formatJpy(190000) === "¥190,000" && formatJpy(83) === "¥83", "yen stays whole yen");
assert(bidFloorText("zh-HK", "below_min", 1100) === "出價低於最低加價，最低 HK$11.00", "a low bid names the minimum");
assert(bidFloorText("zh-HK", "below_start", 800) === "出價低於起標價 HK$8.00", "a bid under the start names that floor");
assert(bidFloorText("zh-HK", "state", 1100) === null, "other errors stay on the shared copy");

assert(isAllowedMediaUrl("/demo/back.svg"), "demo art");
assert(isAllowedMediaUrl("https://cdn.example.com/a.jpg"), "https");
assert(!isAllowedMediaUrl("http://cdn.example.com/a.jpg"), "http");
assert(!isAllowedMediaUrl("javascript:alert(1)"), "script");
assert(isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(40)}`), "jpeg upload");
assert(!isAllowedMediaUrl(`data:image/svg+xml;base64,${"a".repeat(40)}`), "svg upload");
assert(!isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(200_000)}`), "oversized upload");

assert(parseTarget("123") === null, "123 is not an email or HK phone");
assert(parseTarget("mars@tysm.hk")?.target === "mars@tysm.hk", "mars email still parses");
assert(parseTarget("91111111")?.target === "+85291111111", "8-digit phone still parses");
const mars = demoAccountByHandle(" mars ");
assert(mars?.handle === "mars" && mars.nickname === "Mars" && mars.id === "user_mars", "trimmed handle is Mars");
assert(demoAccountByHandle("MueL")?.nickname === "MueL", "display name lowercases onto the handle");
assert(demoAccountByHandle("123") === null && demoAccountByHandle("mars@tysm.hk") === null, "code and emails are not handles");
assert(DEMO_CODE === "123" && DEMO_ACCOUNTS.map((row) => row.nickname).join() === "Mars,Tyu,MueL", "three demos share code 123");

console.log("format ok");
