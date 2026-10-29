import { readFileSync } from "node:fs";
import { dealPhase } from "./deal-phase";
import { counterpartyName, dealKind, footprintStatusLabel, offerGroup, offerKind, openDealGroup, openDealRows, type FootprintBoard, type FootprintKind, type FootprintRow } from "./footprint";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(openDealGroup("CHATTING") === "offering", "talking, including a live offer, is 議價中");
assert(openDealGroup("CONFIRMED") === "locked", "an accepted offer is 已保留");
assert(openDealGroup("ARRANGED") === "handover" && openDealGroup("PROOF") === "handover" && openDealGroup("SELLER_PAID") === "handover", "meetup, proof, and handover confirm are 待交收");
assert(openDealGroup("CANCELLED") === "ended" && openDealGroup("DONE") === null, "cancel folds into 已結束; a finished deal leaves 交易中");
assert(footprintStatusLabel("zh-HK", "offering") === "議價中" && footprintStatusLabel("zh-HK", "locked") === "已保留" && footprintStatusLabel("zh-HK", "handover") === "待交收" && footprintStatusLabel("zh-HK", "done") === "已完成", "row labels use the locked status words");

assert(offerGroup("PENDING") === "offering" && offerGroup("COUNTERED") === "offering", "the seller inbox stays inside 議價中");
assert(offerGroup("DECLINED") === "ended" && offerGroup("CANCELLED") === "ended" && offerGroup("EXPIRED") === "ended", "decline, withdraw, and expiry are not a fourth tab");
assert(offerGroup("ACCEPTED") === null, "an accepted offer is the order row");
assert(offerKind("CANCELLED") === "withdrawn" && offerKind("DECLINED") === "declined", "withdraw and decline keep their own ended label");

assert(dealKind(dealPhase({ status: "AWAITING_SHIP" })) === "handover", "legacy awaiting-ship is still 待交收");
assert(dealKind(dealPhase({ status: "PENDING_PAYMENT", fulfillment: { deal: { confirmed: true, proofs: [] } } })) === "locked", "an accepted offer is 已保留");
assert(dealKind(dealPhase({ status: "COMPLETED" })) === "done", "completed deals are 已出售 or 已購買");
assert(dealKind(dealPhase({ status: "DISPUTED" })) === "cancelled", "a stopped deal is 已結束");

assert(counterpartyName("buyer", "buyer", "seller", "阿買", "阿賣") === "阿賣", "the buyer sees the seller");
assert(counterpartyName("seller", "buyer", "seller", "阿買", "阿賣") === "阿買", "the seller sees the buyer");
assert(counterpartyName("seller", "buyer", "seller", "  ", "阿賣") === "—", "a blank nickname is a dash");

const row = (id: string, kind: FootprintKind, at: string): FootprintRow => ({
  id,
  href: `/messages/${id}`,
  title: id,
  who: "阿明",
  priceCents: 1000,
  photo: null,
  at: new Date(at),
  kind,
});
const board: FootprintBoard = {
  offering: [row("offer", "offering", "2026-01-02T00:00:00Z"), row("done-in-talk", "done", "2026-01-09T00:00:00Z")],
  locked: [row("lock", "locked", "2026-01-03T00:00:00Z")],
  handover: [row("hand", "handover", "2026-01-01T00:00:00Z")],
  ended: [row("end", "cancelled", "2026-01-08T00:00:00Z")],
  sold: [row("sold", "done", "2026-01-07T00:00:00Z")],
  bought: [row("bought", "done", "2026-01-06T00:00:00Z")],
};
assert(openDealRows(board).map((item) => item.id).join() === "lock,offer,hand", "交易中 is 已保留, 議價中, 待交收, newest first");
assert(openDealRows(board).every((item) => item.href.startsWith("/messages/")), "each open row opens its chat thread");

const page = readFileSync(new URL("../app/me/footprint/page.tsx", import.meta.url), "utf8");
assert(
  page.includes("openDealRows") && page.includes("row.who") && page.includes("row.href") && page.includes("row.photo") && page.includes("footprintStatusLabel") && page.includes("formatHkd"),
  "a 交易中 row is thumb, title, nickname, status pill, and price",
);
assert(!page.includes("要約"), "footprint does not say 要約");

console.log("footprint.test.ts ok");
