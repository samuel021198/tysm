import { readFileSync } from "fs";
import { CREATE_MODES, createDest, createIndexFromScroll } from "./create-modes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CREATE_MODES.map((mode) => mode.zh).join("|") === "動態|貼子|上架", "create mode order starts at stories");
assert(CREATE_MODES.map((mode) => mode.href).join("|") === "/story/new|/add?kind=post|/sell", "create mode routes");
assert(!CREATE_MODES.some((mode) => mode.zh.includes("收藏")), "collect-only is not a create mode");
assert(createDest("/sell", true) === "/sell", "logged-in dest stays on the flow");
assert(
  createDest("/add?kind=post", false) === `/login?next=${encodeURIComponent("/add?kind=post")}`,
  "logged-out post keeps the kind query",
);

assert(createIndexFromScroll(0, 390, 3) === 0, "origin");
assert(createIndexFromScroll(194, 390, 3) === 0, "before the halfway snap");
assert(createIndexFromScroll(195, 390, 3) === 1, "halfway snaps forward");
assert(createIndexFromScroll(780, 390, 3) === 2, "last page");
assert(createIndexFromScroll(4000, 390, 3) === 2, "clamped");
assert(createIndexFromScroll(-40, 390, 3) === 0, "negative");
assert(createIndexFromScroll(80, 0, 3) === 0, "zero width");

const tab = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const home = tab.indexOf('href: "/"');
const dex = tab.indexOf('href: "/dex"');
const market = tab.indexOf('href: "/market"');
const chat = tab.indexOf('href: "/messages"');
assert(home >= 0 && home < dex && dex < market && market < chat, "tab order Home, Dex, Market, Chat");
assert(tab.includes("圖鑑") && tab.includes("賣場") && tab.includes('icon: "bag"'), "dex stays, market uses the bag");
assert(!tab.includes("AddSheet") && !tab.includes("新增") && !tab.includes("add-sheet"), "center add sheet is gone");

const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const corner = shell.indexOf('variant="corner"');
const logo = shell.indexOf('alt="TYSM"');
assert(corner >= 0 && logo >= 0 && corner < logo, "mobile add control sits at the top left of the header");
assert(shell.includes('variant="header"'), "desktop header still opens create");
assert(!shell.includes("add-sheet"), "shell no longer uses the bottom sheet");

const picker = readFileSync(new URL("../components/create-picker.tsx", import.meta.url), "utf8");
assert(picker.includes("CREATE_MODES") && picker.includes("snap-x") && picker.includes("snap-mandatory"), "picker swipes the shared modes");
assert(picker.includes("fixed") && picker.includes("md:hidden") && picker.includes('name="plus"'), "top-left control is a plus icon");
assert(!picker.includes('tx(locale, "加"') && !picker.includes("加入收藏") && !picker.includes("我的收藏"), "加 text and collect-only are gone from the picker");
assert(!picker.includes("想做咩") && !picker.includes("rounded-t-"), "bottom sheet copy is retired");
assert(picker.includes("CREATE_MODES.length"), "the tab row follows the mode count");

const collect = readFileSync(new URL("../components/collect-form.tsx", import.meta.url), "utf8");
assert(collect.includes("同時上架"), "the post composer can list at the same time");
assert(!collect.includes('href="/add"'), "the composer does not link to collect-only");

const sell = readFileSync(new URL("../app/sell/page.tsx", import.meta.url), "utf8");
assert(!/href="\/add"(?!\?)/.test(sell), "sell page does not send people to collect-only");

const story = readFileSync(new URL("../components/story-composer.tsx", import.meta.url), "utf8");
assert(story.includes("getUserMedia") && story.includes('capture="environment"') && story.includes("STORY_EMOJIS"), "stories open on the camera and can switch to the system camera or stickers");
assert(story.includes("fixed inset-0"), "the story camera is full screen");

const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
assert(tab.includes('loggedIn ? "/me" : "/login"'), "profile tab stays on the public profile");
assert(me.includes('href="/me/settings"') && me.includes("<ProfileBoard") && !me.includes("updateProfile") && !me.includes("PrefToggles") && !me.includes("logout"), "/me is header plus board");
assert(!board.includes('"/orders"') && !board.includes("/me#store") && !board.includes("menu-row"), "owner shortcut rows stay off the profile board");
assert(settings.includes("updateProfile") && settings.includes("saveAddress") && settings.includes("deleteAddress") && settings.includes("clearHistory") && settings.includes("logout") && settings.includes('"/orders"') && settings.includes("/me?tab=drafts") && settings.includes('id="store"') && settings.includes("PrefToggles"), "settings holds the account tools");
assert(auth.includes('const settings = "/me/settings"') && auth.includes("${settings}?ok=saved") && auth.includes("${settings}?err=nickname") && auth.includes("${settings}?err=address"), "profile saves flash back on settings");

console.log("create modes ok");
