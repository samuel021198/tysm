import { readFileSync } from "fs";
import { MALL_CHIPS, MALL_FEED_CAP, mallCategoryHit, orderMallListings, pickMallListings, shopDisplayCents, shopMenu, shopPill, shopPillLabel, shopPriceEditable } from "./shop-inventory";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const buy = { saleType: "BUY_NOW", itemCount: 1 };
assert(shopPill({ status: "ACTIVE", binLockOrderId: null }) === "ACTIVE", "在售 is ACTIVE with no hold");
assert(shopPill({ status: "ACTIVE", binLockOrderId: "order_1" }) === "RESERVED", "已保留 follows the existing hold");
assert(shopPill({ status: "ACTIVE", reserved: true }) === "RESERVED", "the profile row can pass a reserved flag");
assert(shopPill({ status: "SOLD", binLockOrderId: null }) === "SOLD", "已售 is SOLD");
assert(shopPill({ status: "UNLISTED", binLockOrderId: "order_1" }) === "UNLISTED", "已下架 wins over a leftover hold");
assert(shopPill({ status: "ENDED", binLockOrderId: null }) === "ENDED", "an ended auction stays on the shop list");
assert(shopPill({ status: "DRAFT", binLockOrderId: null }) === null, "drafts stay off the shop list");
assert(
  shopPillLabel("zh-HK", "ACTIVE") === "在售" &&
    shopPillLabel("zh-HK", "RESERVED") === "已保留" &&
    shopPillLabel("zh-HK", "SOLD") === "已售" &&
    shopPillLabel("zh-HK", "UNLISTED") === "已下架",
  "pills use the locked copy",
);

assert(shopPriceEditable("ACTIVE", buy) && shopPriceEditable("RESERVED", buy), "price edits while 在售 or 已保留");
assert(
  !shopPriceEditable("SOLD", buy) && !shopPriceEditable("UNLISTED", buy) && !shopPriceEditable("ENDED", buy),
  "sold, unlisted, and ended prices stay fixed",
);
assert(!shopPriceEditable("ACTIVE", { saleType: "AUCTION", itemCount: 1 }), "an auction ask is not a buy-now price");
assert(!shopPriceEditable("ACTIVE", { saleType: "BUY_NOW", itemCount: 2 }), "a multi-card total is edited in the listing form");

assert(
  shopMenu("ACTIVE").edit && shopMenu("ACTIVE").unlist && shopMenu("ACTIVE").sold && shopMenu("RESERVED").unlist && shopMenu("RESERVED").sold,
  "在售 and 已保留 can be edited, unlisted, or marked sold",
);
assert(!shopMenu("SOLD").sold && !shopMenu("SOLD").unlist && shopMenu("SOLD").edit, "a sold row can still open edit, not sell itself again");
assert(!shopMenu("UNLISTED").unlist && !shopMenu("ENDED").sold, "下架 and 已售 are not offered again");

assert(shopDisplayCents({ saleType: "BUY_NOW", price: 100, startPrice: null, currentBid: null, auctionSettled: false }) === 100, "buy now shows the price");
const cheap = { saleType: "BUY_NOW" as const, price: 100, startPrice: null, currentBid: null, auctionSettled: false, auctionEndsAt: null };
const dear = { saleType: "BUY_NOW" as const, price: 500, startPrice: null, currentBid: null, auctionSettled: false, auctionEndsAt: null };
const soon = { saleType: "AUCTION" as const, price: null, startPrice: 200, currentBid: 200, auctionSettled: false, auctionEndsAt: new Date("2026-11-01T00:00:00Z") };
const later = { saleType: "AUCTION" as const, price: null, startPrice: 50, currentBid: 50, auctionSettled: false, auctionEndsAt: new Date("2026-12-01T00:00:00Z") };
assert(orderMallListings([dear, cheap], "new").map((row) => row.price).join() === "500,100", "最新上架 keeps the loaded order");
assert(orderMallListings([{ ...cheap, promoted: true }, { ...dear, promoted: false }], "price_desc")[0]?.price === 500, "a promo pill does not outrank a higher price");
assert(orderMallListings([dear, cheap], "price_asc").map((row) => row.price).join() === "100,500", "價錢低→高");
assert(orderMallListings([cheap, dear], "price_desc").map((row) => row.price).join() === "500,100", "高→低");
assert(orderMallListings([cheap, later, soon], "ending")[0] === soon && orderMallListings([cheap, later, soon], "ending")[2] === cheap, "即將結束 puts live auctions first and fixed price last");
const poke = { ...cheap, sellerId: "poke", title: "皮卡丘", game: "Pokémon", cardName: "皮卡丘", categorySlug: "pokemon", categoryZh: "寶可夢", categoryEn: "Pokémon" };
const idol = { ...dear, sellerId: "idol", title: "球鞋", game: null, cardName: null, categorySlug: "idols", categoryZh: "偶像", categoryEn: "Idols" };
const topps = { ...cheap, price: 300, sellerId: "topps", title: "Chrome", game: "Topps Basketball", cardName: "Siakam", categorySlug: "topps-basketball", categoryZh: "Topps 籃球", categoryEn: "Topps Basketball" };
const lane = { lane: "hot" as const, interests: [] as string[], sort: "new" as const, followedIds: [] as string[] };
assert(pickMallListings([idol, poke], { ...lane, cat: "picks", interests: ["寶可夢"] }).map((row) => row.sellerId).join() === "poke", "精選 follows interest tags");
assert(pickMallListings([idol, poke], { ...lane, cat: "picks" }).length === 2, "精選 with no tags keeps the lane");
assert(pickMallListings([idol, poke, topps], { ...lane, cat: "pokemon" })[0]?.sellerId === "poke", "the Pokémon chip is that category");
assert(pickMallListings([idol, topps], { ...lane, cat: "topps" })[0]?.sellerId === "topps" && !mallCategoryHit("topps", { categorySlug: "football", game: null }), "Topps is its own chip");
const ygo = { ...cheap, price: 220, sellerId: "ygo", title: "青眼白龍", game: "Yu-Gi-Oh", cardName: "青眼白龍", categorySlug: "yugioh", categoryZh: "Yu-Gi-Oh", categoryEn: "Yu-Gi-Oh" };
assert(MALL_CHIPS.map((chip) => chip.zh).join("|") === "Pokémon|Topps|One Piece|Riftbound|Yu-Gi-Oh", "mall chips stay 精選 beside Pokémon｜Topps｜One Piece｜Riftbound｜Yu-Gi-Oh");
assert(!MALL_CHIPS.some((chip) => chip.id === "bandai" || /bandai|panini|vanguard|union/i.test(chip.zh)), "Bandai and Wave-2 brands are not chips");
assert(pickMallListings([idol, ygo], { ...lane, cat: "yugioh" })[0]?.sellerId === "ygo", "the Yu-Gi-Oh chip is that category");
assert(mallCategoryHit("yugioh", { categorySlug: "other", game: "遊戲王" }) && !mallCategoryHit("yugioh", { categorySlug: "gundam", game: "Gundam" }), "Yu-Gi-Oh matches the Chinese game name and not Gundam");
assert(pickMallListings([idol, poke], { ...lane, lane: "follow", cat: "picks", followedIds: ["idol"] })[0]?.sellerId === "idol", "已關注 is people you follow");
const named = { sellerId: "x", title: "x", game: null, cardName: null, categorySlug: "pokemon", categoryZh: "寶可夢", categoryEn: "Pokémon" };
assert(pickMallListings([{ ...cheap, ...named, sellerId: "buy" }, { ...soon, ...named, sellerId: "auc" }], { ...lane, lane: "auction", cat: "picks", now: new Date("2026-10-01T00:00:00Z").getTime() })[0]?.sellerId === "auc", "拍賣 is a live auction");
assert(MALL_FEED_CAP === 16 && pickMallListings(Array.from({ length: 20 }, (_, index) => ({ ...cheap, sellerId: String(index), title: String(index), game: null, cardName: null, categorySlug: "pokemon", categoryZh: "寶可夢", categoryEn: "Pokémon" })), { ...lane, cat: "picks" }).length === 16, "a lane shows at most 16");
assert(
  shopDisplayCents({ saleType: "AUCTION", price: null, startPrice: 50, currentBid: 80, auctionSettled: false }) === 80,
  "a live auction shows the bid",
);
assert(
  shopDisplayCents({ saleType: "BOTH", price: 2000, startPrice: 500, currentBid: 1100, auctionSettled: false }) === 1100,
  "buy-now on a live auction is not the card price",
);

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
assert(schema.includes("enum ListingStatus") && !schema.includes("RESERVED") && schema.includes("binLockOrderId"), "no new status; a hold is the existing lock");

const header = readFileSync(new URL("../components/profile-header.tsx", import.meta.url), "utf8");
assert(
  header.includes("?tab=selling#profile-posts") && header.includes("ProfileTabLink") && header.includes('tab="selling"') && header.includes("商品"),
  "the 商品 count selects the bag tab on this profile",
);
assert(!header.includes("/inventory") && !header.includes("/products") && !header.includes('href="/listings"'), "商品 does not open another inventory page");

const link = readFileSync(new URL("../components/profile-tab-link.tsx", import.meta.url), "utf8");
assert(
  link.includes("preventDefault") && link.includes("replaceState") && link.includes("PROFILE_TAB_EVENT") && link.includes("profile-posts"),
  "the count switches the open profile tab without leaving the page",
)

const board = readFileSync(new URL("../components/profile-board.tsx", import.meta.url), "utf8");
assert(board.includes("PROFILE_TAB_EVENT") && board.includes("<ShopInventory") && board.includes("isSelf"), "own shop tab is the management list");
assert(board.includes("未有上架。") && board.includes("上架第一件") && board.includes('href="/sell"'), "empty own shop uses the existing create flow");
assert(board.includes("暫未有在售。") && board.includes("grid-cols-3"), "visitors keep the public sale grid");
assert(!board.includes("⋯"), "the thumbnail grid does not grow an ellipsis");

const list = readFileSync(new URL("../components/shop-inventory.tsx", import.meta.url), "utf8");
assert(list.includes("我的上架") && list.includes("shopPillLabel") && list.includes('href={`/sell/${row.id}`}') && list.includes("下架") && list.includes("已售"), "each row can edit, unlist, or mark sold");
assert(list.includes("updateShopPrice") && list.includes("shopPriceEditable"), "the price field is the inline editor");

const listings = readFileSync(new URL("./listings.ts", import.meta.url), "utf8");
const unlist = listings.slice(listings.indexOf("export async function unlistListing"), listings.indexOf("export async function relistListing"));
assert(unlist.includes('status: "UNLISTED"') && unlist.includes("binLockOrderId: null"), "下架 clears a hold");
assert(listings.includes("export async function updateListingPrice") && listings.includes("export async function markListingSold"), "price and sold are listing writes");

const profile = readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
assert(profile.includes("SHOP_INVENTORY_STATUSES") && profile.includes("reserved: Boolean(row.binLockOrderId)"), "own 商品 count is the shop list; 已保留 is the hold");
assert(profile.includes('status: "ACTIVE" as const, quantityAvailable: { gt: 0 }'), "visitors still load public 在售");

const store = readFileSync(new URL("../app/shop/[id]/page.tsx", import.meta.url), "utf8");
const mall = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
const rails = readFileSync(new URL("../components/mall-rails.tsx", import.meta.url), "utf8");
assert(mall.includes("<MallBoard") && mall.includes("listingQueryWhere") && mall.includes("MALL_FEED_CAP") && !mall.includes("MallRails") && !mall.includes("MallBar") && !mall.includes('href="/rank"'), "the mall loads a capped feed and does not mount the old rails");
const mallBoard = readFileSync(new URL("../components/mall-board.tsx", import.meta.url), "utf8");
assert(
  mallBoard.includes('name="q"') && mallBoard.includes("詳細篩選") && mallBoard.includes("精選") && mallBoard.includes("MALL_CHIPS") && mallBoard.includes("更多") && mallBoard.includes("熱門商品") && mallBoard.includes("附近商戶") && mallBoard.includes("已關注") && mallBoard.includes("拍賣") && mallBoard.includes('useState<Lane>("hot")') && !mallBoard.includes("useRouter") && !mallBoard.includes("router.push"),
  "search, category chips, and tabs; tabs do not navigate",
);
const sellForm = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../prisma/demo-catalog.ts", import.meta.url), "utf8");
const extra = catalog.slice(catalog.indexOf("export const EXTRA_CARD_CATEGORIES"), catalog.indexOf("] as const;", catalog.indexOf("export const EXTRA_CARD_CATEGORIES")));
const picker = sellForm.slice(sellForm.indexOf("const CARD_ORDER"), sellForm.indexOf("function catalogSlug"));
assert(
  picker.includes('"yugioh"') && picker.includes('"weiss-schwarz"') && picker.includes('"digimon"') && picker.includes('"lorcana"') && picker.includes('"mtg"') && picker.includes('"flesh-and-blood"') && picker.includes('"gundam"') && picker.includes('"dragon-ball"') && picker.includes('"other"') && picker.includes('"topps-baseball"'),
  "the sell picker keeps Topps baseball and adds the Wave-1 brands",
);
assert(!picker.includes("union-arena") && !picker.includes("vanguard") && !picker.includes('"panini"'), "Wave-2 brands stay out of the picker");
for (const label of ["Yu-Gi-Oh", "Weiss Schwarz", "Digimon", "Lorcana", "MTG", "Flesh and Blood", "Gundam", "Dragon Ball", "其他"]) {
  assert(extra.includes(label), `${label} is a category leaf`);
}
assert(!extra.includes("union-arena") && !extra.includes("Union Arena") && !extra.includes("vanguard") && !extra.includes("Vanguard"), "Wave-2 leaves are not seeded");
assert(
  mallBoard.includes("最新上架") && mallBoard.includes("價錢低→高") && mallBoard.includes("高→低") && mallBoard.includes("即將結束") && mallBoard.includes('href="/shop/recent"') && mallBoard.includes('href="/shop/watch"') && !mallBoard.includes("排行榜") && !mallBoard.includes("max-w-[390px]") && !mallBoard.includes("max-w-[375px]"),
  "the filter sheet is sort plus shortcuts, without a fixed phone width",
);
assert(mallBoard.includes("/shop/${store.id}") && mallBoard.includes("<PromoPill") && !mallBoard.includes("promoted ? -1"), "進店 stays on shop cards and the promo pill is not a sort key");
assert(
  rails.includes("最近瀏覽") && rails.includes("追蹤") && rails.includes("查看全部") && rails.includes("最後 1 件") && rails.includes("quantityAvailable === 1") && rails.includes('name="bookmark"'),
  "mall rails are cover rows with a watch mark and a last-one badge",
);
assert(
  store.includes("<NameLine") && store.includes("verificationTier={seller.verificationTier}") && store.includes("rating={rating}"),
  "the store header is shop name, pill, then score",
);
assert(
  store.includes("本店推廣") && store.includes("promoted.length > 0") && store.includes("overflow-x-auto"),
  "本店推廣 is a horizontal row only when that seller has promoted listings",
);
assert(
  store.includes("grid-cols-2") && store.includes("<PromoPill") && store.includes("最後 1 件") && store.includes("quantityAvailable === 1") && !store.includes('className="feed"'),
  "inventory stays a 2-column grid with the promo pill and a last-one label",
);
assert(
  !store.includes("最近瀏覽") && !store.includes("FollowRail") && !store.includes("SearchBox") && !store.includes("MallBar") && !store.includes("新上架") && !store.includes("<ProfileBoard"),
  "the store page has no recent row, following rail, search, mall chips, or profile tabs",
);
assert(store.includes("publicCardSelect") && !store.includes("reservePrice"), "the store grid uses the public select and leaves the reserve out");
assert(store.includes("暫未有貨品。") && !store.includes("上架第一件"), "empty stock is one short line");

console.log("shop-inventory.test.ts ok");
