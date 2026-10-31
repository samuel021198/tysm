import { existsSync, readFileSync } from "fs";
import { NEWS_BRAND_LOGOS, NEWS_SAMPLES, compareNewsByEventAt, newsBrandLogo, newsDetailBlocks, newsDetailCopy, newsListTag, newsListTeaser, newsSortAt, newsSourceLine, newsUpdatedAgo } from "./news";

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
assert(newsUpdatedAgo(new Date("2026-10-25T23:30:00+08:00"), now, "zh-HK") === "25/10", "older than yesterday is D/M in zh-HK");
assert(newsUpdatedAgo(new Date("2026-10-20T10:00:00+08:00"), now, "zh-HK") === "20/10", "an older calendar day is D/M in zh-HK");
assert(newsUpdatedAgo(new Date("2026-10-20T10:00:00+08:00"), now, "en") === "10/20", "an older calendar day stays M/D in english");
assert(newsSourceLine("Topps", ago(3 * H), now, "zh-HK") === "Topps · 3 小時前", "the source line stamps the instant it is given");
assert(newsSourceLine("Topps", new Date("2026-10-20T10:00:00+08:00"), now, "zh-HK") === "Topps · 20/10", "the source line uses D/M in zh-HK");
assert(newsUpdatedAgo(ago(3 * H), now, "en") === "3 hours ago", "english hours");
assert(newsUpdatedAgo(new Date("2026-10-26T10:00:00+08:00"), now, "en") === "Yesterday", "english yesterday");
assert(newsUpdatedAgo(new Date("2026-11-06T00:00:00+08:00"), now, "zh-HK") === "6/11", "a future source time is D/M in zh-HK");
assert(newsUpdatedAgo(new Date("2026-11-06T00:00:00+08:00"), now, "en") === "11/6", "a future source time stays M/D in english");
assert(newsUpdatedAgo(new Date(now.getTime() + 60_000), now, "en") === "10/27", "a later clock today is M/D, not just now");
assert(newsUpdatedAgo(new Date(now.getTime() + 60_000), now, "zh-HK") === "27/10", "a later clock today is D/M in zh-HK");

assert(NEWS_SAMPLES.length >= 3 && NEWS_SAMPLES.length <= 12, "seed stays a short list");
const seededSlugs = new Set(NEWS_SAMPLES.map((row) => row.slug));
for (const slug of [
  "tysm-api-smoke-20261028",
  "topps-five-star-2026",
  "riftbound-radiance",
  "riftbound-kda-couture",
  "riftbound-gift-of-the-rift",
  "panini-prizm-wnba",
  "op-heroines-precious-box",
  "pokemon-delta-reign",
  "pokemon-mega-special-deck",
  "op-18-dominance",
]) {
  assert(!seededSlugs.has(slug), `${slug} is not revived by reseed`);
}
for (const slug of ["chrome-tennis-sapphire", "pokemon-30th-battle-deck", "op-eb05-heroines"]) {
  assert(seededSlugs.has(slug), `${slug} stays in the reseed list`);
}
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
  { id: "ingested-latest", createdAt: new Date("2026-10-28T00:00:00Z"), hot: false, eventAt: new Date("2026-02-01T00:00:00Z") },
  { id: "undated-new", createdAt: new Date("2026-10-27T00:00:00Z"), hot: true, eventAt: null },
].sort(compareNewsByEventAt);
assert(
  sorted.map((row) => row.id).join(",") === "hot-same,newest,undated-new,plain-mid,ingested-latest,hot-old",
  "source time first; null eventAt uses createdAt; hot does not pin",
);
assert(
  newsSortAt({ eventAt: new Date("2026-12-01T00:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z") }).toISOString() === "2026-12-01T00:00:00.000Z",
  "the stamp key prefers eventAt",
);
assert(newsSortAt({ eventAt: null, createdAt: new Date("2026-10-20T00:00:00Z") }).toISOString() === "2026-10-20T00:00:00.000Z", "the stamp key falls back to createdAt");
assert(newsSortAt({ eventAt: "2026-11-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" }).toISOString() === "2026-11-01T00:00:00.000Z", "an ISO eventAt from a raw row still stamps");

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
assert(
  list.includes('COALESCE("eventAt", "createdAt") DESC') && !list.includes("compareNews") && !list.includes(".sort(") && !list.includes('orderBy: { createdAt: "desc" }'),
  "the list query orders by source time, not ingest time",
);
assert(list.includes("newsSortAt(row)") && detail.includes("newsSortAt(row)"), "list and detail stamp eventAt, else createdAt");
assert(!list.includes("row.updatedAt") && !detail.includes("row.updatedAt"), "the stamp is not last-write time");
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
assert(detail.includes("newsDetailCopy(row.body, row.linkUrl)") && detail.includes("newsDetailBlocks(copy)") && detail.includes("newsSourceLine"), "detail turns label lines into fields");
assert(detail.includes("來源") && !detail.includes("Source:") && !detail.includes('"\\n\\n"'), "the outbound url is one short source link");
assert(detail.includes('fit="contain"') && detail.includes("max-h-[28rem]") && !detail.includes("aspect-[4/5]"), "a portrait cover is not cropped into a strip");
assert(detail.includes('target="_blank"') && detail.includes('rel="noreferrer"') && detail.includes("text-link"), "the source url is the outbound link");
assert(list.includes("newsListTag(") && list.includes("newsListTeaser(") && list.includes("row.hot") && list.includes("truncate"), "the list shows a tag and keeps the teaser to one line");
assert(tab.includes('href: "/news"') && tab.includes('label: "News"') && tab.includes('icon: "news"') && !tab.includes('href: "/dex"'), "bottom nav replaces the dex slot");
assert(shell.includes('href="/news"') && !shell.includes('href="/dex"'), "desktop nav does not link the dex");
assert(picker.includes("搵唔到？自己入卡名") && picker.includes("/api/catalog/suggest"), "the card picker can keep a typed name");
assert(collect.includes("CatalogTitleField") && sell.includes("CatalogTitleField") && sell.includes("hit.imageUrl"), "collect and sell fill the name from the catalog");

const oct30 = new Date("2026-10-30T00:00:00+08:00");
assert(
  newsListTeaser("Espeon／Umbreon ex | 30/10 | US$19.99／款", oct30, now, "zh-HK") === "Espeon／Umbreon ex | US$19.99／款",
  "teaser drops the date already on the meta line",
);
assert(newsListTeaser("EXTRA BOOSTER | 約 30/10 發售", oct30, now, "zh-HK") === "EXTRA BOOSTER | 發售", "an approximate date clause drops with the date");
assert(newsListTeaser("Sapphire Hobby | EQL | US$299.99", ago(8 * H), now, "zh-HK") === "Sapphire Hobby | EQL | US$299.99", "a relative meta line leaves the teaser alone");
assert(newsListTeaser("約 30/10 發售", ago(8 * H), now, "zh-HK") === "約 30/10 發售", "hours-ago meta does not strip a teaser date");
assert(newsListTeaser("patch 10/30/24 | PSA 9", oct30, now, "zh-HK") === "patch 10/30/24 | PSA 9", "a longer numeric date is not trimmed to the meta day");
assert(newsListTeaser("30/10", oct30, now, "zh-HK") === "", "a teaser that is only the meta date disappears");
assert(newsListTeaser("Espeon | 30/10 | US$19.99", oct30, now, "en") === "Espeon | US$19.99", "english M/D meta still strips the same calendar day");
assert(newsListTeaser("26/10 發售", new Date("2026-10-26T10:00:00+08:00"), now, "zh-HK") === "26/10 發售", "昨日 does not strip a teaser date");

assert(newsListTag({ source: "Pokémon", body: "", tag: "RELEASE" }, "zh-HK") === "發售", "release chip");
assert(newsListTag({ source: "Pokémon", body: "", tag: "RELEASE" }, "en") === "Release", "english release chip");
assert(newsListTag({ source: "One Piece", body: "", tag: "RESTOCK" }, "zh-HK") === "重販", "restock chip");
assert(newsListTag({ source: "Topps", body: "EQL", tag: "DATE" }, "zh-HK") === "抽選", "date chip is 抽選");
assert(newsListTag({ source: "Topps", body: "EQL", tag: "DATE" }, "en") === "Draw", "english date chip");
assert(newsListTag({ source: "Goldin", body: "", tag: "DATE" }, "zh-HK") === "成交", "Goldin is 成交, not 抽選");
assert(newsListTag({ source: "Topps", body: "成交價：US$1", tag: "DATE" }, "zh-HK") === "成交", "a hammer price is 成交, not 抽選");
assert(newsListTag({ source: "Goldin", body: "成交價：US$1", tag: "RELEASE" }, "en") === "Sold", "english sold chip");

const pokemonBody = `產品：30th Celebration Battle Deck（Espeon ex／Umbreon ex）
產品詳情：各有 60 張全息卡組。
售價：US$19.99／款
預訂/購買日期：30/10 發售（英／英文版）
預計出貨日：以官方／店舖為準
相關連結：https://www.pokemon.com/us/pokemon-tcg/product-gallery/deck

Source: https://www.pokemon.com/us/pokemon-tcg/product-gallery/deck
`;
const lifted = newsDetailCopy(pokemonBody, "https://www.pokemon.com/us/pokemon-tcg/product-gallery/deck");
const view = newsDetailBlocks(lifted.copy);
assert(lifted.sourceUrl === "https://www.pokemon.com/us/pokemon-tcg/product-gallery/deck", "trailing source still wins");
assert(view.blocks.length === 5 && view.blocks.every((block) => block.kind === "field"), "five product fields and no related-link card");
assert(
  view.blocks.some((block) => block.kind === "field" && block.label === "售價" && block.emphasis && block.value === "US$19.99／款"),
  "price is an emphasized card",
);
assert(!view.blocks.some((block) => block.kind === "field" && block.value.includes("http")), "the related url is not a field value");

const goldin = newsDetailBlocks(`拍品：2024-25 Panini Flawless Logoman
成交價：US$579,500
評級／編號：PSA MINT 9／PSA/DNA Auto GEM MT 10；#1/1
成交日期：17/10
拍賣場：Goldin
備註：
相關連結：https://goldin.co/item/sga
`);
const goldinFields = goldin.blocks.filter((block) => block.kind === "field");
assert(goldin.blocks.length === 5 && goldinFields.length === 5, "empty note and related link are not cards");
assert(goldinFields.some((block) => block.kind === "field" && block.label === "評級／編號" && !block.emphasis), "a combined grade line is one card");
assert(
  goldinFields.filter((block) => block.kind === "field" && block.emphasis).map((block) => (block.kind === "field" ? block.label : "")).join() === "成交價",
  "hammer price is the emphasized row",
);
assert(goldin.linkUrl === "https://goldin.co/item/sga", "related link is kept for the single source button");

const english = newsDetailBlocks("Product: Battle Deck\nPrice: US$19.99\nNotes:\nRelated link: https://example.com/a\n");
assert(english.blocks.length === 2, "english labels become cards; empty notes drop");
assert(english.blocks[0].kind === "field" && english.blocks[0].label === "Product" && !english.blocks[0].emphasis, "product is a plain card");
assert(english.blocks[1].kind === "field" && english.blocks[1].emphasis && english.blocks[1].value === "US$19.99", "Price is emphasized");
assert(english.linkUrl === "https://example.com/a", "english related link is the button url");

const mixed = newsDetailBlocks("開賣一句。\n售價：US$10\n");
assert(mixed.blocks[0].kind === "prose" && mixed.blocks[0].text === "開賣一句。", "a non-field line stays prose");
assert(mixed.blocks[1].kind === "field" && mixed.blocks[1].emphasis, "the price line is still a card");
const unknown = newsDetailBlocks("語言：日文\n");
assert(unknown.blocks.length === 1 && unknown.blocks[0].kind === "prose" && unknown.blocks[0].text === "語言：日文", "an unknown label stays in the body");
const mention = newsDetailBlocks(newsDetailCopy("見 Source: https://example.com/a 之後仲有字。", null).copy);
assert(
  mention.blocks.length === 1 && mention.blocks[0].kind === "prose" && mention.blocks[0].text.includes("https://example.com/a"),
  "a source mention that is not a label stays in prose",
);

console.log("news ok");
