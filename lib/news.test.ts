import { readFileSync } from "fs";
import { NEWS_SAMPLES, compareNews, hkMidnight, newsSourceLine } from "./news";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-10-27T12:00:00+08:00");
assert(newsSourceLine("Topps", hkMidnight("2026-10-27"), now, "zh-HK") === "Topps · 今日", "today reads Topps · 今日");
assert(newsSourceLine("Topps", hkMidnight("2026-10-28"), now, "zh-HK") === "Topps · 10/28", "the next day stays a calendar date");
assert(newsSourceLine("Panini", null, now, "zh-HK") === "Panini · 即將", "an undated row says soon");

assert(NEWS_SAMPLES.length >= 8 && NEWS_SAMPLES.length <= 12, "seed stays a short list");
assert(new Set(NEWS_SAMPLES.map((row) => row.title)).size === NEWS_SAMPLES.length, "one news card per product");
assert(NEWS_SAMPLES.every((row) => !row.title.includes("快訊") && !row.body.includes("快訊")), "titles are product names");
assert(
  NEWS_SAMPLES.every((row) => ["Topps", "Pokémon", "One Piece", "Riftbound", "Panini"].includes(row.source)),
  "source is the brand",
);
const sorted = [...NEWS_SAMPLES].sort(compareNews);
assert(sorted.slice(0, 4).every((row) => row.hot) && sorted.slice(4).every((row) => !row.hot), "drops today sort ahead of the calendar");
assert(sorted.at(-1)?.slug === "panini-prizm-wnba", "coming soon sits last");
assert(sorted.filter((row) => !row.hot)[0]?.slug === "pokemon-30th-battle-deck", "the next calendar row is 10/30");

const sql = readFileSync(new URL("../prisma/migrations/20261027160000_news_items/migration.sql", import.meta.url), "utf8");
for (const row of NEWS_SAMPLES) {
  assert(sql.includes(row.slug) && sql.includes(row.title), `${row.slug} is inserted on migrate`);
}

const list = readFileSync(new URL("../app/news/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/news/[slug]/page.tsx", import.meta.url), "utf8");
const tab = readFileSync(new URL("../components/tab-bar.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/catalog-title-field.tsx", import.meta.url), "utf8");
const collect = readFileSync(new URL("../components/collect-form.tsx", import.meta.url), "utf8");
const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
assert(list.includes("暫時未有卡聞。") && list.includes("h-[72px]") && !list.includes("chips") && !list.includes("快訊"), "the news list is a quiet cover row");
assert(detail.includes("睇原文") && detail.includes("newsSourceLine"), "detail is cover, title, source, then the source link");
assert(tab.includes('href: "/news"') && tab.includes("新聞") && tab.includes('icon: "news"') && !tab.includes('href: "/dex"'), "bottom nav replaces the dex slot");
assert(shell.includes('href="/news"') && !shell.includes('href="/dex"'), "desktop nav does not link the dex");
assert(picker.includes("搵唔到？自己入卡名") && picker.includes("/api/catalog/suggest"), "the card picker can keep a typed name");
assert(collect.includes("CatalogTitleField") && sell.includes("CatalogTitleField") && sell.includes("hit.imageUrl"), "collect and sell fill the name from the catalog");

console.log("news ok");
