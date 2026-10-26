import { readFileSync } from "node:fs";
import { buildStoryRings, expiredStoryWhere, isStoryActive, storyExpiresAt, storyReadyForGc, STORY_TTL_MS, type StoryPerson, type StoryRow } from "./stories";
import { clampPct, clampScale, containRect } from "./story-edit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const t0 = new Date("2026-10-23T00:00:00Z");
assert(storyExpiresAt(t0).getTime() - t0.getTime() === STORY_TTL_MS, "stories last 24 hours");
assert(isStoryActive(new Date(t0.getTime() + 1000), t0), "future expiry stays on the rail");
assert(!isStoryActive(t0, t0), "the expiry instant is already hidden");
assert(!isStoryActive(new Date(t0.getTime() - 1), t0), "past expiry is hidden");
assert(storyReadyForGc(t0, t0) && expiredStoryWhere(t0).expiresAt.lte.getTime() === t0.getTime(), "gc deletes the expiry instant");
assert(!storyReadyForGc(new Date(t0.getTime() + 1), t0), "a live story is not collected");
const orders = readFileSync(new URL("./orders.ts", import.meta.url), "utf8");
const feedSrc = readFileSync(new URL("./story-feed.ts", import.meta.url), "utf8");
assert(orders.includes("purgeExpiredStories"), "sweep deletes expired stories");
assert(feedSrc.includes("expiredStoryWhere") && !feedSrc.includes("imageUrl: true"), "gc shares the cutoff and the rail omits image bytes");

const ming: StoryPerson = { id: "user_ming", nickname: "卡牌阿明", avatarUrl: null };
const star: StoryPerson = { id: "user_star", nickname: "星光收藏", avatarUrl: null };
const mei: StoryPerson = { id: "user_mei", nickname: "陳小美", avatarUrl: null };
const lam: StoryPerson = { id: "user_lam", nickname: "林小姐", avatarUrl: null };

function story(id: string, author: StoryPerson, hoursFromNow: number, ageMs = 60_000): StoryRow {
  return {
    id,
    authorId: author.id,
    imageUrl: "/demo/cards/seed_charizard.svg",
    createdAt: new Date(t0.getTime() - ageMs),
    expiresAt: new Date(t0.getTime() + hoursFromNow * 3_600_000),
    author,
  };
}

const rows = [
  story("s_ming", ming, 20, 120_000),
  story("s_star", star, 10, 90_000),
  story("s_mei", mei, 5, 30_000),
  story("s_lam", lam, -2, 86_400_000),
];

const followed = buildStoryRings({
  viewer: mei,
  followedIds: ["user_ming", "user_star"],
  stories: rows,
  viewedIds: ["s_star"],
  now: t0,
});
assert(followed.audience === "following", "rings prefer people you follow");
assert(
  followed.rings.map((ring) => ring.userId).join() === "user_mei,user_ming,user_star",
  "self, then unseen follows, then seen follows",
);
assert(followed.rings[0].stories.length === 1 && followed.rings[0].seen === false, "own unseen story keeps the ring fresh");
assert(followed.rings[1].seen === false, "unseen follow stays fresh");
assert(followed.rings[2].seen === true, "a viewed follow is muted");
assert(!followed.rings.some((ring) => ring.userId === "user_lam"), "expired stories stay off the rail");

const two = buildStoryRings({
  viewer: mei,
  followedIds: ["user_ming"],
  stories: [story("a", ming, 10, 90_000), story("b", ming, 12, 30_000)],
  viewedIds: ["a"],
  now: t0,
});
const mingRing = two.rings.find((ring) => ring.userId === "user_ming");
assert(mingRing?.stories.map((frame) => frame.id).join() === "a,b", "frames play oldest first");
assert(mingRing?.seen === false, "one unseen frame keeps the ring fresh");

const emptyFollow = buildStoryRings({
  viewer: { id: "user_ho", nickname: "何生", avatarUrl: null },
  followedIds: ["user_ken"],
  stories: rows,
  viewedIds: [],
  now: t0,
});
assert(emptyFollow.audience === "suggested", "no followed stories falls back to suggestions");
assert(emptyFollow.rings[0].userId === "user_ho" && emptyFollow.rings[0].stories.length === 0, "self plus shows with no story");
assert(emptyFollow.rings.some((ring) => ring.userId === "user_ming"), "suggested rings include other active authors");
assert(!emptyFollow.rings.some((ring) => ring.userId === "user_lam"), "expired stay hidden in the fallback");

const guest = buildStoryRings({ viewer: null, followedIds: [], stories: rows, viewedIds: [], now: t0 });
assert(guest.audience === "suggested", "guests see the suggestion pool");
assert(guest.rings.length === 3, "guest rings are the three live authors");
assert(!guest.rings.some((ring) => ring.mine), "guests have no self ring");
assert(clampPct(120) === 96 && clampPct(-4) === 4, "overlay position stays on the photo");
assert(clampScale(4) === 2.6 && clampScale(0.2) === 0.6, "sticker scale stays in range");
assert(containRect(90, 160, 90, 160).w === 90, "a story-shaped photo fills the stage");
assert(containRect(100, 100, 200, 100).w === 100 && containRect(100, 100, 200, 100).h === 50, "a landscape photo is contained");

console.log("stories ok");
