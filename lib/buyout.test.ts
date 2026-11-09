import { readFileSync } from "fs";
import { BUYOUT_PHOTO_MAX, buyoutHandoverLine, buyoutPriceBadge, parseBuyoutForm } from "./buyout";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const photo = "data:image/jpeg;base64,aaaa";

function draft(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("cardName", "青眼白龍");
  data.set("note", "近全新，收一張");
  data.set("price", "280");
  data.set("negotiable", "on");
  data.set("photos", JSON.stringify([{ url: photo }]));
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

const ok = parseBuyoutForm(draft());
assert(ok.ok && ok.value.priceCents === 28000 && ok.value.negotiable && ok.value.catalogCardId === null, "a typed card name with a pay price is a buyout");
assert(ok.ok && ok.value.photos.length === 1 && !ok.value.shipSfCod && !ok.value.shipMeetup, "handover can be skipped");

const linked = parseBuyoutForm(draft({ catalogCardId: "card_bewd" }));
assert(linked.ok && linked.value.catalogCardId === "card_bewd", "a catalog pick is kept for the name library");

const closed = parseBuyoutForm(draft({ negotiable: "" }));
assert(closed.ok && closed.value.negotiable === false, "an unchecked 可議價 box is off");

assert(!parseBuyoutForm(draft({ cardName: "卡" })).ok, "想收 needs 2 characters");
assert(!parseBuyoutForm(draft({ note: "  " })).ok, "說明 is required");
assert(!parseBuyoutForm(draft({ price: "" })).ok && !parseBuyoutForm(draft({ price: "0" })).ok, "出價 is a positive HKD amount");
assert(!parseBuyoutForm(draft({ photos: "[]" })).ok, "at least one photo");
assert(!parseBuyoutForm(draft({ photos: JSON.stringify(Array.from({ length: 4 }, () => ({ url: photo }))) })).ok, "at most 3 photos");
assert(parseBuyoutForm(draft({ photos: JSON.stringify([{ url: photo }, { url: photo + "b" }, { url: "https://cdn.example/a.jpg" }]) })).ok, "three photos is the cap");
assert(!parseBuyoutForm(draft({ photos: JSON.stringify([{ url: "http://cdn.example/a.jpg" }]) })).ok, "photo urls stay on the existing allow list");

const meet = parseBuyoutForm(draft({ shipMeetup: "on", meetupDistrict: "油尖旺" }));
assert(meet.ok && meet.value.meetupDistrict === "油尖旺" && meet.value.shipMeetup, "面交 keeps a Hong Kong district");
assert(!parseBuyoutForm(draft({ shipMeetup: "on", meetupDistrict: "" })).ok, "面交 without a district is rejected");
const cod = parseBuyoutForm(draft({ shipSfCod: "on" }));
assert(cod.ok && cod.value.shipSfCod && cod.value.meetupDistrict === null, "順豐到付 does not invent a district");

assert(buyoutPriceBadge(28000) === "HKD 280" && buyoutPriceBadge(28050) === "HKD 280.50", "the corner badge is small HKD text");
assert(buyoutHandoverLine({ shipSfCod: true, shipMeetup: true, meetupDistrict: "油尖旺" }, "zh-HK") === "順豐到付 · 面交 · 油尖旺", "handover is one line");
assert(buyoutHandoverLine({ shipSfCod: false, shipMeetup: false, meetupDistrict: null }, "zh-HK") === null, "skipped handover draws nothing");
assert(BUYOUT_PHOTO_MAX === 3, "the photo cap is 3");

const sheet = readFileSync(new URL("../components/buyout-sheet.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../actions/buyout.ts", import.meta.url), "utf8");
const flash = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const add = readFileSync(new URL("../app/add/page.tsx", import.meta.url), "utf8");
const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const pub = readFileSync(new URL("../app/u/[id]/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/buyout/[id]/page.tsx", import.meta.url), "utf8");
const banned = ["收購", "收卡", "預算", "貼子"];
for (const word of banned) {
  assert(!sheet.includes(word) && !board.includes(word) && !action.includes(word) && !detail.includes(word), `${word} is not buyout copy`);
}
assert(sheet.includes("LISTING_CROP_ASPECT") && sheet.includes("BUYOUT_PHOTO_MAX") && sheet.includes("CatalogTitleField") && sheet.includes('label={tx(locale, "想收"'), "想收 uses the catalog typeahead and the listing crop");
assert(sheet.includes("出價 HKD") && sheet.includes('name="negotiable"') && sheet.includes("defaultChecked") && sheet.includes("順豐到付") && sheet.includes("面交") && sheet.includes('tx(locale, "說明"'), "the sheet is price, negotiable on, note, and optional handover");
assert(sheet.includes('tx(locale, "發佈買取", "Post a buyout")') && !sheet.includes('href="/add"') && !sheet.includes("publishCreateAction") && !sheet.includes("saveListing"), "發佈買取 does not enter 上架");
assert(board.includes('id: "buyout"') && board.indexOf('id: "shelf"') < board.indexOf('id: "buyout"') && board.includes("暫無買取。") && board.includes("發佈買取") && board.includes("grid-cols-2") && board.includes("buyoutPriceBadge") && board.includes("可議價"), "買取 is the second tab: square covers, an HKD badge, and the negotiable mark");
assert(board.includes("isSelf ? (") && board.includes("暫無商品。") && board.includes("上架第一件"), "商品 stays; the publish control is the self branch");
assert(action.includes('redirect("/me?tab=buyout&ok=buyout")') && action.includes("negotiable: draft.negotiable") && !action.includes("saveListing") && !action.includes('"/add"'), "publish writes a buyout and flashes on /me");
assert(flash.includes('buyout: ["已發佈買取", "Buyout posted"]'), "the toast is 已發佈買取");
assert(me.includes("buyouts={board.buyouts}") && pub.includes("buyouts={board.buyouts}"), "/me and /u share the buyout list");
assert(!add.includes("買取") && !add.includes("publishBuyout"), "/add stays 上架");
assert(detail.includes("buyoutPriceBadge") && detail.includes("可議價") && !detail.includes("makeDealOfferAction"), "the detail page shows the flag and does not invent an offer flow");

console.log("buyout.test.ts ok");
