import { readFileSync } from "fs";
import { postQueryWhere } from "./search";
import { toPostCard } from "./posts";
import {
  TOPIC_DEFAULTS,
  displayCaption,
  hashPartial,
  insertTag,
  normalizeTag,
  tagLookup,
  tagsFromCaption,
  topicSuggestions,
} from "./tags";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(normalizeTag("#pc") === "PC" && normalizeTag("fs") === "FS" && normalizeTag("ISO") === "ISO", "short codes stay uppercase");
assert(normalizeTag("op09") === "OP09" && normalizeTag("psa10") === "PSA10", "set codes uppercase");
assert(normalizeTag("charizard") === "Charizard" && normalizeTag("#賣") === "賣", "names and Chinese topics keep their form");
assert(normalizeTag("") === null && normalizeTag("#") === null && normalizeTag("a".repeat(25)) === null, "blank and oversized topics drop");
assert(tagsFromCaption("收藏。 #PC #pc #賣 #Charizard").join() === "PC,賣,Charizard", "caption topics dedupe and keep order");
assert(tagsFromCaption("求 #OP09 同 #寶可夢").join() === "OP09,寶可夢", "Chinese topics parse inside a sentence");
assert(displayCaption("卡面乾淨。 #FS #Charizard") === "卡面乾淨。", "display moves topics off the caption");
assert(displayCaption("想搵 #ISO 同系列") === "想搵 同系列", "an inline topic leaves the sentence");
assert(hashPartial("你好 #ch", 7) === "ch" && hashPartial("你好", 2) === null, "the open hash is the suggestion query");
assert(topicSuggestions(null).join() === TOPIC_DEFAULTS.join(), "idle suggestions are the priority chips");
assert(topicSuggestions("ch")[0] === "Charizard" && topicSuggestions("寶").includes("寶可夢"), "typing filters Chinese and English");
const inserted = insertTag("今日收卡", 5, "PC");
assert(inserted.text === "今日收卡 #PC " && tagsFromCaption(inserted.text).join() === "PC", "a chip appends a topic");
const replaced = insertTag("睇下 #op", 7, "OP09");
assert(replaced.text.startsWith("睇下 #OP09") && tagsFromCaption(replaced.text).join() === "OP09", "a chip finishes the hash being typed");
assert(tagLookup("#PC").includes("PC") && tagLookup("pc").includes("PC"), "search folds the hash and the case");

const where = JSON.stringify(postQueryWhere("#PC"));
assert(where.includes("tags") && where.includes("PC"), "a topic query hits the stored tags");
const card = toPostCard({
  postId: "p",
  body: "留喺收藏。 #PC",
  tags: ["PC"],
  author: { id: "u", nickname: "Kai", avatarUrl: null },
  photos: [],
  item: null,
  likeCount: 0,
  commentCount: 0,
  liked: false,
  saved: false,
});
assert(card.tags.join() === "PC", "a post card keeps its topics");
assert(card.caption === "留喺收藏。", "the feed caption keeps the sentence and drops the topic");

const field = readFileSync(new URL("../components/topic-field.tsx", import.meta.url), "utf8");
const chips = readFileSync(new URL("../components/topic-chips.tsx", import.meta.url), "utf8");
const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../components/catalog-title-field.tsx", import.meta.url), "utf8");
const cardUi = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
assert(field.includes("話題") && field.includes("Topics") && !/hashtag/i.test(field), "the composer says 話題");
assert(chips.includes("text-[11px]") && chips.includes("findHref") && !/hashtag/i.test(chips), "chips stay small and open search");
assert(cardUi.includes("TopicChips") && cardUi.includes("aspect-[4/5]"), "feed chips sit on the card, the cover stays 4:5");
const titleAt = cardUi.indexOf("post.cardName");
const captionAt = cardUi.indexOf("post.caption");
const priceAt = cardUi.indexOf("{price}");
const chipsAt = cardUi.indexOf("<TopicChips");
assert(titleAt >= 0 && captionAt > titleAt && priceAt > captionAt && chipsAt > priceAt, "caption sits above the price; chips stay under it");
assert(cardUi.includes("line-clamp-2") && cardUi.includes('tx(locale, "更多", "More")') && cardUi.includes("setOpen(true)"), "a feed caption clamps two lines and 更多 expands it");
assert(cardUi.includes("cloneNode") && !cardUi.includes("scrollHeight > el.clientHeight"), "更多 compares an unclamped copy; line-clamp scrollHeight matches the box");
assert(cardUi.includes("!gallery && post.caption"), "detail keeps the full caption outside the card");
assert(sell.includes("TopicSuggest") && catalog.includes("搵唔到？自己入卡名"), "listing copy keeps topics and the own-name line");

console.log("tags ok");
