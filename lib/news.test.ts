import { existsSync, readFileSync } from "fs";
import { NEWS_BRAND_LOGOS, NEWS_SAMPLES, compareNewsByCreatedAt, newsBrandLogo, newsDetailCopy, newsSourceLine, newsUpdatedAgo } from "./news";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-10-27T15:00:00+08:00");
const H = 60 * 60 * 1000;
const ago = (ms: number) => new Date(now.getTime() - ms);
assert(newsUpdatedAgo(ago(30_000), now, "zh-HK") === "剛剛", "just now");
assert(newsUpdatedAgo(ago(H - 1), now, "zh-HK") === "剛剛", "under an hour stays just now");
assert(newsUpdatedAgo(ago(H), now, "zh-HK") === "1 小時前", "one hour");
assert(newsUpdatedAgo(ago(3 * H), now, "zh-HK") === "3 小時前", "hours ago");
assert(newsUpdatedAgo(ago(23 * H), now, "zh-HK") === "23 小時前", "within a day stays hours, even across midnight");
assert(newsUpdatedAgo(new Date("2026-10-26T10:00:00+08:00"), now, "zh-HK") === "昨日", "the previous Hong Kong date is yesterday");
assert(newsUpdatedAgo(new Date("2026-10-25T23:30:00+08:00"), now, "zh-HK") === "10/25", "older than yesterday is M/D");
assert(newsUpdatedAgo(new Date("2026-10-20T10:00:00+08:00"), now, "zh-HK") === "10/20", "an older calendar day is M/D");
assert(newsSourceLine("Topps", ago(3 * H), now, "zh-HK") === "Topps · 3 小時前", "the source line uses updatedAt wording");
assert(newsUpdatedAgo(ago(3 * H), now, "en") === "3 hours ago", "english hours");
assert(newsUpdatedAgo(new Date("2026-10-26T10:00:00+08:00"), now, "en") === "Yesterday", "english yesterday");

assert(NEWS_SAMPLES.length >= 8 && NEWS_SAMPLES.length <= 12, "seed stays a short list");
assert(new Set(NEWS_SAMPLES.map((row) => row.title)).size === NEWS_SAMPLES.length, "one news card per product");
assert(NEWS_SAMPLES.every((row) => !row.title.includes("快訊") && !row.body.includes("快訊")), "titles are product names");
assert(
  NEWS_SAMPLES.every((row) => ["Topps", "Pokémon", "One Piece", "Riftbound", "Panini"].includes(row.source)),
  "source is the brand",
);
for (const source of ["Topps", "Pokémon", "One Piece", "Riftbound", "Panini"] as const) {
  const url = NEWS_BRAND_LOGOS[source];
  assert(newsBrandLogo(source) === url && url.startsWith("/brands/"), `${source} maps to a local logo`);
  const file = new URL(`../public${url}`, import.meta.url);
  assert(existsSync(file), `${source} logo is in public/brands`);
  assert(readFileSync(file).length > 1000, `${source} logo is a real file`);
}
assert(newsBrandLogo("Unknown") === null, "an unknown source has no logo");
assert(
  NEWS_SAMPLES.every((row) => row.coverUrl == null && newsBrandLogo(row.source)),
  "seeded rows keep cover empty so the brand logo is the thumb",
);
const sorted = [
  { id: "hot-old", createdAt: new Date("2026-10-01T00:00:00Z"), hot: true, eventAt: new Date("2026-01-01T00:00:00Z") },
  { id: "plain-mid", createdAt: new Date("2026-10-20T00:00:00Z"), hot: false, eventAt: null },
  { id: "hot-same", createdAt: new Date("2026-10-20T00:00:00Z"), hot: true, eventAt: new Date("2026-12-01T00:00:00Z") },
  { id: "newest", createdAt: new Date("2026-10-27T08:00:00Z"), hot: false, eventAt: new Date("2026-11-01T00:00:00Z") },
].sort(compareNewsByCreatedAt);
assert(sorted.map((row) => row.id).join(",") === "newest,plain-mid,hot-same,hot-old", "newest createdAt first; hot and eventAt do not reorder");

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
assert(list.includes("coverUrl={row.coverUrl}"), "the list prefers a product photo when coverUrl is set");
const cover = readFileSync(new URL("../components/news-cover.tsx", import.meta.url), "utf8");
assert(
  cover.includes("object-cover") && cover.indexOf("if (coverUrl)") < cover.indexOf("newsBrandLogo(source)"),
  "a real cover image wins when the caller passes one",
);
assert(detail.includes("coverUrl={row.coverUrl}"), "detail still prefers the product photo");
assert(cover.includes("bg-white") && cover.includes("object-contain"), "logo thumbs are white and contained");
assert(!cover.includes("slice(0, 1)") && !cover.includes("backgroundColor") && !cover.includes("color"), "news covers are not letter blocks");
assert(!list.includes("color=") && !detail.includes("color="), "list and detail do not pass a brand color");
assert(list.includes('orderBy: { createdAt: "desc" }') && !list.includes("compareNews") && !list.includes(".sort("), "the list query is newest ingest first");
assert(list.includes("row.updatedAt") && detail.includes("row.updatedAt"), "list and detail format updatedAt");
assert(!list.includes("row.createdAt") && !detail.includes("row.createdAt") && !list.includes("eventAt") && !detail.includes("eventAt"), "pages do not show createdAt or eventAt");
const kit = newsDetailCopy("盒內有 Chrome。\nSource: https://www.topps.com/pages/topps-collector-kit", "https://www.topps.com/pages/topps-collector-kit");
assert(kit.copy === "盒內有 Chrome。" && kit.sourceUrl === "https://www.topps.com/pages/topps-collector-kit", "a trailing source line is lifted out of the body");
const spaced = newsDetailCopy("內文。\n\nSource: https://example.com/a\n", "https://other.example/b");
assert(spaced.copy === "內文。" && spaced.sourceUrl === "https://example.com/a", "extra blank lines collapse, and the body url wins over linkUrl");
const seeded = newsDetailCopy("Riftbound Radiance 已經開賣。", "https://riftbound.leagueoflegends.com/en-us/news/");
assert(seeded.copy === "Riftbound Radiance 已經開賣。" && seeded.sourceUrl?.startsWith("https://"), "without a source line, https linkUrl is the outbound url");
assert(newsDetailCopy("內文。", "http://example.com/a").sourceUrl === null, "a non-https linkUrl is not linked");
assert(newsDetailCopy("見 Source: https://example.com/a 之後仲有字。", null).sourceUrl === null, "a source mention that is not the last line stays in the body");
const only = newsDetailCopy("Source: https://example.com/a", null);
assert(only.copy === "" && only.sourceUrl === "https://example.com/a", "a body that is only the source line has no copy");
assert(!detail.includes("睇原文") && !detail.includes("Read the source"), "detail does not add a second read-source link");
assert(detail.includes("newsDetailCopy(row.body, row.linkUrl)") && detail.includes("newsSourceLine") && detail.includes('"\\n\\n"'), "detail leaves one blank line above the source url");
assert(detail.includes('target="_blank"') && detail.includes('rel="noreferrer"') && detail.includes("text-link"), "the source url is the outbound link");
assert(tab.includes('href: "/news"') && tab.includes("新聞") && tab.includes('icon: "news"') && !tab.includes('href: "/dex"'), "bottom nav replaces the dex slot");
assert(shell.includes('href="/news"') && !shell.includes('href="/dex"'), "desktop nav does not link the dex");
assert(picker.includes("搵唔到？自己入卡名") && picker.includes("/api/catalog/suggest"), "the card picker can keep a typed name");
assert(collect.includes("CatalogTitleField") && sell.includes("CatalogTitleField") && sell.includes("hit.imageUrl"), "collect and sell fill the name from the catalog");

console.log("news ok");
