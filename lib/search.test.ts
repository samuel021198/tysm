import { readFileSync } from "fs";
import { clearRecent, pullAccountRecent, pushRecent, readRecent, removeRecent } from "./search-memory";
import {
  buildSuggestRows,
  categoryMatches,
  foldSearch,
  forgetMemory,
  mergeMemory,
  listedPostWhere,
  marketSearchHref,
  marketShow,
  postQueryWhere,
  rememberMemory,
  findHref,
  searchHref,
  searchNeedles,
  searchScore,
  suggestPanelDismiss,
  textHits,
  userQueryWhere,
} from "./search";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function collectCollectionItems(value: unknown, found: string[][]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const row of value) collectCollectionItems(row, found);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.collectionItem && typeof record.collectionItem === "object") found.push(Object.keys(record.collectionItem));
  for (const child of Object.values(record)) collectCollectionItems(child, found);
}

const has = (q: string, term: string) => searchNeedles(q).some((needle) => foldSearch(needle) === foldSearch(term));

assert(has("寶可夢", "Pokémon"), "寶可夢 expands to Pokémon");
assert(has("Pokemon", "寶可夢"), "Pokemon expands to 寶可夢");
assert(has("pokémon", "pokemon"), "accent folds onto pokemon");
assert(has("可達鴨", "Psyduck"), "可達鴨 expands to Psyduck");
assert(has("Psyduck", "可達鴨"), "Psyduck expands to 可達鴨");
assert(has("噴火龍 VMAX", "Charizard"), "title fragment still expands 噴火龍");
assert(!has("zz", "寶可夢"), "unrelated query does not pull Pokémon");

const pokemon = { title: "噴火龍 VMAX", cardName: "噴火龍", game: "Pokémon", category: { nameZh: "寶可夢", nameEn: "Pokémon" } };
const duck = { title: "Psyduck", cardName: "Psyduck", game: "Pokémon", category: { nameZh: "寶可夢", nameEn: "Pokémon" } };
assert(searchScore(pokemon, "寶可夢") > searchScore(duck, "Charizard"), "charizard ranks for 寶可夢 and not for the other card's name");
assert(searchScore(duck, "可達鴨") >= 5, "english-only Psyduck title scores for 可達鴨");
assert(searchScore(pokemon, "Charizard") >= 4, "chinese card name scores for Charizard");

assert(searchHref("可達鴨", { cat: "pokemon" }).startsWith("/search?q=") && searchHref("可達鴨", { cat: "pokemon" }).endsWith("&cat=pokemon"), "search href keeps the query and category");
assert(findHref("可達鴨") === `/find?q=${encodeURIComponent("可達鴨")}`, "find href is the universal search");
assert(decodeURIComponent(searchHref("可達鴨", { cat: "pokemon" }).split("q=")[1]?.split("&")[0] || "") === "可達鴨", "search href round-trips Chinese");
assert(textHits("寶可夢", "Pokémon"), "寶可夢 hits the English category name");
assert(textHits("Pokemon", "寶可夢"), "Pokemon hits the Chinese category name");
assert(textHits("寶", "寶可夢"), "one Chinese character can hit a category");
assert(!textHits("p", "Football"), "a single latin letter does not hit every category");
assert(categoryMatches("pokemon", "寶可夢", "Pokémon"), "pokemon matches the Pokémon category");
assert(!categoryMatches("psyduck", "足球", "Football"), "psyduck does not match football");

let memory = rememberMemory([], { query: "  噴火龍  " });
memory = rememberMemory(memory, { query: "Psyduck", cat: "pokemon", catZh: "寶可夢", catEn: "Pokémon" });
assert(memory[0]?.query === "Psyduck" && memory[0]?.catZh === "寶可夢", "newest scoped search is first");
assert(memory[1]?.query === "噴火龍" && !memory[1]?.cat, "stored query is trimmed");
memory = rememberMemory(memory, { query: "噴火龍" });
assert(memory.length === 2 && memory[0]?.query === "噴火龍", "repeating a search moves it to the front");
assert(forgetMemory(memory, { query: "Psyduck", cat: "pokemon" }).some((row) => row.query === "噴火龍"), "forgetting one search keeps the other");
assert(mergeMemory([{ query: "local" }], [{ query: "server" }, { query: "local" }]).map((row) => row.query).join() === "local,server", "merge keeps local order");

const rows = buildSuggestRows({
  query: "psyduck",
  recent: [
    { query: "psyduck", cat: "pokemon", catZh: "寶可夢", catEn: "Pokémon" },
    { query: "可達鴨" },
    { query: "lisa" },
  ],
  saved: [{ query: "saved one" }],
  tab: "saved",
  listings: [{ id: "1", title: "可達鴨 Psyduck", categorySlug: "pokemon", categoryZh: "寶可夢", categoryEn: "Pokémon" }],
  categories: [],
});
assert(rows[0]?.kind === "query" && rows[0]?.label === "psyduck", "typed query is the first suggestion");
assert(!rows.some((row) => row.label === "lisa" || row.label === "saved one"), "unrelated and saved rows stay out while typing");
assert(rows.filter((row) => row.href.includes("cat=pokemon")).length === 1, "scoped recent covers the duplicate category hint");
assert(rows.some((row) => row.kind === "listing" && row.hintZh === "在寶可夢"), "listing title keeps its category hint");
assert(rows.some((row) => row.label === "可達鴨"), "可達鴨 recent matches an English psyduck query");

const named = buildSuggestRows({
  query: "pokemon",
  recent: [],
  saved: [],
  tab: "recent",
  listings: [],
  categories: [{ slug: "pokemon", nameZh: "寶可夢", nameEn: "Pokémon" }],
});
assert(named.some((row) => row.kind === "category" && row.hintZh === "在寶可夢"), "category name becomes a scoped hint");

const savedRows = buildSuggestRows({
  query: "",
  recent: [{ query: "噴火龍" }],
  saved: [{ query: "美斯", cat: "football", catZh: "足球", catEn: "Football" }],
  tab: "saved",
  listings: [],
  categories: [],
});
assert(savedRows.length === 1 && savedRows[0]?.hintEn === "in Football", "empty query shows the saved tab");

const dismiss = { mobileSheet: false, insidePanel: false, focusInside: false };
assert(!suggestPanelDismiss("scroll", { ...dismiss, insidePanel: true }), "scrolling the suggestion list keeps it open");
assert(!suggestPanelDismiss("scroll", { ...dismiss, mobileSheet: true }), "the mobile sheet stays open while the page scrolls");
assert(suggestPanelDismiss("scroll", dismiss), "scrolling the results page closes the desktop dropdown");
assert(!suggestPanelDismiss("blur", { ...dismiss, mobileSheet: true }), "blur from the mobile keyboard does not close the sheet");
assert(!suggestPanelDismiss("blur", { ...dismiss, focusInside: true }), "moving focus inside the box does not close it");
assert(suggestPanelDismiss("blur", dismiss), "blur outside closes the desktop dropdown");
assert(suggestPanelDismiss("escape", dismiss) && suggestPanelDismiss("submit", dismiss), "escape and submit always close");

const users = JSON.stringify(userQueryWhere("阿明"));
assert(users.includes("nickname") && !users.includes("catalog"), "user search is nicknames, not the dex");
const postWhere = postQueryWhere("皮卡丘");
const posts = JSON.stringify(postWhere);
assert(posts.includes("body") && posts.includes("nickname") && posts.includes("cardName") && posts.includes("listing"), "post search uses the body, the author, and the linked listing");
assert(!posts.includes("catalogCard"), "post search skips the dex");
const itemKeys: string[][] = [];
collectCollectionItems(postWhere, itemKeys);
assert(itemKeys.length > 0 && itemKeys.every((keys) => keys.length === 1 && keys[0] === "listing"), "a post does not search CollectionItem title or card name");
assert(JSON.stringify(postQueryWhere("")).includes("in"), "a blank post search matches nothing");
const listed = listedPostWhere({ status: "ACTIVE" });
assert(JSON.stringify(listed).includes("ACTIVE") && !JSON.stringify(listed).includes("body"), "market posts with no query still require a listing");
const listedQuery = listedPostWhere({ status: "ACTIVE" }, "皮卡丘");
assert(
  Array.isArray(listedQuery.AND) && JSON.stringify(listedQuery).includes("body") && JSON.stringify(listedQuery).includes("ACTIVE"),
  "a market post query keeps the listing gate",
);
assert(marketShow(undefined) === "all" && marketShow("post") === "post" && marketShow("listing") === "listing" && marketShow("nope") === "all", "result chips default to all");
assert(marketSearchHref({ q: "皮卡丘", cat: "pokemon", sort: "relevance" }, "post") === `/search?q=${encodeURIComponent("皮卡丘")}&cat=pokemon&show=post`, "the post chip keeps the market filters");
assert(marketSearchHref({ q: "皮卡丘", sort: "new" }) === `/search?q=${encodeURIComponent("皮卡丘")}&sort=new`, "all is the default chip and stays off the URL");
assert(marketSearchHref({}) === "/search", "an empty market search has no query string");
const find = readFileSync(new URL("../app/find/page.tsx", import.meta.url), "utf8");
assert(find.includes("用戶") && find.includes("貼文") && find.includes("放售"), "search shows users, posts, and listings");
assert(!find.includes("CatalogCard") && !find.includes("/dex"), "the search page does not open the dex");
assert(find.includes("searchHistory.create") && find.includes("FindSearch"), "find records a query and shows history");
const box = readFileSync(new URL("../components/search-box.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
assert(box.includes('to = "find"') && box.includes('"/find"'), "the header search box submits to find");
assert(shell.includes("<SearchBox") && !shell.includes('to="search"'), "the header uses the universal search");
const marketPage = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
assert(marketPage.includes('to="search"'), "market filters stay on /search");
assert(marketPage.includes("listedPostWhere") && marketPage.includes("全部") && marketPage.includes("上架") && marketPage.includes("貼文"), "market search chips include listed posts");
assert(marketPage.includes("show={show}"), "a new market query keeps the result chip");
assert(
  marketPage.includes('const split = show === "all" && shown.length > 0 && postCards.length > 0;') && (marketPage.match(/\{split \? <h2/g) || []).length === 2,
  "上架 and 貼文 labels only show together under 全部",
);
const filters = readFileSync(new URL("../components/search-filters.tsx", import.meta.url), "utf8");
const panelAt = filters.indexOf("{open ? (");
assert(filters.includes("useState(false)") && panelAt !== -1, "market filters start collapsed");
assert(filters.indexOf('name="cat"') > panelAt && filters.indexOf('name="num"') > panelAt && filters.indexOf("套用") > panelAt, "category, card number, and the rest open from 篩選");
assert(filters.indexOf("篩選") < panelAt && filters.includes("sort !== \"relevance\""), "the resting control is 篩選, and the default sort does not count");
assert(find.includes("collectionItem?.listing?.cardName"), "find names a priced post from the linked listing");
const findRows = buildSuggestRows({
  query: "",
  recent: [{ query: "Tyu" }],
  saved: [],
  tab: "recent",
  listings: [],
  categories: [],
  to: "find",
});
assert(findRows[0]?.href.startsWith("/find?q="), "a recent query reruns on find");

void (async () => {
  const store = new Map<string, string>();
  let deletes = 0;
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
      dispatchEvent() {
        return true;
      },
    },
    fetch: async (_url: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") deletes += 1;
      return new Response(JSON.stringify([{ query: "from-server" }]), { status: 200 });
    },
  });
  pushRecent({ query: "local-duck" });
  await pullAccountRecent();
  assert(
    readRecent().some((row) => row.query === "from-server") && readRecent().some((row) => row.query === "local-duck"),
    "account history merges behind this device",
  );
  removeRecent({ query: "local-duck" });
  assert(!readRecent().some((row) => row.query === "local-duck"), "remove drops a recent search");
  assert(deletes >= 1, "remove tells the account");
  clearRecent();
  pushRecent({ query: "after-clear" });
  await pullAccountRecent();
  assert(readRecent().some((row) => row.query === "after-clear"), "a new search still saves after clear");
  assert(!readRecent().some((row) => row.query === "from-server"), "clear is not restored by a later account pull");
  console.log("search ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
