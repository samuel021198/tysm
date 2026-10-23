import { prisma } from "./db";
import { buildStoryRings, type StoryPerson } from "./stories";

export async function loadStoryRings(viewerId: string | null, hidden: string[]) {
  const now = new Date();
  const [stories, follows, viewer, views] = await Promise.all([
    prisma.story.findMany({
      where: {
        expiresAt: { gt: now },
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      },
      include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
      take: 80,
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
    stories,
    viewedIds: views.map((row) => row.storyId),
    now,
  });
}
