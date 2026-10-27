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
const search = tab.indexOf('href: "/find"');
const market = tab.indexOf('href: "/market"');
const profile = tab.indexOf('icon: "me"');
assert(home >= 0 && home < dex && dex < search && search < market && market < profile, "tab order Home, Dex, Search, Market, Profile");
assert(tab.includes("圖鑑") && tab.includes("賣場") && tab.includes("搜尋") && tab.includes('icon: "search"') && tab.includes('icon: "bag"'), "dex stays, search is the glass, market uses the bag");
assert(!tab.includes('href: "/messages"'), "chat is not a tab");
assert(!tab.includes("<span>{label}</span>") && tab.includes("aria-label={label}"), "tabs are icons only");
assert(!tab.includes("AddSheet") && !tab.includes("新增") && !tab.includes("add-sheet"), "center add sheet is gone");

const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const corner = shell.indexOf('variant="corner"');
const logo = shell.indexOf('alt="TSM"');
assert(corner >= 0 && logo >= 0 && corner < logo, "mobile add control sits at the top left of the header");
assert(shell.includes('src="/brand/tsm-monogram.png"'), "header uses the TSM monogram");
assert(shell.includes("flex h-12 max-w-6xl items-center justify-center"), "brand mark is centered in the header");
assert(shell.includes("md:hidden"), "the centered mark row is the mobile header");
assert(!shell.includes("tysm-wordmark"), "old wordmark is not referenced");
assert(shell.includes('variant="header"'), "desktop header still opens create");
assert(!shell.includes("add-sheet"), "shell no longer uses the bottom sheet");
const desktopAt = shell.indexOf("hidden h-14");
const desktop = desktopAt >= 0 ? shell.slice(desktopAt) : "";
assert(
  desktop.includes("max-w-lg") && desktop.indexOf("<SearchBox") < desktop.indexOf("tsm-monogram") && desktop.indexOf("tsm-monogram") < desktop.indexOf('variant="header"'),
  "desktop header is one row: search, mark, nav, on the feed width",
);
assert(!shell.includes("h-14 max-w-6xl"), "desktop tools are not a second full-width bar");
assert(shell.includes('href="/cart"') && shell.includes('href="/orders"') && shell.includes('href="/messages"'), "compact menu keeps cart, orders, and chat");
assert(shell.includes("bg-accent/15"), "notification and cart counts use a small pill");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!css.includes("6.5rem") && css.includes("3.5rem"), "desktop header height is a single row");

const picker = readFileSync(new URL("../components/create-picker.tsx", import.meta.url), "utf8");
assert(picker.includes("CREATE_MODES") && picker.includes("snap-x") && picker.includes("snap-mandatory"), "picker swipes the shared modes");
assert(picker.includes("md:hidden") && picker.includes('name="plus"'), "top-left control is a plus icon");
assert(picker.includes("absolute left-1") && picker.includes("h-10 w-10") && picker.includes("text-muted"), "mobile add matches header icon buttons");
assert(!picker.includes("bg-accent text-white shadow-none md:hidden"), "mobile add is not a filled accent pill");
assert(picker.includes("bg-accent/10") && picker.includes("ring-accent/15"), "desktop add is a quiet accent control");
assert(!picker.includes("rounded-full bg-accent text-white"), "add is not a solid brand circle");
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
assert(board.includes("grid-cols-4") && board.includes("grid-cols-3") && board.includes("bg-ink"), "profile tabs are equal icon columns over a thumbnail grid");
assert(board.includes("貼文") && board.includes("My Binder") && board.includes("我的卡") && board.includes("商店") && board.includes("評價"), "profile tab names");
assert(!board.includes("收藏"), "the binder tab is not labeled 收藏");
assert(board.includes('icon: "grid"') && board.includes('icon: "binder"') && board.includes('icon: "bag"') && board.includes('icon: "star"'), "profile tabs use icons");
assert(!board.includes("chips") && !board.includes("rounded-full") && !board.includes("<PostCard") && !board.includes("<ListingCard"), "profile tabs are not pills and image tabs are thumbnails");
assert(settings.includes("updateProfile") && settings.includes("saveAddress") && settings.includes("deleteAddress") && settings.includes("clearHistory") && settings.includes("logout") && settings.includes('"/orders"') && settings.includes("/me?tab=drafts") && settings.includes('id="store"') && settings.includes("PrefToggles"), "settings holds the account tools");
assert(auth.includes('const settings = "/me/settings"') && auth.includes("${settings}?ok=saved") && auth.includes("${settings}?err=nickname") && auth.includes("${settings}?err=address"), "profile saves flash back on settings");

console.log("create modes ok");
