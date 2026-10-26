import { prisma } from "./db";
import { buildStoryRings, expiredStoryWhere, type StoryPerson } from "./stories";

/** Hard-delete stories whose 24h ring has ended. Idempotent. Image bytes live on the row, so the delete drops them too. */
export async function purgeExpiredStories(now = new Date()) {
  const result = await prisma.story.deleteMany({ where: expiredStoryWhere(now) });
  return result.count;
}

export async function loadStoryRings(viewerId: string | null, hidden: string[]) {
  const now = new Date();
  const [stories, follows, viewer, views] = await Promise.all([
    prisma.story.findMany({
      where: {
        expiresAt: { gt: now },
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      },
      // imageUrl stays off this payload. The rail fetches one frame when it is opened.
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        expiresAt: true,
        author: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 24,
    }),
    viewerId
      ? prisma.follow.findMany({ where: { followerId: viewerId }, select: { sellerId: true } })
      : Promise.resolve([]),
    viewerId
      ? prisma.user.findUnique({ where: { id: viewerId }, select: { id: true, nickname: true, avatarUrl: true } })
      : Promise.resolve(null),
    viewerId
      ? prisma.storyView.findMany({
          where: { userId: viewerId, story: { expiresAt: { gt: now } } },
          select: { storyId: true },
        })
      : Promise.resolve([]),
  ]);
  const person: StoryPerson | null = viewer
    ? { id: viewer.id, nickname: viewer.nickname, avatarUrl: viewer.avatarUrl }
    : null;
  return buildStoryRings({
    viewer: person,
    followedIds: follows.map((row) => row.sellerId),
    stories: stories.map((row) => ({ ...row, imageUrl: "" })),
    viewedIds: views.map((row) => row.storyId),
    now,
  });
}
