import { readFileSync } from "fs";
import {
  DESK_HINT,
  DISPUTE_CHIPS,
  DISPUTE_HELPER,
  deskStatus,
  deskTimeline,
  disputeImageList,
  disputeReport,
} from "./order-desk";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const jpeg = `data:image/jpeg;base64,${"a".repeat(40)}`;

assert(deskStatus({ status: "PENDING_PAYMENT" }) === "進行中", "an open handover is 進行中");
assert(deskStatus({ status: "AWAITING_SHIP" }) === "進行中", "legacy awaiting-ship stays 進行中");
assert(deskStatus({ status: "COMPLETED" }) === "已完成", "completed is 已完成");
assert(
  deskStatus({ status: "PENDING_PAYMENT", fulfillment: { deal: { buyerHandover: true, sellerHandover: true, proofs: [] } } }) === "已完成",
  "both confirms read as 已完成 even before the status column catches up",
);
assert(deskStatus({ status: "CANCELLED" }) === "已取消" && deskStatus({ status: "REFUNDED" }) === "已取消", "cancelled and refunded are 已取消");
assert(deskStatus({ status: "DISPUTED" }) === "爭議中", "a disputed order is 爭議中, not 已取消");
assert(deskStatus({ status: "PENDING_PAYMENT", dispute: { status: "OPEN" } }) === "爭議中", "an open dispute row is 爭議中");
assert(deskStatus({ status: "COMPLETED", dispute: { status: "BUYER_WINS" } }) === "已完成", "a decided dispute follows the order");
assert(DESK_HINT.進行中 === "雙方已落單／交收未完" && DESK_HINT.爭議中 === "有一方撳咗「有問題」", "status hints stay the trader lines");

assert(deskTimeline("進行中").map((step) => `${step.label}:${step.state}`).join() === "下單:done,進行中:current,完結:wait", "an open order stops before 完結");
assert(deskTimeline("爭議中").map((step) => step.state).join() === "done,current,wait", "a dispute stays on 進行中");
assert(deskTimeline("已完成").every((step) => step.state === "done") && deskTimeline("已取消").every((step) => step.state === "done"), "finished orders close the timeline");

assert(DISPUTE_CHIPS.join("｜") === "未收到貨｜品相不符｜交收有異｜其他（請說明）", "reason chips are the locked four");
assert(DISPUTE_HELPER === "交收有異／未收到／品相不符，可附圖", "sheet helper stays");
const noted = disputeReport("未收到貨", "  順豐顯示已簽收 ");
assert(noted.ok && noted.reason === "未收到貨：順豐顯示已簽收", "a preset still needs the short note");
assert(!disputeReport("未收到貨", "  ").ok, "blank text is rejected");
assert(!disputeReport("沒有這個", "說明").ok, "an unknown chip is rejected");
assert(!disputeReport("其他（請說明）", "其他（請說明）").ok, "其他 cannot repeat the chip");
assert(!disputeReport("其他（請說明）", "???").ok, "其他 cannot be punctuation only");
const other = disputeReport("其他（請說明）", " 卡角有花 ");
assert(other.ok && other.reason === "其他（請說明）：卡角有花", "其他 accepts a clear note");
assert(disputeImageList([]).ok && disputeImageList([jpeg, jpeg, jpeg]).ok, "photos are optional, up to 3");
assert(!disputeImageList([jpeg, jpeg, jpeg, jpeg]).ok && !disputeImageList(["javascript:alert(1)"]).ok, "a fourth photo or a script url is rejected");

const list = readFileSync(new URL("../app/orders/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/orders/[id]/page.tsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../components/order-issue-sheet.tsx", import.meta.url), "utf8");
const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const flash = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../lib/admin-desk.ts", import.meta.url), "utf8");
const bar = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const orders = readFileSync(new URL("./orders.ts", import.meta.url), "utf8");

assert(list.includes("我的訂單") && list.includes("買入") && list.includes("賣出") && list.includes("暫無訂單") && list.includes("deskStatus"), "list title, tabs, and empty line");
assert(!list.includes("我買的") && !list.includes("我賣的"), "old purchase tabs are gone");
assert(detail.includes("deskTimeline") && detail.includes("OrderIssueSheet") && detail.includes('blocked={status === "爭議中"}'), "detail has the timeline and the problem button");
assert(sheet.includes("DISPUTE_CHIPS") && sheet.includes("DISPUTE_HELPER") && sheet.includes("disputeReport") && sheet.includes('name="reason"') && sheet.includes("required") && sheet.includes("DISPUTE_IMAGE_MAX"), "the sheet requires a chip, a note, and caps photos");
assert(me.includes('href="/orders"') && me.includes('tx(locale, "訂單", "Orders")'), "/me has an 訂單 row");
assert(!bar.includes("訂單"), "bottom nav does not gain an orders tab");
assert(flash.includes("已交客服跟進"), "submit toast copy");
assert(orders.includes("reportOrderIssue") && orders.includes('status: "DISPUTED"') && orders.includes("dispute.create"), "有問題 writes a dispute and marks the order");
assert(admin.includes("row.images") && admin.includes("買家勝（賣家付退運）") && tabs.includes('"disputes"') && !tabs.includes('"orders"'), "photos show on the existing 爭議 queue");

console.log("order-desk.test.ts ok");
