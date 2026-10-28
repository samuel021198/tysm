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
assert(!page.includes("<DealPanel") && !page.includes("<ThreadLog") && !page.includes("pin={false}"), "the thread has no sticky deal card");
const disclaimer = readFileSync(new URL("../components/deal-disclaimer.tsx", import.meta.url), "utf8");
assert(page.includes("<DealDisclaimer") && page.indexOf("<DealDisclaimer") < page.indexOf("<ThreadScroll"), "the handover line sits above the message list");
assert(!page.includes("sticky") && !disclaimer.includes("sticky") && !disclaimer.includes("fixed"), "the thread disclaimer is not sticky and does not cover the log");
assert(disclaimer.includes("DEAL_BANNER") && disclaimer.includes("bg-soft"), "the disclaimer is the locked one-line gray banner");
const orderPage = readFileSync(new URL("../app/orders/[id]/page.tsx", import.meta.url), "utf8");
assert(orderPage.includes("<DealDisclaimer") && !orderPage.includes("sticky"), "the handover page shows the same line in normal flow");
assert(!page.includes("paddingTop") && !css.includes("thread-log-scroll") && !css.includes("paddingTop: height"), "no reserved top inset for a deal bar");
assert(deal.includes("export function DealStream") && deal.includes('variant === "stream"'), "the stream bubble stays in the message list");
assert(!deal.includes("確認交易") && !deal.includes("提出要約") && !deal.includes("canSellerLock"), "make offer is not a deal-card button");
assert(deal.includes("接受要約") && deal.includes("拒絕") && deal.includes("撤回要約") && deal.includes("等待對方回應"), "a pending offer is accepted, declined, or withdrawn on the bubble");
assert(deal.includes("已收款") && deal.includes("已收貨") && deal.includes("解除保留") && deal.includes("約定交收") && deal.includes("取消交收"), "later handover actions stay on the bubble");
assert(src.includes('name="plus"') && src.includes("提出要約") && src.includes("canOffer") && !src.includes('name="camera"'), "the left control is + and offer is a menu item");
const sheet = readFileSync(new URL("../components/offer-sheet.tsx", import.meta.url), "utf8");
const handover = readFileSync(new URL("../components/handover-form.tsx", import.meta.url), "utf8");
assert(sheet.includes("OFFER_EMPTY") && sheet.includes("交收備註") && sheet.includes("offerEntry"), "the sheet picks a listing only when the thread is not already bound");
assert(sheet.includes("DealDisclaimer") && sheet.includes("DEAL_ACK") && sheet.includes("offerFormLocked") && sheet.includes("disabled={locked}"), "the offer form keeps a risk line and locks price until the first checkbox");
assert(sheet.includes("ackP2pRisk") && src.includes("riskAcked") && src.includes("persisted={riskAcked}"), "the checkbox is once per account, then the form opens straight away");
assert(!src.includes("localStorage"), "the ack is not stored only in the browser");
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
assert(!auth.includes("p2pRiskAckAt") && !login.includes("DEAL_ACK") && !login.includes("p2pRiskAck"), "registration does not record or require this ack");
assert(login.includes("服務條款") && login.includes('name="accept"'), "signup keeps its own terms tick");
assert(handover.includes("傾交收") && !handover.includes("提出要約"), "posts keep 傾交收 and do not grow an offer button");
assert(deal.includes("ProofForm") && deal.includes("交收詳情"), "proof upload and the detail link stay available");
assert(deal.includes("sticky top-[calc(3rem+env(safe-area-inset-top))]"), "the order page can still pin the card to the window");
assert(deal.includes("DEAL_BANNER") && deal.includes("{stream ? null : <p className=\"text-xs font-semibold\">{DEAL_BANNER}</p>}"), "the disclaimer banner stays on the detail card");
assert(proof.includes("上傳付款證明"), "payment proof stays a deal action");

console.log("message-composer.test.ts ok");
