import { DEMO_SHOWCASE_CODE, DEMO_SHOWCASE_TARGET, DEMO_SHOWCASE_USER_ID, demoShowcaseLogin } from "./demo-login";
import { formatJpy, hkPartsToInput, isAllowedMediaUrl, parseTarget } from "./format";

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

assert(isAllowedMediaUrl("/demo/back.svg"), "demo art");
assert(isAllowedMediaUrl("https://cdn.example.com/a.jpg"), "https");
assert(!isAllowedMediaUrl("http://cdn.example.com/a.jpg"), "http");
assert(!isAllowedMediaUrl("javascript:alert(1)"), "script");
assert(isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(40)}`), "jpeg upload");
assert(!isAllowedMediaUrl(`data:image/svg+xml;base64,${"a".repeat(40)}`), "svg upload");
assert(!isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(200_000)}`), "oversized upload");

assert(parseTarget("123") === null, "123 is not an email or HK phone");
assert(parseTarget("mei@tysm.hk")?.target === "mei@tysm.hk", "mei email still parses");
assert(parseTarget("91111111")?.target === "+85291111111", "ming phone still parses");
const demo = demoShowcaseLogin(" 123 ");
assert(demo?.target === DEMO_SHOWCASE_TARGET && demo.channel === "demo", "trimmed 123 is the showcase login");
assert(demoShowcaseLogin("1234") === null && demoShowcaseLogin("0123") === null, "only the exact showcase target");
assert(demoShowcaseLogin("mei@tysm.hk") === null, "demo login does not swallow emails");
assert(DEMO_SHOWCASE_CODE === "123" && DEMO_SHOWCASE_USER_ID === "user_showcase", "fixed showcase code and user");

console.log("format ok");
