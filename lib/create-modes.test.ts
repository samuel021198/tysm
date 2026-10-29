import { readFileSync } from "fs";
import { CREATE_MODES, createDefaultIndex, createDest } from "./create-modes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CREATE_MODES.map((mode) => mode.zh).join("|") === "貼文|上架", "create modes are post and sell");
assert(CREATE_MODES.map((mode) => mode.href).join("|") === "/add?kind=post|/sell", "create mode routes");
assert(!CREATE_MODES.map((mode) => `${mode.id} ${mode.href} ${mode.zh}`).join("|").includes("story") && !CREATE_MODES.map((mode) => mode.zh).join("|").includes("動態"), "story create stays off the picker");
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
const postTab = tab.indexOf('href: "/"');
const shopTab = tab.indexOf('href: "/shop"');
const search = tab.indexOf('href: "/find"');
const news = tab.indexOf('href: "/news"');
const profile = tab.indexOf('icon: "me"');
assert(postTab >= 0 && postTab < shopTab && shopTab < search && search < news && news < profile, "tab order Post, Shop, Search, News, Profile");
assert(tab.includes("grid-cols-5") && !tab.includes("grid-cols-4"), "five bottom tabs");
assert(tab.includes("貼文") && tab.includes("商店") && tab.includes("搜尋") && tab.includes("新聞") && !tab.includes("圖鑑") && !tab.includes('href: "/dex"'), "bottom tabs are post, shop, search, news, profile");
assert(tab.includes('icon: "note"') && tab.includes('icon: "bag"') && tab.includes('icon: "search"') && tab.includes('icon: "news"') && !tab.includes("排行") && !tab.includes('href: "/rank"') && !tab.includes("賣場") && !tab.includes('href: "/market"'), "search is the glass, shop is the bag, rank is not a bottom tab");
assert(!tab.includes("accent: true") && !tab.includes("rounded-full bg-accent") && !tab.includes("bg-accent text-white"), "bottom icons are plain strokes, no green circle");
assert(tab.includes("h-[22px]") && tab.includes("strokeWidth={on ? 2 : 1.6}"), "bottom icons stay 22px");
assert(!tab.includes('href: "/messages"'), "chat is not a tab");
const shopPage = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
assert(
  shopPage.includes("全部") && shopPage.includes("新上架") && shopPage.includes("拍賣") && shopPage.includes("商店") && shopPage.includes("/shop/${store.id}"),
  "the shop tab is the mall: chips and store cards",
);
assert(!tab.includes("<span>{label}</span>") && tab.includes("aria-label={label}"), "tabs are icons only");
assert(!tab.includes("AddSheet") && !tab.includes("新增") && !tab.includes("add-sheet"), "center add sheet is gone");

const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const top = readFileSync(new URL("../components/top-bar.tsx", import.meta.url), "utf8");
assert(shell.includes("<TopBar") && !shell.includes('variant="corner"') && !shell.includes("absolute inset-y-0 right-1"), "mobile header is the top bar; the corner add is gone");
assert(top.includes("md:hidden") && top.includes("grid-cols-5") && top.includes("h-[3.25rem]") && top.includes("max-w-lg"), "top bar matches the bottom 5-column grid and height");
const homeSlot = top.indexOf('href="/"');
const rankSlot = top.indexOf('href="/rank"');
const createSlot = top.indexOf('variant="top"');
const notesSlot = top.indexOf('href="/notifications"');
const inboxSlot = top.indexOf('href="/messages"');
assert(homeSlot >= 0 && homeSlot < rankSlot && rankSlot < createSlot && createSlot < notesSlot && notesSlot < inboxSlot, "top order is logo, rank, create, notifications, messages");
assert(top.includes("tsm-monogram.png") && top.includes("主頁") && !top.includes("tysm-wordmark"), "home slot is the monogram");
assert(top.includes("排行榜") && top.includes('icon="rank"') && top.includes("h-[22px]") && !top.includes("拍賣") && !top.includes('href="/find"') && !top.includes('icon="tag"'), "second slot is rankings at 22px");
assert(!top.includes("rounded-full bg-accent text-white") && !top.includes("bg-accent text-white"), "top bar has no green circle");
assert(top.includes("通知") && top.includes("訊息") && top.includes("aria-label") && !top.includes("<span>{label}</span>"), "top items are icon-only with Chinese names");
assert(top.includes("strokeWidth={on ? 2 : 1.6}"), "top strokes match the bottom bar");
assert(shell.includes('src="/brand/tsm-monogram.png"'), "desktop header keeps the TSM monogram");
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
  desktop.includes('href="/shop"') && desktop.includes("<SearchBox") && desktop.includes('href="/news"') && desktop.includes('href="/rank"') && !desktop.includes('href="/find"') && !desktop.includes('href="/market"') && !desktop.includes('href="/dex"') && desktop.includes("whitespace-nowrap") && desktop.includes("shrink-0"),
  "desktop shop, news, and rank labels stay on one line; search is the field",
);
assert(!shell.includes("h-14 max-w-6xl"), "desktop tools are not a second full-width bar");
assert(shell.includes('href="/cart"') && shell.includes('href="/orders"') && shell.includes('href="/messages"'), "compact menu keeps cart, orders, and chat");
assert(shell.includes("bg-accent/15"), "notification and cart counts use a small pill");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!css.includes("6.5rem") && css.includes("3.5rem"), "desktop header height is a single row");
assert(css.includes("--header-h: calc(3.25rem + env(safe-area-inset-top))"), "mobile header matches the tab bar height");

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
assert(picker.includes('name="plus"') && picker.includes("h-[22px] w-[22px]") && picker.includes("creating ? 2 : 1.6"), "mobile add is a 22px stroke plus");
assert(!picker.includes("h-10 w-10") && !picker.includes("rounded-full bg-accent text-white") && !picker.includes("bg-accent text-white") && picker.includes('variant === "top"') && !picker.includes("absolute left-1") && !picker.includes('variant === "corner"'), "mobile add is a plain stroke; the green circle and corner FAB are gone");
assert(picker.includes("text-muted"), "picker rows stay muted");
assert(!picker.includes("bg-accent text-white shadow-none md:hidden"), "mobile add is a circle, not the old header pill");
assert(picker.includes("bg-accent/10") && picker.includes("ring-accent/15"), "desktop add is a quiet accent control");
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
assert(me.includes("<ProfileHeader") && me.includes("self") && me.includes("<ProfileBoard") && !me.includes("updateProfile") && !me.includes("PrefToggles") && !me.includes("logout"), "/me is header plus board");
assert(!board.includes('"/orders"') && !board.includes("/me#store") && !board.includes("menu-row"), "owner shortcut rows stay off the profile board");
assert(board.includes("grid-cols-4") && board.includes("grid-cols-3") && board.includes("bg-ink"), "profile tabs are equal icon columns over a thumbnail grid");
assert(board.includes("My Binder") && board.includes("收藏") && board.includes("商店") && board.includes("評價"), "profile tab names");
assert(board.includes('id: "posts"') && board.includes('id: "saved"'), "My Binder is own posts; 收藏 is the wishlist tab");
assert(!board.includes("我的卡") && !board.includes('id: "box"') && !board.includes("CollectionMenu") && !board.includes("collectionItemId"), "the owned-card grid is off the profile");
const ownEmptyTitle = board.indexOf('tx(locale, "未有貼文", "No posts yet")');
const ownEmptyLink = board.indexOf("發佈第一則");
assert(
  ownEmptyTitle !== -1 &&
    ownEmptyLink > ownEmptyTitle &&
    board.includes('href="/add?kind=post"') &&
    board.includes('className="block font-semibold text-ink underline underline-offset-2"') &&
    !board.includes("未有卡片") &&
    !board.includes("開始放第一張"),
  "own My Binder empty says 未有貼文, then 發佈第一則 opens the post composer",
);
assert(board.includes('icon: "binder"') && board.includes('icon: "bookmark"') && board.includes('icon: "bag"') && board.includes('icon: "star"'), "profile tabs use icons");
assert(!board.includes("chips") && !board.includes("rounded-full") && !board.includes("<PostCard") && !board.includes("<ListingCard"), "profile tabs are not pills and image tabs are thumbnails");
assert(!settings.includes("updateProfile") && !settings.includes("saveAddress") && !settings.includes('"/orders"') && !settings.includes("/me?tab=drafts") && !settings.includes('id="store"') && !settings.includes("/me/edit") && !settings.includes("/me/footprint"), "settings is a list, not the old account form");
assert(auth.includes('const editPath = "/me/edit"') && auth.includes("${editPath}?ok=saved") && auth.includes("${editPath}?err=nickname") && auth.includes("saveShop") && auth.includes('id="store"') === false, "profile saves flash on the edit page");
const account = readFileSync(new URL("../app/me/settings/[section]/page.tsx", import.meta.url), "utf8");
assert(account.includes('id="store"') && account.includes("logout") && account.includes("clearHistory") && account.includes("saveNotifications"), "account tools moved under the settings rows");

console.log("create modes ok");
