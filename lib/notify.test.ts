import { readFileSync } from "node:fs";
import { noticeCopy, noticeHref, notificationTarget } from "./notify";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(noticeCopy("offer-new").title === "新要約" && noticeCopy("offer-new").type === "offer", "a new offer uses the offer toggle");
assert(noticeCopy("offer-supersede").title === "改價覆蓋" && noticeCopy("offer-supersede").type === "offer", "a replaced price is 改價覆蓋");
assert(noticeCopy("offer-accept").title === "對方已接受" && noticeCopy("offer-decline").title === "對方已拒絕", "accept and decline name the other party");
assert(noticeCopy("offer-withdraw").type === "offer" && noticeCopy("handover").title === "待交收提醒" && noticeCopy("handover").type === "order", "withdraw stays an offer; handover uses the order toggle");
assert(noticeCopy("message", "  你好 ").title === "新訊息" && noticeCopy("message", "  你好 ").body === "你好", "a chat ping trims the snippet");
assert(noticeCopy("offer-new", "x".repeat(90)).body.length === 80, "a long card name stays one line");
assert(noticeHref("abc") === "/messages/abc" && noticeHref(null) === "/me/footprint", "a row opens the thread, or the footprint when there is none");
assert(notificationTarget("/messages/abc") === "/messages/abc", "a stored thread path opens");
assert(notificationTarget("https://evil.example") === "/notifications" && notificationTarget("//evil") === "/notifications", "an off-site href stays in the inbox");

const deals = readFileSync(new URL("./deals.ts", import.meta.url), "utf8");
assert(deals.includes('outcome.superseded ? "offer-supersede" : "offer-new"'), "replacing an offer notifies 改價覆蓋");
assert(deals.includes('"handover"'), "entering handover writes 待交收提醒");
const page = readFileSync(new URL("../app/notifications/page.tsx", import.meta.url), "utf8");
assert(page.includes("relativeTime") && page.includes("openNotification") && page.includes("rounded-full bg-accent"), "the list is unread dot, relative time, and mark-on-tap");
const settings = readFileSync(new URL("../app/me/settings/[section]/page.tsx", import.meta.url), "utf8");
assert(settings.includes("notifyOffers") && settings.includes("notifyMessages") && settings.includes("notifyEmail") && settings.includes("PushToggle"), "settings keeps separate toggles plus email opt-in and browser push");

console.log("notify.test.ts ok");
