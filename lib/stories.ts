export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export function storyExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STORY_TTL_MS);
}

/** Expired at the exact `expiresAt` instant so a 24h story does not linger. */
export function isStoryActive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

/** Sweep deletes these. The same instant `isStoryActive` becomes false, so a live ring is never collected. */
export function storyReadyForGc(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function expiredStoryWhere(now: Date) {
  return { expiresAt: { lte: now } };
}

export type StoryPerson = { id: string; nickname: string; avatarUrl: string | null };

export type StoryRow = {
  id: string;
  authorId: string;
  imageUrl: string;
  createdAt: Date;
  expiresAt: Date;
  author: StoryPerson;
};

export type StoryFrame = {
  id: string;
  imageUrl: string;
  createdAt: string;
  seen: boolean;
};

export type StoryRing = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  mine: boolean;
  seen: boolean;
  stories: StoryFrame[];
};

/**
 * Home rings: your own row first (a "+" always opens a new story), then people
 * you follow who still have an active story. If that follow set is empty, fill
 * from everyone else's active stories — the same suggestion pool as the home
 * feed — so a demo account that follows the wrong sellers still sees rings.
 * Guests only get the suggestion pool. Expired rows are dropped here; the query
 * also filters `expiresAt`.
 * ponytail: at most 16 rings, ranked in memory. Upgrade path: keyset by latest story.
 */
export function buildStoryRings(input: {
  viewer: StoryPerson | null;
  followedIds: Iterable<string>;
  stories: StoryRow[];
  viewedIds: Iterable<string>;
  now?: Date;
}): { rings: StoryRing[]; audience: "following" | "suggested" } {
  const now = input.now ?? new Date();
  const viewed = new Set(input.viewedIds);
  const followed = new Set(input.followedIds);
  const grouped = new Map<string, StoryRow[]>();
  for (const story of input.stories) {
    if (!isStoryActive(story.expiresAt, now)) continue;
    const rows = grouped.get(story.authorId) ?? [];
    rows.push(story);
    grouped.set(story.authorId, rows);
  }

  function ringFor(person: StoryPerson, mine: boolean): StoryRing {
    const stories = (grouped.get(person.id) ?? [])
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((row) => ({
        id: row.id,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt.toISOString(),
        seen: viewed.has(row.id),
      }));
    return {
      userId: person.id,
      nickname: person.nickname,
      avatarUrl: person.avatarUrl,
      mine,
      seen: stories.length > 0 && stories.every((story) => story.seen),
      stories,
    };
  }

  function byFreshness(a: StoryRing, b: StoryRing) {
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    const aLast = a.stories[a.stories.length - 1]?.createdAt ?? "";
    const bLast = b.stories[b.stories.length - 1]?.createdAt ?? "";
    return bLast.localeCompare(aLast);
  }

  const following = [...grouped.values()]
    .filter((rows) => followed.has(rows[0].authorId) && rows[0].authorId !== input.viewer?.id)
    .map((rows) => ringFor(rows[0].author, false))
    .sort(byFreshness);

  const audience = following.length > 0 ? "following" : "suggested";
  const others =
    audience === "following"
      ? following
      : [...grouped.values()]
          .filter((rows) => rows[0].authorId !== input.viewer?.id)
          .map((rows) => ringFor(rows[0].author, false))
          .sort(byFreshness);

  const self = input.viewer ? ringFor(input.viewer, true) : null;
  return { rings: [...(self ? [self] : []), ...others].slice(0, 16), audience };
}
