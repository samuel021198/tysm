import { readFileSync } from "fs";
import { CREATE_MODES, createDest, createIndexFromScroll } from "./create-modes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(CREATE_MODES.map((mode) => mode.zh).join("|") === "上架|開 post|動態|加入收藏", "create mode order");
assert(CREATE_MODES.map((mode) => mode.href).join("|") === "/sell|/add?kind=post|/story/new|/add", "create mode routes");
assert(createDest("/sell", true) === "/sell", "logged-in dest stays on the flow");
assert(
  createDest("/add?kind=post", false) === `/login?next=${encodeURIComponent("/add?kind=post")}`,
  "logged-out post keeps the kind query",
);

assert(createIndexFromScroll(0, 390, 4) === 0, "origin");
assert(createIndexFromScroll(194, 390, 4) === 0, "before the halfway snap");
assert(createIndexFromScroll(195, 390, 4) === 1, "halfway snaps forward");
assert(createIndexFromScroll(1170, 390, 4) === 3, "last page");
assert(createIndexFromScroll(4000, 390, 4) === 3, "clamped");
assert(createIndexFromScroll(-40, 390, 4) === 0, "negative");
assert(createIndexFromScroll(80, 0, 4) === 0, "zero width");

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
assert(picker.includes("fixed") && picker.includes("md:hidden") && picker.includes("加"), "top-left 加 is fixed on mobile");
assert(!picker.includes("想做咩") && !picker.includes("rounded-t-"), "bottom sheet copy is retired");

console.log("create modes ok");
