import { readFileSync } from "node:fs";
import { composerCanSend, composerExpanded } from "./message-composer";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(!composerExpanded({ focused: false, tray: false, body: "", image: "" }), "idle composer stays collapsed");
assert(composerExpanded({ focused: true, tray: false, body: "", image: "" }), "focus opens the composer");
assert(composerExpanded({ focused: false, tray: true, body: "", image: "" }), "the attach control opens the composer");
assert(composerExpanded({ focused: false, tray: false, body: "  你好 ", image: "" }), "a draft stays open");
assert(!composerExpanded({ focused: false, tray: false, body: "   ", image: "  " }), "blur with an empty draft collapses");
assert(composerExpanded({ focused: false, tray: false, body: "", image: "https://cdn.example/a.jpg" }), "a photo keeps the composer open");
assert(!composerCanSend({ body: "  ", image: "" }) && composerCanSend({ body: "嗨", image: "" }), "send waits for text");
assert(composerCanSend({ body: "", image: "https://cdn.example/a.jpg" }), "a photo alone can send");

const src = readFileSync(new URL("../components/message-composer.tsx", import.meta.url), "utf8");
assert(src.includes('placeholder={tx(locale, "訊息", "Message")}'), "the row placeholder stays 訊息");
assert(src.includes("加入相片") && src.includes("或貼上圖片網址"), "photo and url paste stay available once expanded");
assert(src.includes("composerExpanded") && src.includes("setTray(false)"), "the attach row is gated and can close");
assert(!src.includes("btn btn-primary w-full"), "send is not a full-width block");
assert(src.includes('name="body"') && src.includes('name="imageUrl"') && src.includes("sendMessage"), "submit still posts body and image");
assert(src.includes("autoFocus={focus}"), "compose=1 still focuses the field");

const page = readFileSync(new URL("../app/messages/[id]/page.tsx", import.meta.url), "utf8");
const deal = readFileSync(new URL("../components/deal-panel.tsx", import.meta.url), "utf8");
const proof = readFileSync(new URL("../components/proof-form.tsx", import.meta.url), "utf8");
const log = readFileSync(new URL("../components/thread-log.tsx", import.meta.url), "utf8");
assert(page.includes("<DealPanel") && page.includes("<MessageComposer") && page.includes("<ThreadLog"), "the thread keeps the deal card, the log, and the composer");
assert(page.includes("DEAL_BANNER") && page.includes("pin={false}"), "a thread with no order still shows the banner inside the same log");
assert(log.includes("paddingTop: height") && log.includes("scrollPaddingTop: height") && log.includes("ResizeObserver"), "message inset tracks the sticky bar height");
assert(deal.includes("ProofForm") && deal.includes("取消交收") && deal.includes("交收詳情"), "handover links stay on the deal card");
assert(deal.includes("sticky top-[calc(3rem+env(safe-area-inset-top))]"), "the order page can still pin the card to the window");
assert(proof.includes("上傳付款證明"), "payment proof stays a deal action");

console.log("message-composer.test.ts ok");
