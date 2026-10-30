import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canSpend, grantIfUnset, hkDay, planPromo, PROMO_GRANT, promoFields, promoTipParts, promoToastKind, publishFlash } from "./promo";

const today = "2026-10-30";

assert(grantIfUnset(null) === PROMO_GRANT, "an unset balance is granted once");
assert(grantIfUnset(0) === null && grantIfUnset(7) === null, "zero and a set balance are not granted again");
assert(canSpend(null) === false && canSpend(0) === false && canSpend(1) === true, "a spend needs at least one token");

assert(planPromo({ want: false, live: true, promoDay: today, today }) === "off", "turning it off stops the pill");
assert(planPromo({ want: true, live: false, promoDay: null, today }) === "arm", "a draft remembers promo and does not charge yet");
assert(planPromo({ want: true, live: true, promoDay: today, today }) === "keep", "the same Hong Kong day is not charged twice");
assert(planPromo({ want: true, live: true, promoDay: "2026-10-29", today }) === "charge", "the next day charges one token");
assert(planPromo({ want: true, live: true, promoDay: null, today }) === "charge", "the first live day charges");
assert(promoFields("off", today, today).promoted === false && promoFields("off", today, today).promoDay === today, "off keeps today's stamp so turning it back on is free");
assert(promoFields("charge", null, today).promoDay === today && promoFields("arm", null, today).promoDay === null, "only a charge stamps the day");

const beforeMidnight = hkDay(new Date("2026-10-30T15:30:00.000Z"));
const afterMidnight = hkDay(new Date("2026-10-30T16:30:00.000Z"));
assert(beforeMidnight === "2026-10-30" && afterMidnight === "2026-10-31", "the charge day follows Hong Kong midnight");
assert(promoToastKind("earn") === "earn" && promoToastKind("spend") === "spend" && promoToastKind("buy") === null && promoToastKind("live") === null, "only earn and spend are stored tips");
const liveTip = promoTipParts("live");
const spendTip = promoTipParts("spend");
assert(`${liveTip.lead}${liveTip.pop}${liveTip.tail}` === "已刊登 · 推廣 −1 飛", "a publish that charges shows one merged line");
assert(promoTipParts("earn").lead === "＋7 飛" && `${spendTip.lead}${spendTip.pop}${spendTip.tail}` === "推廣 −1 飛", "earn and a later deduct keep their own lines");
assert(publishFlash("published", true) === "live" && publishFlash("published", false) === "published" && publishFlash("draft", true) === "draft", "only a charged publish replaces the success copy");

const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
const pill = readFileSync(new URL("../components/promo-pill.tsx", import.meta.url), "utf8");
const toast = readFileSync(new URL("../components/promo-toast.tsx", import.meta.url), "utf8");
const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/profile-header.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/listing-card.tsx", import.meta.url), "utf8");
const shop = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
const feed = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const trade = readFileSync(new URL("../actions/trade.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const copy = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
assert(sell.includes("消耗 1 飛／日 · 示範期已送 7") && sell.includes("飛不足") && sell.includes('href="/me#promo"'), "the price step explains the daily cost and links a short balance to /me");
assert(!sell.includes("token") && !sell.includes("購買") && !sell.includes("buy-pack") && !header.includes("Token"), "the sell step and profile do not say token or sell a pack");
assert(pill.includes("推廣") && pill.includes("h-5") && pill.includes("text-[10px]") && pill.includes("bg-accent/15") && pill.includes("text-ink"), "the pill is a small accent beside the price");
assert(card.includes("<PromoPill") && shop.includes("<PromoPill") && feed.includes("<PromoPill"), "listing cards, the shop grid, and feed cards share the pill");
assert(toast.includes("promoTipParts") && toast.includes("setOpen(true)") && toast.includes("2000") && toast.includes("bottom-[calc(var(--tab-h)+0.75rem)]") && toast.includes('name="ticket"') && toast.includes("promo-pop") && !toast.includes("dialog") && !toast.includes("token"), "tips sit above the tab bar, reopen, and dismiss themselves");
assert(shell.includes('if (ok === "live") return <PromoToast kind="live"') && shell.includes('published: ["已刊登，現已公開"'), "a charged publish uses the merged tip; other publishes keep the old line");
assert(trade.includes("publishFlash(ok, result.charged)") && trade.includes('promoToast: "spend"') && trade.includes("promoToast: null") && trade.includes("?ok=${flash}"), "the publish redirect drops the separate spend tip when the lines merge");
assert(me.includes("tokenBalance") && header.includes('name="ticket"') && header.includes("promo-bounce") && header.includes("h-[22px] w-[22px]") && header.includes("＝可推廣 ${tokenBalance} 日") && settings.includes("/me#promo") && settings.includes('"飛"'), "the profile shows the balance with a ticket icon and settings links to it");
assert(css.includes("promo-bounce") && css.includes("400ms") && css.includes("promo-pop"), "the icon bounces once and the deduct number pops once");
assert(copy.includes('tokens: ["飛不足"') && !copy.includes("token ") && !copy.includes("Token"), "the short-balance error does not say token");

console.log("promo.test.ts ok");
