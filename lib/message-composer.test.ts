import { existsSync, readFileSync } from "node:fs";
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
assert(src.includes("pinThreadToEnd") && src.includes('setBody("")') && src.includes('setImageUrl("")'), "a sent draft clears and the log follows the new bubble");

const social = readFileSync(new URL("../actions/social.ts", import.meta.url), "utf8");
const send = social.slice(social.indexOf("export async function sendMessage"), social.indexOf("export async function shareIntoThread"));
assert(send.includes("revalidatePath(`/messages/${threadId}`)") && send.includes('revalidatePath("/messages")'), "a sent message refreshes the thread and the inbox");
assert(!send.includes("redirect(`/messages/${threadId}`)"), "a sent message does not navigate the thread");
assert(send.includes("?err="), "a rejected send still explains itself");

const trade = readFileSync(new URL("../actions/trade.ts", import.meta.url), "utf8");
assert(trade.includes('next.startsWith("/messages/")') && trade.includes("revalidatePath(next)"), "deal actions on a thread refresh in place");
assert(trade.includes("redirect(`${next}?"), "deal actions on an order page still report with a redirect");

const page = readFileSync(new URL("../app/messages/[id]/page.tsx", import.meta.url), "utf8");
const deal = readFileSync(new URL("../components/deal-panel.tsx", import.meta.url), "utf8");
const proof = readFileSync(new URL("../components/proof-form.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!existsSync(new URL("../components/thread-log.tsx", import.meta.url)), "the sticky thread log overlay is gone");
const scroll = readFileSync(new URL("../components/thread-scroll.tsx", import.meta.url), "utf8");
assert(page.includes("<DealStream") && page.includes("<MessageComposer") && page.includes("<ThreadScroll"), "the thread shows an in-flow deal bubble and the composer");
assert(!scroll.includes("paddingTop") && !scroll.includes("ResizeObserver") && !scroll.includes("sticky"), "the scroller does not reserve a deal-bar inset");
assert(scroll.includes("onScroll") && scroll.includes("scrollHeight - el.scrollTop") && scroll.includes("pinThreadToEnd"), "a reader at the bottom stays with the newest row; scrolling up is left alone");
assert(/\{order \? \([\s\S]*<DealStream[\s\S]*\) : null\}/.test(page), "the deal bubble renders only when the thread has an order");
assert(!page.includes("<DealPanel") && !page.includes("DEAL_BANNER") && !page.includes("<ThreadLog") && !page.includes("pin={false}"), "the thread has no sticky deal card or banner");
assert(!page.includes("paddingTop") && !css.includes("thread-log-scroll") && !css.includes("paddingTop: height"), "no reserved top inset for a deal bar");
assert(deal.includes("export function DealStream") && deal.includes('variant === "stream"') && deal.includes("canSellerLock(phase)"), "stream bubble uses the same confirm-deal lock");
assert(deal.includes("確認交易") && deal.includes("已收款") && deal.includes("已收貨") && deal.includes("解除保留") && deal.includes("約定交收") && deal.includes("取消交收"), "primary handover actions stay on the bubble");
assert(deal.includes("ProofForm") && deal.includes("交收詳情"), "proof upload and the detail link stay available");
assert(deal.includes("sticky top-[calc(3rem+env(safe-area-inset-top))]"), "the order page can still pin the card to the window");
assert(deal.includes("DEAL_BANNER") && deal.includes("{stream ? null : <p className=\"text-xs font-semibold\">{DEAL_BANNER}</p>}"), "the disclaimer banner stays on the detail card");
assert(proof.includes("上傳付款證明"), "payment proof stays a deal action");

console.log("message-composer.test.ts ok");
