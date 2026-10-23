"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAllowedMediaUrl } from "@/lib/format";
import { isBlocked } from "@/lib/social";
import { isStoryActive, storyExpiresAt } from "@/lib/stories";

export async function publishStory(_prev: { error?: string } | null, formData: FormData) {
  const user = await getViewer();
  if (!user) redirect("/login?next=/story/new");
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  if (!imageUrl || !isAllowedMediaUrl(imageUrl)) return { error: "story_photo" };
  const createdAt = new Date();
  await prisma.story.create({
    data: { authorId: user.id, imageUrl, createdAt, expiresAt: storyExpiresAt(createdAt) },
  });
  revalidatePath("/");
  redirect("/?ok=story");
}

export async function markStorySeen(storyId: string) {
  const user = await getViewer();
  if (!user || !storyId) return;
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true, expiresAt: true },
  });
  if (!story || !isStoryActive(story.expiresAt)) return;
  if (story.authorId !== user.id && (await isBlocked(user.id, story.authorId))) return;
  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId: user.id } },
    update: {},
    create: { storyId, userId: user.id },
  });
}
