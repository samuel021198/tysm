import { existsSync, readFileSync } from "node:fs";
import { composerCanSend, composerExpanded } from "./message-composer";
import { threadFrameBox } from "./thread-viewport";

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
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!existsSync(new URL("../components/thread-log.tsx", import.meta.url)), "the sticky thread log overlay is gone");
const scroll = readFileSync(new URL("../components/thread-scroll.tsx", import.meta.url), "utf8");
assert(page.includes("<DealStream") && page.includes("showDealStream") && page.includes("<MessageComposer") && page.includes("<ThreadScroll"), "the thread shows an in-flow deal bubble and the composer");
assert(!scroll.includes("paddingTop") && !scroll.includes("ResizeObserver") && !scroll.includes("sticky"), "the scroller does not reserve a deal-bar inset");
assert(scroll.includes("onScroll") && scroll.includes("scrollHeight - el.scrollTop") && scroll.includes("pinThreadToEnd"), "a reader at the bottom stays with the newest row; scrolling up is left alone");
assert(page.includes("showDealStream(phase, offerStatus)"), "the deal bubble stays off until an offer is submitted or the deal is past talking");
assert(!page.includes("<DealPanel") && !page.includes("<ThreadLog") && !page.includes("pin={false}"), "the thread has no sticky deal card");
const disclaimer = readFileSync(new URL("../components/deal-disclaimer.tsx", import.meta.url), "utf8");
assert(!page.includes("DealDisclaimer") && !page.includes("DEAL_BANNER"), "the thread has no handover banner above the log");
assert(!page.includes("sticky") && !disclaimer.includes("sticky") && !disclaimer.includes("fixed"), "the offer-form line is not a sticky thread banner");
assert(disclaimer.includes("DEAL_BANNER") && disclaimer.includes("bg-soft"), "the offer form keeps the locked one-line risk copy");
const orderPage = readFileSync(new URL("../app/orders/[id]/page.tsx", import.meta.url), "utf8");
assert(!orderPage.includes("DealDisclaimer") && !orderPage.includes("sticky"), "the handover page does not repeat the gray banner");
assert(!page.includes("paddingTop") && !css.includes("thread-log-scroll") && !css.includes("paddingTop: height"), "no reserved top inset for a deal bar");
assert(deal.includes("export function DealStream") && deal.includes('variant === "stream"'), "the stream bubble stays in the message list");
assert(!deal.includes("要約") && !deal.includes("確認交易") && !deal.includes("確認已交收") && !deal.includes("確認收貨") && !deal.includes("上載付款證明") && !deal.includes("ProofForm") && !deal.includes("付款證明"), "the bubble has no offer-word, proof upload, or split confirm");
const pendingAnswer = deal.slice(deal.indexOf("viewerId !== pending.by"), deal.indexOf('phase === "CONFIRMED"'));
assert(pendingAnswer.includes('tx(locale, "接受", "Accept")') && pendingAnswer.includes("acceptDealOfferAction") && !pendingAnswer.includes("確認交易") && !pendingAnswer.includes("confirmDealAction"), "answering a live offer is 接受, which is the reservation");
assert(deal.includes('tx(locale, "接受", "Accept")') && deal.includes("ReviseOfferButton") && deal.includes("拒絕") && deal.includes("撤回") && deal.includes("提出：") && deal.includes("等待：") && deal.includes("確認交收") && deal.includes("confirmHandoverAction"), "the live card names who proposed and who is waiting; either person accepts, revises, or declines, then both confirm handover");
assert(!deal.includes("撤回要約") && !deal.includes("解除鎖定") && !deal.includes("約定交收") && !deal.includes("取消交收") && !deal.includes("標記已出售"), "retired handover buttons stay off the bubble");
assert(page.includes("已取代") && page.includes("event.superseded") && page.includes("liveOfferId"), "a replaced offer stays in the log as 已取代, and the live one is only the deal card");
assert(page.includes("pendingOffer?.by === viewer.id") && page.includes("offerPrefill"), "the proposer can open + while their offer is live, with the current price and note");
assert(page.includes('thread.intent !== "DIRECT"'), "a direct buy waits on 確認 or 已售 instead of opening another offer");
assert(src.includes("prefill={offerPrefill}"), "the + menu opens the same make-offer form");
assert(deal.includes("canConfirmHandover") && deal.includes("stream && (buyer || seller)") && deal.includes("待對方確認交收。"), "both sides share one confirm, and the side that already tapped waits");
assert(src.includes('name="plus"') && src.includes('tx(locale, "議價", "Offer")') && src.includes("canOffer") && !src.includes("提出要約") && !src.includes('name="camera"'), "the left control is + and 議價 is a menu item");
const sheet = readFileSync(new URL("../components/offer-sheet.tsx", import.meta.url), "utf8");
const handover = readFileSync(new URL("../components/handover-form.tsx", import.meta.url), "utf8");
assert(sheet.includes("OFFER_EMPTY") && sheet.includes("交收備註") && sheet.includes("offerEntry"), "the sheet picks a listing only when the thread is not already bound");
assert(sheet.includes("改價回覆") && sheet.includes("prefill") && sheet.includes("makeDealOfferAction"), "改價回覆 reuses the make-offer form with the current price and note");
assert(/await makeDealOfferAction\(formData\);\s*onClose\(\)/.test(sheet), "a successful offer closes the sheet the same way as 關閉");
assert(sheet.includes("DealDisclaimer") && sheet.includes("DEAL_ACK") && sheet.includes("offerFormLocked") && sheet.includes("disabled={locked}"), "the offer form keeps a risk line and locks price until the first checkbox");
assert(sheet.includes("ackP2pRisk") && src.includes("riskAcked") && src.includes("persisted={riskAcked}"), "the checkbox is once per account, then the form opens straight away");
assert(!src.includes("localStorage"), "the ack is not stored only in the browser");
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
assert(!auth.includes("p2pRiskAckAt") && !login.includes("DEAL_ACK") && !login.includes("p2pRiskAck"), "registration does not record or require this ack");
assert(login.includes("服務條款") && login.includes('name="accept"'), "signup keeps its own terms tick");
assert(handover.includes("傾交收") && !handover.includes("提出要約") && !handover.includes("DEAL_ACK") && !handover.includes("checkbox"), "posts keep 傾交收 and do not show a risk checkbox");
assert(!existsSync(new URL("../components/proof-form.tsx", import.meta.url)) && deal.includes("交收詳情") && deal.includes("DealRatingForm") && !deal.includes("imageUrl") && !deal.includes("h-10 w-10"), "proof upload is gone; the detail link and the rating form stay, without a second listing card");
assert(/\{stream \? \([\s\S]*pending\.amount[\s\S]*\) : \(/.test(deal) && deal.includes("order.items.map"), "the chat bubble can show the offer amount; the listing name and price stay on the order card");
assert(!orderPage.includes("送出評價") && !orderPage.includes("confirmAction") && orderPage.includes("打開聊天"), "the handover page is a status mirror back into the chat");
assert(deal.includes("sticky top-[calc(3rem+env(safe-area-inset-top))]"), "the order page can still pin the card to the window");
assert(deal.includes("{stream ? null : <p className=\"text-xs text-muted\">{DEAL_BANNER}</p>}"), "deal detail keeps one fine-print line, and the chat bubble does not");
const start = social.slice(social.indexOf("export async function startHandover"), social.indexOf("export async function openDirectThread"));
assert(!start.includes('get("ack")') && !start.includes("p2pRiskAck"), "starting a handover does not post the risk checkbox");
const openedThread = social.slice(social.indexOf("export async function openThread"), social.indexOf("export async function sendMessage"));
assert(openedThread.includes('focus === "offer"') && openedThread.includes('focus === "buy"') && openedThread.includes('focus === "compose"') && openedThread.includes("nextThreadIntent") && openedThread.includes("threadEntryQuery") && openedThread.includes("recordDirectBuy"), "議價, 直接購買, and 聯絡賣家 open the same listing thread");
assert(openedThread.includes("contactThreadId") && openedThread.includes("ordersOnThread"), "a DONE deal is not reopened; 聯絡 and 查詢 use the later thread");
assert(!openedThread.includes("message.create"), "議價 and 聯絡賣家 do not post a listing message on open");
const phaseLib = readFileSync(new URL("../lib/deal-phase.ts", import.meta.url), "utf8");
assert(phaseLib.includes('return "?offer=1"') && phaseLib.includes('return "?compose=1"') && !phaseLib.includes("要約"), "議價 opens the price sheet and 聯絡賣家 focuses the composer");
const direct = social.slice(social.indexOf("export async function openDirectThread"), social.indexOf("export async function openThread"));
assert(
  direct.includes("listingId: null") &&
    direct.includes("buyerId: user.id, sellerId: otherId") &&
    direct.includes("buyerId: otherId, sellerId: user.id") &&
    direct.includes("redirect(`/messages/${thread.id}`)") &&
    direct.includes('intent: "INQUIRY"') &&
    !direct.includes("listingId,"),
  "a profile message opens or creates a listing-free 查詢 thread",
);
const bar = readFileSync(new URL("../components/listing-chat-bar.tsx", import.meta.url), "utf8");
assert(page.includes("<ListingChatBar") && page.includes('openOffer={sp.offer === "1"}'), "a listing thread pins the product row and can open 議價");
assert(page.includes("threadIdForOrder") && page.includes("siblingThreads"), "a later thread does not show the finished order");
assert(page.includes('href="/messages"') && page.includes("thread-bar") && page.includes("返回訊息"), "the thread bar goes back to the inbox");
assert(!page.includes('href="/"'), "the thread bar does not send people home");
const inbox = readFileSync(new URL("../app/messages/page.tsx", import.meta.url), "utf8");
assert(!inbox.includes("thread-fit") && !inbox.includes("thread-bar"), "the inbox keeps the normal shell");
assert(inbox.includes("other.avatarUrl") && inbox.includes("other.nickname.slice(0, 1)") && inbox.includes("<NameLine") && inbox.includes("tier={other.verificationTier}") && !inbox.includes("rating="), "an inbox row shows the photo or initial and the verify pill, not the score");
const threadBar = page.slice(page.indexOf('className="thread-bar'), page.indexOf("</header>"));
assert(threadBar.includes("other.avatarUrl") && threadBar.includes("other.nickname.slice(0, 1)") && threadBar.includes("<NameLine") && threadBar.includes("rating={otherRating}"), "the thread bar shows the avatar beside NameLine");
assert(!page.slice(page.indexOf("{thread.messages.map")).includes("avatarUrl"), "message bubbles do not show avatars");
assert(
  css.includes("body:has(.thread-fit) > .site-header") && css.includes("body:has(.thread-fit) > .tab-bar") && css.includes("body:has(.thread-fit) > footer") && css.includes("--tab-h: 0px"),
  "a thread hides the site header, footer, and tab bar",
);
const threadLoading = readFileSync(new URL("../app/messages/[id]/loading.tsx", import.meta.url), "utf8");
assert(threadLoading.includes("thread-fit") && threadLoading.includes("ThreadViewport"), "the thread stays fullscreen while it loads");
assert(page.includes("ThreadViewport"), "the open thread tracks the visible viewport");
assert(!src.includes("sticky") && !src.includes("--tab-h"), "the composer sits in the column instead of sticking to the layout viewport");
assert(
  css.includes("top: var(--vv-top, 0px)") && css.includes("height: var(--vvh, 100svh)") && /body:has\(\.thread-fit\) \{[\s\S]*?min-height: 0;/.test(css) && css.includes('html[data-thread-keyboard="open"] .thread-fit') && css.includes("padding-bottom: max(0.5rem, env(safe-area-inset-bottom))") && css.includes("padding-top: env(safe-area-inset-top)"),
  "the thread follows the visual viewport and keeps the notch and home indicator clear",
);
const frame = readFileSync(new URL("../components/thread-viewport.tsx", import.meta.url), "utf8");
assert(frame.includes("visualViewport") && frame.includes("threadFrameBox") && frame.includes("--vvh") && frame.includes("threadKeyboard"), "the shell publishes the visible band");
assert(threadFrameBox({ innerHeight: 800, height: 400, offsetTop: 0, scale: 1.2 }) === null, "pinch zoom is not a keyboard");
const toolbar = threadFrameBox({ innerHeight: 800, height: 750, offsetTop: 0 });
assert(toolbar?.keyboard === false && toolbar.height === 750, "the Safari toolbar is not a keyboard");
const keys = threadFrameBox({ innerHeight: 844, height: 420.4, offsetTop: 80.2 });
assert(keys?.keyboard === true && keys.height === 420 && keys.top === 80, "the frame tracks the visible band above the keyboard");
assert(bar.includes("sticky top-0") && bar.includes("/listing/${listingId}") && bar.includes("priceOnly") && bar.includes("議價") && bar.includes("直接購買") && bar.includes(">查詢</button>") && bar.includes(">確認</button>") && bar.includes(">已售</button>"), "the pinned card links to the listing and keeps 議價, 直接購買, 查詢, and the seller replies");
assert(!bar.includes("議價中") && !bar.includes("要約"), "the pin has no 議價中 pill and does not say 要約");
assert(bar.includes("offerClosed") && bar.includes("disabled={offerClosed}") && bar.includes("if (!openOffer || offerClosed)"), "the pinned 議價 stays labelled 議價 and does not open when reserved or sold");
assert(!bar.includes("出價") && !bar.includes("聯絡買家") && !bar.includes("瀏覽賣家") && !bar.includes("canOffer") && !bar.includes("還價"), "the pinned card does not rename the button or add a shop tab");
assert(page.includes("offerClosed={offersClosed"), "the thread greys 議價 from the listing hold");
assert(sheet.includes('priceOnly ? "議價"') && sheet.includes("priceOnly ? null") && sheet.includes("價錢"), "the 議價 sheet asks for a price and skips the note");
assert(!sheet.includes("還價") && !deal.includes("瀏覽賣家"), "this wave does not add a counter-offer or a seller tab");
const deals = readFileSync(new URL("../lib/deals.ts", import.meta.url), "utf8");
const opened = deals.slice(deals.indexOf("export async function openHandover"), deals.indexOf("export async function attachDealThread"));
assert(!opened.includes("input.ack") && !opened.includes('error: "terms"'), "opening a handover is not gated on a post checkbox");
assert(!opened.includes("message.create") && !opened.includes("shareTargetFor"), "opening a handover does not post a listing card");
const attached = deals.slice(deals.indexOf("export async function attachDealThread"), deals.indexOf("async function loadOrder"));
assert(!attached.includes("message.create") && !attached.includes("share.path"), "attaching a deal thread does not post a listing card");
assert(!deals.includes("function shareTargetFor"), "nothing auto-builds a listing message when a thread opens");
assert(deals.includes("markLiveOfferSuperseded") && !deals.includes('Fail("pending")'), "submitting another offer replaces the live one");
const reserveFn = deals.slice(deals.indexOf("async function acceptAndReserve"), deals.indexOf("export async function acceptDealOffer"));
const acceptFn = deals.slice(deals.indexOf("export async function acceptDealOffer"), deals.indexOf("export async function confirmDeal"));
const confirmFn = deals.slice(deals.indexOf("export async function confirmDeal"), deals.indexOf("export async function releaseReserve"));
assert(reserveFn.includes("softLock") && reserveFn.includes("confirmed: true") && reserveFn.includes('kind: "lock"'), "accepting holds the listing on the existing confirmed lock");
assert(acceptFn.includes("acceptAndReserve") && acceptFn.includes('if (offer.by === userId) throw new Fail("forbidden")') && acceptFn.includes("order.sellerId !== userId") && acceptFn.includes("order.buyerId !== userId"), "either party accepts the other's offer, and that accept is the hold");
assert(confirmFn.includes("acceptAndReserve") && confirmFn.includes("softLock") && confirmFn.includes("order.sellerId !== userId") && confirmFn.includes('kind: "lock"'), "the unused no-offer hold still uses the same lock");
assert(deals.includes("export async function confirmHandover") && deals.includes('kind: "handover"') && deals.includes('status: "COMPLETED"') && deals.includes('status: "SOLD"'), "the second confirm completes the order and marks the listing sold");

console.log("message-composer.test.ts ok");
