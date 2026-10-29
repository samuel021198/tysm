"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAllowedMediaUrl, safeNext } from "@/lib/format";
import { shareTarget } from "@/lib/share";
import { PhotoStoreError, storeUploadedImage } from "@/lib/r2";
import { openHandover } from "@/lib/deals";
import { notificationTarget } from "@/lib/notify";
import { isBlocked, notify, notifyKind } from "@/lib/social";
import { REVIEW_WINDOW_MS } from "@/lib/rules";

async function viewer(next: string) {
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function toggleFavorite(formData: FormData) {
  const id = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${id}`);
  const existing = await prisma.favorite.findUnique({ where: { userId_listingId: { userId: user.id, listingId: id } } });
  // Raw count: Prisma @updatedAt would read a favorite as a price or content edit.
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    await prisma.$executeRaw`UPDATE "Listing" SET "favoriteCount" = "favoriteCount" - 1 WHERE "id" = ${id}`;
  } else {
    await prisma.favorite.create({ data: { userId: user.id, listingId: id } });
    await prisma.$executeRaw`UPDATE "Listing" SET "favoriteCount" = "favoriteCount" + 1 WHERE "id" = ${id}`;
  }
  // Same as post likes: redirect(next) reloads whatever page the heart was on.
  revalidatePath(`/listing/${id}`);
  revalidatePath("/me");
  revalidatePath("/me/favorites");
  const nextPath = String(formData.get("next") || "").split("?")[0];
  if (nextPath.startsWith("/") && nextPath !== `/listing/${id}` && nextPath !== "/me/favorites") revalidatePath(nextPath);
}

export async function toggleFollow(formData: FormData) {
  const sellerId = String(formData.get("sellerId") || "");
  const user = await viewer(`/shop/${sellerId}`);
  if (sellerId === user.id) redirect(`/shop/${sellerId}?err=own`);
  const existing = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId: user.id, sellerId } },
  });
  if (existing) await prisma.follow.delete({ where: { id: existing.id } });
  else await prisma.follow.create({ data: { followerId: user.id, sellerId } });
  redirect(`/shop/${sellerId}?ok=saved`);
}

export async function toggleBlock(formData: FormData) {
  const blockedId = String(formData.get("userId") || "");
  const user = await viewer(`/shop/${blockedId}`);
  if (blockedId === user.id) redirect(`/shop/${blockedId}?err=own`);
  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
  });
  if (existing) await prisma.block.delete({ where: { id: existing.id } });
  else await prisma.block.create({ data: { blockerId: user.id, blockedId } });
  redirect(`/shop/${blockedId}?ok=saved`);
}

export async function reportAction(formData: FormData) {
  const targetId = String(formData.get("targetId") || "");
  const raw = String(formData.get("targetType") || "");
  const targetType = raw === "USER" ? "USER" : raw === "POST" ? "POST" : "LISTING";
  const fallback = targetType === "USER" ? `/shop/${targetId}` : targetType === "POST" ? `/post/${targetId}` : `/listing/${targetId}`;
  const requested = String(formData.get("next") || "");
  const next = (requested ? safeNext(requested) : fallback).split("?")[0].split("#")[0] || "/";
  const user = await viewer(next);
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 4) redirect(`${next}?err=dispute`);
  if (targetType === "USER" && targetId === user.id) redirect(`${next}?err=own`);
  if (targetType === "POST") {
    const post = await prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } });
    if (!post || post.authorId === user.id) redirect(`${next}?err=forbidden`);
  }
  await prisma.report.create({ data: { reporterId: user.id, targetType, targetId, reason: reason.slice(0, 1000) } });
  redirect(`${next}?ok=report`);
}

export async function startHandover(formData: FormData) {
  const listingId = String(formData.get("listingId") || "");
  const postId = String(formData.get("postId") || "") || null;
  const back = postId ? `/post/${postId}` : `/listing/${listingId}`;
  const user = await viewer(back);
  const result = await openHandover(user.id, { listingId, postId });
  if (!result.ok) redirect(`${back}?err=${result.error}`);
  revalidatePath(`/listing/${listingId}`);
  redirect(`/messages/${result.threadId}`);
}

export async function openThread(formData: FormData) {
  const listingId = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${listingId}`);
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId === user.id) redirect(`/listing/${listingId}?err=own`);
  if (await isBlocked(user.id, listing.sellerId)) redirect(`/listing/${listingId}?err=blocked`);
  const existing = await prisma.messageThread.findFirst({
    where: { listingId, buyerId: user.id, sellerId: listing.sellerId },
  });
  const thread =
    existing ??
    (await prisma.messageThread.create({
      data: { listingId, buyerId: user.id, sellerId: listing.sellerId },
    }));
  redirect(`/messages/${thread.id}`);
}

export async function sendMessage(formData: FormData) {
  const threadId = String(formData.get("threadId") || "");
  const user = await viewer(`/messages/${threadId}`);
  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
  if (!thread || (thread.buyerId !== user.id && thread.sellerId !== user.id)) redirect("/messages?err=forbidden");
  const other = thread.buyerId === user.id ? thread.sellerId : thread.buyerId;
  if (await isBlocked(user.id, other)) redirect(`/messages/${threadId}?err=blocked`);
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const body = String(formData.get("body") || "").trim() || (imageUrl ? "（相片）" : "");
  if (body.length < 1 || body.length > 2000) redirect(`/messages/${threadId}?err=description`);
  if (imageUrl && !isAllowedMediaUrl(imageUrl)) redirect(`/messages/${threadId}?err=photo_url`);
  let stored = imageUrl;
  try {
    if (imageUrl) stored = await storeUploadedImage(imageUrl, "uploads/messages");
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    redirect(`/messages/${threadId}?err=photo_url`);
  }
  await prisma.message.create({
    data: { threadId, senderId: user.id, body, imageUrl: stored || null },
  });
  await prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  await notifyKind(other, "message", `/messages/${threadId}`, body);
  // Same-path redirect() remounts the thread (Next 15). Refresh the list in place.
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
}

export async function shareIntoThread(formData: FormData) {
  const threadId = String(formData.get("threadId") || "");
  const path = shareTarget(formData.get("path"));
  const back = path ? `/messages?share=${encodeURIComponent(path)}` : "/messages";
  const user = await viewer(back);
  if (!path) redirect("/messages?err=forbidden");
  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
  if (!thread || (thread.buyerId !== user.id && thread.sellerId !== user.id)) redirect(`${back}&err=forbidden`);
  const other = thread.buyerId === user.id ? thread.sellerId : thread.buyerId;
  if (await isBlocked(user.id, other)) redirect(`${back}&err=blocked`);
  await prisma.message.create({ data: { threadId, senderId: user.id, body: path } });
  await prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  await notifyKind(other, "message", `/messages/${threadId}`, path);
  redirect(`/messages/${threadId}`);
}

export async function markThreadRead(threadId: string) {
  const user = await getViewer();
  if (!user) return;
  await prisma.message.updateMany({
    where: { threadId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function pingView(listingId: string) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const seen = new Set((jar.get("tysm_seen")?.value || "").split(",").filter(Boolean));
  if (!seen.has(listingId)) {
    // Raw count: a view is not a re-list or a price change.
    await prisma.$executeRaw`UPDATE "Listing" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${listingId}`.catch(() => undefined);
    seen.add(listingId);
    jar.set("tysm_seen", [...seen].slice(-40).join(","), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  const user = await getViewer();
  if (user) {
    await prisma.viewHistory.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: { viewedAt: new Date() },
    });
  }
}

export async function reviewAction(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${orderId}`);
  const stars = Number(formData.get("stars") || 0);
  const comment = String(formData.get("comment") || "").trim();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "COMPLETED" || !order.completedAt) redirect(`/orders/${orderId}?err=review`);
  if (order.completedAt.getTime() + REVIEW_WINDOW_MS < Date.now()) redirect(`/orders/${orderId}?err=review`);
  const subjectId = order.buyerId === user.id ? order.sellerId : order.sellerId === user.id ? order.buyerId : "";
  if (!subjectId || stars < 1 || stars > 5 || comment.length < 1 || comment.length > 1000) {
    redirect(`/orders/${orderId}?err=review`);
  }
  try {
    await prisma.review.create({ data: { orderId, authorId: user.id, subjectId, stars, comment } });
  } catch {
    redirect(`/orders/${orderId}?err=review`);
  }
  await notify(subjectId, "review", "你收到一個評價", comment.slice(0, 80), `/orders/${orderId}`);
  redirect(`/orders/${orderId}?ok=review`);
}

export async function replyReviewAction(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${orderId}`);
  const review = await prisma.review.findUnique({ where: { id: String(formData.get("reviewId") || "") } });
  const reply = String(formData.get("reply") || "").trim();
  if (!review || review.subjectId !== user.id || review.reply || reply.length < 1 || reply.length > 1000) {
    redirect(`/orders/${orderId}?err=review`);
  }
  await prisma.review.update({ where: { id: review.id }, data: { reply, repliedAt: new Date() } });
  redirect(`/orders/${orderId}?ok=saved`);
}

export async function markNotifications() {
  const user = await viewer("/notifications");
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  redirect("/notifications");
}

export async function openNotification(formData: FormData) {
  const user = await viewer("/notifications");
  const id = String(formData.get("id") || "");
  const row = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!row) redirect("/notifications");
  if (!row.readAt) {
    await prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
  }
  redirect(notificationTarget(row.href));
}
