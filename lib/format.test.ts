import { hkPartsToInput, isAllowedMediaUrl } from "./format";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(hkPartsToInput("23", "10", "2026", "18", "5") === "2026-10-23T18:05", "day month year, 24-hour");
assert(hkPartsToInput("29", "2", "2024", "0", "0") === "2024-02-29T00:00", "leap day");
assert(hkPartsToInput("29", "2", "2026", "0", "0") === "", "non-leap day");
assert(hkPartsToInput("31", "4", "2026", "0", "0") === "", "april 31");
assert(hkPartsToInput("10", "23", "2026", "18", "0") === "", "month 23 is not a date");
assert(hkPartsToInput("", "10", "2026", "18", "0") === "", "incomplete");

assert(isAllowedMediaUrl("/demo/back.svg"), "demo art");
assert(isAllowedMediaUrl("https://cdn.example.com/a.jpg"), "https");
assert(!isAllowedMediaUrl("http://cdn.example.com/a.jpg"), "http");
assert(!isAllowedMediaUrl("javascript:alert(1)"), "script");
assert(isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(40)}`), "jpeg upload");
assert(!isAllowedMediaUrl(`data:image/svg+xml;base64,${"a".repeat(40)}`), "svg upload");
assert(!isAllowedMediaUrl(`data:image/jpeg;base64,${"a".repeat(200_000)}`), "oversized upload");

console.log("format ok");
