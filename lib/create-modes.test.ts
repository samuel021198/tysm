import { readFileSync } from "fs";
import { CREATE_HREF, CREATE_TOAST_EN, CREATE_TOAST_ZH, createDest, createTitle } from "./create-modes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CREATE_HREF === "/add", "create is the 上架 route");
assert(createTitle("  近全新\n旺角面交") === "近全新", "the listing title is the caption's first line");
assert(createTitle("x".repeat(90)).length === 80, "the title stays inside the listing limit");
assert(createTitle("  ") === "", "a blank caption has no title");
assert(CREATE_TOAST_ZH === "已發佈 · 已上架" && CREATE_TOAST_EN === "Published · Listed", "one toast covers publish and list");
assert(!CREATE_HREF.includes("kind=post") && !CREATE_TOAST_ZH.includes("貼子") && !CREATE_TOAST_ZH.includes("動態"), "create copy is not a post mode");
assert(createDest(CREATE_HREF, true) === "/add", "logged-in dest stays on 上架");
assert(createDest(CREATE_HREF, false) === `/login?next=${encodeURIComponent("/add")}`, "logged-out create returns to 上架");

const tab = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const shopTab = tab.indexOf('label: "賣場"');
const messageTab = tab.indexOf('label: "Message"');
const addTab = tab.indexOf('label: "加"');
const noticeTab = tab.indexOf('label: "消息"');
const profile = tab.indexOf('label: "個人頁"');
assert(shopTab >= 0 && shopTab < messageTab && messageTab < addTab && addTab < noticeTab && noticeTab < profile, "tab order 賣場, Message, 加, 消息, 個人頁");
assert(tab.includes("grid-cols-5") && !tab.includes("grid-cols-4"), "five bottom tabs");
assert(
  tab.includes('label: "賣場"') && tab.includes('label: "Message"') && tab.includes('label: "加"') && tab.includes('label: "消息"') && tab.includes('label: "個人頁"') && !tab.includes("貼文") && !tab.includes("商店") && !tab.includes("搜尋") && !tab.includes("圖鑑") && !tab.includes('href: "/dex"'),
  "bottom tabs use the locked labels",
);
assert(tab.includes('icon: "bag"') && tab.includes('icon: "messages"') && tab.includes('icon: "plus"') && tab.includes('icon: "bell"') && tab.includes("{label}") && !tab.includes("排行") && !tab.includes('href: "/rank"') && !tab.includes('label: "Front"') && !tab.includes('label: "Discover"') && !tab.includes('href: "/find"') && !tab.includes('href: "/news"') && !tab.includes('href: "/market"'), "Front, Discover, news, and rank are not bottom tabs");
assert(!tab.includes("accent: true") && !tab.includes("rounded-full bg-accent") && !tab.includes("bg-accent text-white"), "bottom icons are plain strokes, no green circle");
assert(tab.includes("bg-[#dc2626]") && tab.includes("messageUnread") && tab.includes("noticeUnread"), "Message and 消息 show a red unread badge");
assert(tab.includes("h-[22px]") && tab.includes("strokeWidth={on ? 2 : 1.6}"), "bottom icons stay 22px");
assert(tab.includes("tabHref(1") && tab.includes('label: "Message"'), "Message is a bottom tab");
const shopPage = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
const mallBoard = readFileSync(new URL("../components/mall-board.tsx", import.meta.url), "utf8");
const mallLib = readFileSync(new URL("../lib/shop-inventory.ts", import.meta.url), "utf8");
assert(
  mallBoard.includes("精選") && mallLib.includes("Pokémon") && mallLib.includes("Topps") && mallLib.includes("One Piece") && mallLib.includes("Riftbound") && mallBoard.includes("熱門商品") && mallBoard.includes("附近商戶") && mallBoard.includes("拍賣") && mallBoard.includes("/shop/${store.id}"),
  "the shop tab is the mall: category chips, lanes, and store cards",
);
assert(!shopPage.includes('href="/rank"') && !mallBoard.includes("排行榜"), "the mall no longer hosts a rank chip");
assert(shopPage.includes('title: "賣場"') && mallBoard.includes('role="search"') && mallBoard.includes('action="/shop"'), "賣場 search stays on the marketplace");
assert(tab.includes("text-[11px]") && tab.includes("{label}"), "bottom tabs show the locked labels");
assert(!tab.includes("AddSheet") && !tab.includes("新增") && !tab.includes("add-sheet"), "center add sheet is gone");

const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const top = readFileSync(new URL("../components/top-bar.tsx", import.meta.url), "utf8");
assert(shell.includes("<TopBar") && !shell.includes('variant="corner"') && !shell.includes("absolute inset-y-0 right-1"), "mobile header is the top bar; the corner add is gone");
assert(top.includes("md:hidden") && top.includes("h-[3.25rem]") && top.includes("max-w-lg") && !top.includes("grid-cols-3"), "top bar is the logo row");
assert(top.includes('href="/"') && top.includes("tsm-monogram.png") && top.includes("主頁") && !top.includes("tysm-wordmark"), "the only mobile slot is the monogram");
assert(!top.includes('href="/rank"') && !top.includes("排行榜") && !top.includes('icon="rank"') && !top.includes('href="/messages"') && !top.includes('href="/notifications"') && !top.includes('name="bell"') && !top.includes('name="plus"') && !top.includes("SearchBox") && !top.includes("搜尋"), "mobile top bar has no search, create, or notifications");
assert(!top.includes("rounded-full bg-accent text-white") && !top.includes("bg-accent text-white"), "top bar has no green circle");
assert(shell.includes('src="/brand/tsm-monogram.png"'), "desktop header keeps the TSM monogram");
assert(!shell.includes("tysm-wordmark"), "old wordmark is not referenced");
assert(shell.includes("<CreatePicker"), "desktop header still opens create");
assert(!shell.includes("add-sheet"), "shell no longer uses the bottom sheet");
const desktopAt = shell.indexOf("hidden h-14");
const desktop = desktopAt >= 0 ? shell.slice(desktopAt) : "";
assert(
  desktop.includes("max-w-lg") && desktop.indexOf("<SearchBox") < desktop.indexOf("tsm-monogram") && desktop.indexOf("tsm-monogram") < desktop.indexOf("<CreatePicker"),
  "desktop header is one row: search, mark, nav, on the feed width",
);
assert(
  desktop.includes('href="/shop"') && desktop.includes("賣場") && desktop.includes("<SearchBox") && desktop.includes('href="/news"') && desktop.includes('href="/rank"') && !desktop.includes('href="/find"') && !desktop.includes('href="/market"') && !desktop.includes('href="/dex"') && desktop.includes("whitespace-nowrap") && desktop.includes("shrink-0"),
  "desktop shop, news, and rank labels stay on one line; search is the field",
);
assert(!shell.includes("h-14 max-w-6xl"), "desktop tools are not a second full-width bar");
assert(shell.includes('href="/cart"') && shell.includes('href="/orders"') && shell.includes('href="/messages"'), "compact menu keeps cart, orders, and chat");
assert(shell.includes("bg-accent/15"), "notification and cart counts use a small pill");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert(!css.includes("6.5rem") && css.includes("3.5rem"), "desktop header height is a single row");
assert(css.includes("--header-h: calc(3.25rem + env(safe-area-inset-top))"), "mobile header matches the tab bar height");

const picker = readFileSync(new URL("../components/create-picker.tsx", import.meta.url), "utf8");
assert(picker.includes("CREATE_HREF") && picker.includes("createDest") && !picker.includes('role="menu"') && !picker.includes("CREATE_MODES"), "＋ is one link, not a post/list menu");
assert(!picker.includes('role="tab"') && !picker.includes('role="tabpanel"') && !picker.includes("btn-primary") && !picker.includes("ctaZh"), "segment, preview card, and extra cta are not stacked");
assert(!picker.includes("createPortal") && !picker.includes("fixed inset-0"), "picker is not a full-screen sheet");
assert(!picker.includes("snap-x") && !picker.includes("snap-mandatory"), "swipe scroller is gone");
assert(!picker.includes("左右滑動揀") && !picker.includes("Swipe to choose"), "swipe hint is gone");
assert(!picker.includes("‹") && !picker.includes("›"), "page counter and desktop arrows are gone");
assert(!picker.includes("bg-[#1E293B]") && !picker.includes('backgroundColor: "#0F172A"') && !picker.includes("h-16 w-16"), "dark sheet and oversized icon tile are gone");
assert(tab.includes('icon: "plus"') && tab.includes("h-[22px] w-[22px]") && tab.includes("tabHref(2") && tab.includes('label: "加"'), "mobile 加 is the center tab");
assert(!picker.includes("h-10 w-10") && !picker.includes("rounded-full bg-accent text-white") && !picker.includes("bg-accent text-white") && !picker.includes('variant === "top"') && !picker.includes("absolute left-1") && !picker.includes('variant === "corner"'), "the green circle and corner FAB stay gone");
assert(tab.includes("text-muted"), "the idle plus stays muted");
assert(!picker.includes("bg-accent text-white shadow-none md:hidden"), "mobile add is a circle, not the old header pill");
assert(picker.includes("bg-accent/10") && picker.includes("ring-accent/15"), "desktop add is a quiet accent control");
assert(!picker.includes('tx(locale, "加"') && !picker.includes("加入收藏") && !picker.includes("我的收藏") && !picker.includes("貼文"), "加 text, collect-only, and a post mode are gone from the picker");
assert(!picker.includes("想做咩") && !picker.includes("rounded-t-"), "bottom sheet copy is retired");

const add = readFileSync(new URL("../app/add/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/list-create-form.tsx", import.meta.url), "utf8");
const trade = readFileSync(new URL("../actions/trade.ts", import.meta.url), "utf8");
assert(add.includes("ListCreateForm") && !add.includes("CollectForm") && !add.includes("kind=post") && add.includes('redirect("/add")'), "／add is 上架; a post kind redirects away");
assert(form.includes('tx(locale, "發佈", "Publish")') && form.includes("LISTING_CROP_ASPECT") && !form.includes("POST_CROP_ASPECT") && !form.includes("放賣") && !form.includes("同時上架"), "create CTA is 發佈, photos are square, and there is no list toggle");
assert(trade.includes("publishCreateAction") && trade.includes('redirect("/?ok=listed")') && trade.includes("saveListing"), "發佈 writes one listing; the feed post comes from that save");
assert(shell.includes("CREATE_TOAST_ZH") && shell.includes("listed:"), "the flash is the single 已發佈 · 已上架 line");

const sell = readFileSync(new URL("../app/sell/page.tsx", import.meta.url), "utf8");
assert(!sell.includes("貼子") && !sell.includes("同時上架") && !sell.includes('href="/add?kind=post"'), "advanced sell does not offer a post composer");
assert(sell.includes("拍賣、多卡、排程同 CSV"), "auction, multi-card, schedule, and CSV stay on /sell");

const story = readFileSync(new URL("../components/story-composer.tsx", import.meta.url), "utf8");
assert(story.includes("getUserMedia") && story.includes('capture="environment"') && story.includes("STORY_EMOJIS"), "stories open on the camera and can switch to the system camera or stickers");
assert(story.includes("fixed inset-0"), "the story camera is full screen");

const me = readFileSync(new URL("../app/me/page.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/me/settings/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
const tabRoots = readFileSync(new URL("./tabs.ts", import.meta.url), "utf8");
assert(tabRoots.includes("createDest(CREATE_HREF") && tabRoots.includes('loggedIn ? "/me" : "/login"') && tab.includes("tabHref(4"), "加 opens 上架 and profile stays on the public profile");
assert(me.includes("<ProfileHeader") && me.includes("self") && me.includes("<ProfileBoard") && !me.includes("updateProfile") && !me.includes("PrefToggles"), "/me is header plus board");
assert(me.includes("logout") && me.includes('tx(locale, "登出", "Log out")') && me.includes('tx(prefs.locale, "登入", "Log in")') && me.includes("md:hidden") && me.includes("pb-[calc(var(--tab-h)+1rem)]") && !me.includes("fixed inset-x-0 bottom-[var(--tab-h)]"), "mobile /me keeps 登出 in flow, with tab-bar padding under it");
assert(!board.includes('"/orders"') && !board.includes("/me#store") && !board.includes("menu-row"), "owner shortcut rows stay off the profile board");
assert(board.includes("grid-cols-5") && board.includes("grid-cols-4") && board.includes("bg-ink"), "profile tabs are equal icon columns over a thumbnail grid");
assert(board.includes("商品") && board.includes("買取") && board.includes("收藏") && board.includes("商店") && board.includes("評價") && !board.includes("收購") && !board.includes("收卡") && !board.includes("My Binder"), "profile tabs are listings, buyouts, favorites, shop, reviews");
assert(board.includes('id: "shelf"') && board.includes('id: "buyout"') && board.includes('id: "saved"') && !board.includes('id: "posts"'), "the first screen is the shelf; 買取 is next; there is no posts tab");
assert(!board.includes("我的卡") && !board.includes('id: "box"') && !board.includes("CollectionMenu") && !board.includes("collectionItemId"), "the owned-card grid is off the profile");
assert(
  board.includes('tx(locale, "暫無商品。", "No listings yet.")') &&
    board.includes('href="/add"') &&
    board.includes("上架第一件") &&
    board.includes("grid-cols-2") &&
    board.includes("object-cover") &&
    !board.includes("發佈第一則") &&
    !board.includes('href="/add?kind=post"') &&
    !board.includes("未有卡片"),
  "the shelf is a 1:1 cover grid; empty self profiles offer 上架第一件",
);
assert(board.includes('icon: "grid"') && board.includes('icon: "bookmark"') && board.includes('icon: "bag"') && board.includes('icon: "star"'), "profile tabs use icons");
assert(!board.includes("chips") && !board.includes("rounded-full") && !board.includes("<PostCard") && !board.includes("<ListingCard"), "profile tabs are not pills and image tabs are thumbnails");
assert(!settings.includes("updateProfile") && !settings.includes("saveAddress") && !settings.includes('"/orders"') && !settings.includes("/me?tab=drafts") && !settings.includes('id="store"') && !settings.includes("/me/edit") && !settings.includes("/me/footprint"), "settings is a list, not the old account form");
assert(auth.includes('const editPath = "/me/edit"') && auth.includes("${editPath}?ok=saved") && auth.includes("${editPath}?err=nickname") && auth.includes("saveShop") && auth.includes('id="store"') === false, "profile saves flash on the edit page");
const account = readFileSync(new URL("../app/me/settings/[section]/page.tsx", import.meta.url), "utf8");
assert(account.includes('id="store"') && account.includes("logout") && account.includes("clearHistory") && account.includes("saveNotifications"), "account tools moved under the settings rows");

console.log("create modes ok");
