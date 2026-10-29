import { readFileSync } from "fs";
import { verificationPill } from "../components/profile-header";
import {
  BIO_MAX,
  INTEREST_TAG_MAX,
  bioSegments,
  cleanHandoverPlace,
  cleanProfileLink,
  looksLikeStreetAddress,
  normalizeUsername,
  parseInterestTags,
  parseProfileLinks,
  usernameChangesRemaining,
  USERNAME_CHANGE_LIMIT,
  USERNAME_CHANGE_WINDOW_MS,
} from "./profile-edit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(normalizeUsername("@Mars_01") === "mars_01", "handles are stored lowercase without @");
assert(normalizeUsername("ab") === null && normalizeUsername("1mars") === null && normalizeUsername("mars-card") === null, "too short, leading digit, and hyphen are refused");
assert(normalizeUsername("a".repeat(21)) === null && normalizeUsername("abc") === "abc", "3 to 20 characters");

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 29);
assert(usernameChangesRemaining([], now) === USERNAME_CHANGE_LIMIT, "a first handle still has two changes");
assert(usernameChangesRemaining([now - day, now - 2 * day], now) === 0, "two changes inside 30 days block the next one");
assert(usernameChangesRemaining([now - USERNAME_CHANGE_WINDOW_MS], now) === 2, "a change exactly 30 days old is free");
assert(usernameChangesRemaining([now - USERNAME_CHANGE_WINDOW_MS + 1], now) === 1, "one millisecond inside the window still counts");
assert(usernameChangesRemaining([now + day], now) === 2, "a future stamp is ignored");

const tags = parseInterestTags("#寶可夢, pc  TCG");
assert(tags.ok && tags.tags.join() === "寶可夢,PC,TCG", "interest tags are a dedicated field and reuse topic aliases");
const eight = parseInterestTags("a b c d e f g h");
assert(eight.ok && eight.tags.length === INTEREST_TAG_MAX, "eight tags fit");
assert(!parseInterestTags("a b c d e f g h i").ok, "a ninth tag is refused");
assert(!parseInterestTags("ok bad-tag").ok, "a broken token is refused instead of dropped");
const dupes = parseInterestTags("pc PC");
assert(dupes.ok && dupes.tags.length === 1, "duplicate tags collapse");
const cleared = parseInterestTags("");
assert(cleared.ok && cleared.tags.length === 0, "an empty interest field clears the chips");

assert(looksLikeStreetAddress("西洋菜南街 1 號") && looksLikeStreetAddress("Flat 2 Nathan Road") && looksLikeStreetAddress("旺角道 10"), "street and door numbers are addresses");
assert(!looksLikeStreetAddress("油尖旺") && !looksLikeStreetAddress("朗豪坊") && !looksLikeStreetAddress("K11 Musea"), "a district or mall name is not a street");
const mallPlace = cleanHandoverPlace("  朗豪坊 ");
const blankPlace = cleanHandoverPlace("");
assert(mallPlace.ok && mallPlace.place === "朗豪坊", "handover place keeps the mall");
assert(!cleanHandoverPlace("西洋菜南街 1 號").ok && blankPlace.ok && blankPlace.place === null, "a door number is refused and blank clears the place");

const mall = cleanProfileLink("朗豪坊");
assert(mall?.startsWith("https://www.google.com/maps/search/") && mall.includes(encodeURIComponent("朗豪坊 Hong Kong")), "a place link opens Maps");
assert(cleanProfileLink("https://example.com/shop") === "https://example.com/shop", "an https link is kept");
assert(cleanProfileLink("http://example.com") === null && cleanProfileLink("javascript:alert(1)") === null, "http and script links are dropped");
assert(cleanProfileLink("https://www.google.com/maps/search/?api=1&query=1%E8%99%9F") === null, "a Maps link that embeds a door number is refused");
assert(!parseProfileLinks(["https://a.example", "https://b.example", "https://c.example", "https://d.example"]).ok, "a fourth link is refused");
const mixed = parseProfileLinks(["https://a.example", "", "海港城"]);
assert(mixed.ok && mixed.links.length === 2 && mixed.links[1].includes("maps"), "blank link slots are skipped");

const bio = bioSegments("睇 https://example.com/a. 同 #寶可夢");
assert(bio.some((part) => part.type === "link" && part.href === "https://example.com/a"), "https in the bio becomes a link");
assert(bio.some((part) => part.type === "text" && part.value.includes("#寶可夢")), "a hash in the bio stays text");
assert(bio.some((part) => part.type === "text" && part.value.startsWith(".")), "the trailing period stays outside the link");
assert(BIO_MAX === 400, "bio ceiling is 400");

const header = readFileSync(new URL("../components/profile-header.tsx", import.meta.url), "utf8");
const edit = readFileSync(new URL("../app/me/edit/page.tsx", import.meta.url), "utf8");
const editForm = readFileSync(new URL("../components/profile-edit-form.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
const footprint = readFileSync(new URL("../app/me/footprint/page.tsx", import.meta.url), "utf8");
assert(header.includes("則貼文") && header.includes("商品") && header.includes("粉絲") && header.includes("/followers"), "stats are posts, listings, and followers");
assert(header.includes('href="/me/edit"') && header.includes('href="/me/footprint"') && header.includes('href="/me/settings"'), "self profile has edit, footprint, and settings");
assert(header.includes('tx(locale, "編輯", "Edit")') && header.includes('tx(locale, "足跡", "Footprint")') && header.includes("⚙️") && header.includes('aria-label={tx(locale, "設定", "Settings")}'), "actions are a thin row: short labels and a gear");
assert(header.includes("h-8") && !header.includes("btn-ghost") && !header.includes("編輯個人檔案") && !header.includes("我的足跡"), "profile actions are not the old text bricks");
assert(!header.includes("普通"), "the default tier draws no badge");
assert(verificationPill("NORMAL") === null, "normal tier has no pill");
const trusted = verificationPill("TRUSTED");
const merchant = verificationPill("MERCHANT");
assert(trusted?.label === "誠信用戶" && [...trusted.label].length === 4 && trusted.className.includes("#E8F5E9") && trusted.className.includes("#1B5E20"), "trusted is a light-green four-character pill");
assert(merchant?.label === "專業商戶" && [...merchant.label].length === 4 && merchant.className.includes("#FFF3E0") && merchant.className.includes("#E65100"), "merchant is a light-gold four-character pill");
const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const shop = readFileSync(new URL("../app/shop/[id]/page.tsx", import.meta.url), "utf8");
assert(me.includes("verificationTier={viewer.verificationTier}") && shop.includes("verificationTier={seller.verificationTier}"), "own profile and public shop pass the stored tier");
assert(!editForm.includes("verificationTier") && !editForm.includes("誠信用戶") && !edit.includes("HKID"), "profile edit does not collect verification");
assert(header.includes("TopicChips") && header.includes("mapsSearchUrl") && header.includes("bio"), "tags, handover place, and bio sit on the header");
assert(editForm.includes("name=\"nickname\"") && editForm.includes("name=\"username\"") && editForm.includes("name=\"bio\"") && editForm.includes("name=\"link\"") && editForm.includes("name=\"handoverPlace\"") && editForm.includes("name=\"interestTags\""), "edit profile is a field form");
assert(edit.includes("BIO_MAX") && edit.includes("usernameChangesRemaining"), "the form shows the bio ceiling and the handle allowance");
assert(!settings.includes("/me/edit") && !settings.includes("/me/footprint") && !settings.includes('"/orders"') && !settings.includes("saveAddress") && !settings.includes("/me/favorites"), "settings does not hold edit, footprint, orders, addresses, or favorites");
assert(settings.includes("/me/settings/notifications") && settings.includes("/me/settings/account") && settings.includes("/me/settings/privacy") && settings.includes("/me/settings/language") && settings.includes("/me/settings/theme") && settings.includes("/me/settings/about") && settings.includes("/me/settings/delete"), "settings lists the locked rows");
assert(settings.indexOf("刪除帳號") > settings.indexOf("關於") && settings.lastIndexOf("刪除帳號") > settings.lastIndexOf("/me/settings/about"), "delete account is last");
assert(footprint.includes("交易中") && footprint.includes("已出售") && footprint.includes("已購買") && footprint.includes("要約中") && footprint.includes("待交收") && footprint.includes("待完成") && footprint.includes("已結束"), "footprint tabs and the ended fold");
assert(
  footprint.includes("未有進行中交易") &&
    footprint.includes("去逛逛") &&
    footprint.includes('href="/find"') &&
    footprint.split("未有紀錄。").length === 3 &&
    !footprint.includes("去訊息") &&
    !footprint.includes("議價"),
  "empty 交易中 offers browse; sold and bought say 未有紀錄 with no CTA",
);
const notes = readFileSync(new URL("../app/notifications/page.tsx", import.meta.url), "utf8");
assert(notes.includes("暫時未有通知") && !notes.includes("未有通知。") && !notes.includes("去逛逛"), "the bell inbox empty line has no CTA");

console.log("profile-edit.test.ts ok");
