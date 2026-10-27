import { readFileSync } from "fs";
import { CREATE_MODES, createDefaultIndex, createDest } from "./create-modes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CREATE_MODES.map((mode) => mode.zh).join("|") === "動態|貼文|上架", "create modes are story, post, sell");
assert(CREATE_MODES.map((mode) => mode.href).join("|") === "/story/new|/add?kind=post|/sell", "create mode routes");
assert(!CREATE_MODES.some((mode) => mode.zh.includes("收藏")), "collect-only is not a create mode");
assert(!CREATE_MODES.some((mode) => `${mode.zh}${mode.en}${mode.hintZh}${mode.hintEn}`.includes("貼子")), "post copy says 貼文, not 貼子");
assert(!CREATE_MODES.some((mode) => "ctaZh" in mode || "ctaEn" in mode), "modes do not carry a second cta label");
const post = CREATE_MODES.find((mode) => mode.id === "post");
assert(post?.zh === "貼文" && post.en === "Post" && post.hintZh === "寫一則貼文，可以同時上架", "post label and single hint");
assert(createDefaultIndex() === CREATE_MODES.findIndex((mode) => mode.id === "post"), "default index is post");
assert(CREATE_MODES[createDefaultIndex()]?.id === "post", "opening the picker lands on post");
assert(createDest("/sell", true) === "/sell", "logged-in dest stays on the flow");
assert(
  createDest("/add?kind=post", false) === `/login?next=${encodeURIComponent("/add?kind=post")}`,
  "logged-out post keeps the kind query",
);

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
assert(
  desktop.includes('href="/market"') && desktop.includes('href="/dex"') && desktop.includes("whitespace-nowrap") && desktop.includes("shrink-0"),
  "desktop market and dex labels stay on one line",
);
assert(!shell.includes("h-14 max-w-6xl"), "desktop tools are not a second full-width bar");
assert(shell.includes('href="/cart"') && shell.includes('href="/orders"') && shell.includes('href="/messages"'), "compact menu keeps cart, orders, and chat");
assert(shell.includes("bg-accent/15"), "notification and cart counts use a small pill");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!css.includes("6.5rem") && css.includes("3.5rem"), "desktop header height is a single row");

const picker = readFileSync(new URL("../components/create-picker.tsx", import.meta.url), "utf8");
assert(picker.includes("CREATE_MODES.map") && picker.includes("createDest") && picker.includes('role="menu"'), "each mode is one row in a menu");
assert(!picker.includes('role="tab"') && !picker.includes('role="tabpanel"') && !picker.includes("btn-primary") && !picker.includes("ctaZh"), "segment, preview card, and extra cta are not stacked");
assert(picker.includes("createDefaultIndex") && picker.includes("data-mode") && picker.includes("preventScroll: true"), "opening the menu focuses the default mode without scrolling");
assert(!picker.includes("createPortal") && !picker.includes("fixed inset-0"), "picker is a card on the header, not a full-screen sheet");
assert(!picker.includes("snap-x") && !picker.includes("snap-mandatory") && !picker.includes("createIndexFromScroll"), "swipe scroller is gone");
assert(!picker.includes("左右滑動揀") && !picker.includes("Swipe to choose"), "swipe hint is gone");
assert(!picker.includes(" / {CREATE_MODES.length}") && !picker.includes("‹") && !picker.includes("›"), "page counter and desktop arrows are gone");
assert(picker.includes("bg-card") && picker.includes("border-line") && picker.includes("text-ink") && picker.includes("shadow-card"), "picker is a light card");
assert(!picker.includes("bg-[#1E293B]") && !picker.includes('backgroundColor: "#0F172A"') && !picker.includes("h-16 w-16"), "dark sheet and oversized icon tile are gone");
assert(picker.includes("md:hidden") && picker.includes('name="plus"'), "top-left control is a plus icon");
assert(picker.includes("absolute left-1") && picker.includes("h-10 w-10") && picker.includes("text-muted"), "mobile add matches header icon buttons");
assert(!picker.includes("bg-accent text-white shadow-none md:hidden"), "mobile add is not a filled accent pill");
assert(picker.includes("bg-accent/10") && picker.includes("ring-accent/15"), "desktop add is a quiet accent control");
assert(!picker.includes("rounded-full bg-accent text-white"), "add is not a solid brand circle");
assert(!picker.includes('tx(locale, "加"') && !picker.includes("加入收藏") && !picker.includes("我的收藏"), "加 text and collect-only are gone from the picker");
assert(!picker.includes("想做咩") && !picker.includes("rounded-t-"), "bottom sheet copy is retired");
assert(picker.includes("links.length"), "arrow keys stay inside the mode list");

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
assert(board.includes("My Binder") && board.includes("收藏") && board.includes("商店") && board.includes("評價"), "profile tab names");
assert(board.includes('id: "posts"') && board.includes('id: "saved"'), "My Binder is own posts; 收藏 is the wishlist tab");
assert(!board.includes("我的卡") && !board.includes('id: "box"') && !board.includes("CollectionMenu") && !board.includes("collectionItemId"), "the owned-card grid is off the profile");
const ownEmptyTitle = board.indexOf('tx(locale, "未有卡片。", "No cards yet.")');
const ownEmptyLink = board.indexOf("開始放第一張");
assert(
  ownEmptyTitle !== -1 &&
    ownEmptyLink > ownEmptyTitle &&
    board.includes('className="block font-semibold text-ink underline underline-offset-2"') &&
    board.includes('tx(locale, "未有卡片", "No cards yet")') &&
    !board.includes("未有貼文"),
  "own My Binder empty title ends with a stop, then the add link on the next line",
);
assert(board.includes('icon: "binder"') && board.includes('icon: "bookmark"') && board.includes('icon: "bag"') && board.includes('icon: "star"'), "profile tabs use icons");
assert(!board.includes("chips") && !board.includes("rounded-full") && !board.includes("<PostCard") && !board.includes("<ListingCard"), "profile tabs are not pills and image tabs are thumbnails");
assert(settings.includes("updateProfile") && settings.includes("saveAddress") && settings.includes("deleteAddress") && settings.includes("clearHistory") && settings.includes("logout") && settings.includes('"/orders"') && settings.includes("/me?tab=drafts") && settings.includes('id="store"') && settings.includes("PrefToggles"), "settings holds the account tools");
assert(auth.includes('const settings = "/me/settings"') && auth.includes("${settings}?ok=saved") && auth.includes("${settings}?err=nickname") && auth.includes("${settings}?err=address"), "profile saves flash back on settings");

console.log("create modes ok");
