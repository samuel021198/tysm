import { activityLine, MEANINGFUL_UPDATE_MS, relativeTime } from "./time";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-10-27T15:00:00+08:00");
const H = 60 * 60 * 1000;
const ago = (ms: number) => new Date(now.getTime() - ms);

assert(relativeTime(ago(3 * H), now, "zh-HK") === "3 小時前", "hours ago");
assert(relativeTime(ago(3 * H), now, "en") === "3 hours ago", "english hours");

const published = ago(3 * H);
assert(activityLine(published, null, now, "zh-HK").text === "3 小時前", "no update stays on the publish line");
assert(activityLine(published, published, now, "en").text === "3 hours ago", "an equal updatedAt is not an update");
assert(
  activityLine(published, new Date(published.getTime() + MEANINGFUL_UPDATE_MS - 1), now, "zh-HK").text === "3 小時前",
  "clock skew stays on the publish line",
);
assert(
  activityLine(published, new Date(published.getTime() - 5_000), now, "en").text === "3 hours ago",
  "an earlier updatedAt stays on the publish line",
);

const created = new Date("2026-10-20T10:00:00+08:00");
const edited = ago(3 * H);
const zh = activityLine(created, edited, now, "zh-HK");
const en = activityLine(created, edited, now, "en");
assert(zh.text === "更新於 · 3 小時前" && zh.at.getTime() === edited.getTime(), "a later edit is one updated line");
assert(en.text === "Updated · 3 hours ago" && en.at.getTime() === edited.getTime(), "english updated line");
assert(
  activityLine(created, new Date(created.getTime() + MEANINGFUL_UPDATE_MS), now, "zh-HK").text.startsWith("更新於 · "),
  "the threshold itself counts as an update",
);

console.log("time ok");
