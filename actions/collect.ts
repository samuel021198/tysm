"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Grader, RawGrade } from "@prisma/client";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hkdToCents, isAllowedMediaUrl } from "@/lib/format";
import { PhotoStoreError, storeUploadedImages } from "@/lib/r2";
import { createCollectionItem, syncListingInventory } from "@/lib/inventory";
import { saveListing, type ListingInput } from "@/lib/listings";
import { collectionVisibility } from "@/lib/posts";
import { parseGrade } from "@/lib/rules";
import { isBlocked } from "@/lib/social";
import { GRADERS, RAW } from "@/lib/sell-wizard";

async function viewer(next: string) {
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function parsePhotos(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("photos") || "[]")) as { url?: string; role?: string }[];
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((photo) => ({
        url: String(photo.url || "").trim(),
        role: (photo.role === "FRONT" || photo.role === "BACK" ? photo.role : "GALLERY") as "FRONT" | "BACK" | "GALLERY",
      }))
      .filter((photo) => photo.url)
      .slice(0, 12);
  } catch {
    return null;
  }
}

function conditionFrom(formData: FormData) {
  const track = formData.get("conditionTrack") === "GRADED" ? "GRADED" : "RAW";
  const raw = String(formData.get("rawGrade") || "").toUpperCase();
  const grader = String(formData.get("grader") || "").toUpperCase();
  const score = String(formData.get("gradeScore") || "");
  return {
    conditionTrack: track as "RAW" | "GRADED",
    rawGrade: track === "RAW" && RAW.includes(raw as RawGrade) ? (raw as RawGrade) : null,
    grader: track === "GRADED" && GRADERS.includes(grader as Grader) ? (grader as Grader) : null,
    gradeValue: track === "GRADED" ? parseGrade(grader, score) : null,
  };
}

async function readablePost(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { collectionItem: { select: { visibility: true, ownerId: true } } },
  });
  if (!post) return null;
  if (post.collectionItem?.visibility === "PRIVATE" && post.collectionItem.ownerId !== userId) return null;
  if (post.authorId !== userId && (await isBlocked(userId, post.authorId))) return null;
  return post;
}

export async function saveCollection(_prev: { error?: string } | null, formData: FormData) {
  const user = await viewer("/add");
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2 || title.length > 80) return { error: "title" };
  const note = String(formData.get("note") || "").trim();
  if (note.length > 500) return { error: "description" };
  const photos = parsePhotos(formData);
  if (!photos || photos.length < 1) return { error: "photos" };
  if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { error: "photo_url" };
  const cond = conditionFrom(formData);
  if (cond.conditionTrack === "RAW" && !cond.rawGrade) return { error: "grade" };
  if (cond.conditionTrack === "GRADED" && (cond.gradeValue == null || !cond.grader)) return { error: "grade" };
  const visibility = collectionVisibility(String(formData.get("visibility") || ""));
  const forSale = formData.get("forSale") === "on";

  if (forSale) {
    if (!user.phoneVerified) return { error: "phone" };
    if (photos.length < 2) return { error: "photos" };
    const categoryId = String(formData.get("categoryId") || "");
    const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
    const groupKey = category?.groupKey || category?.parent?.groupKey || "tcg";
    const input: ListingInput = {
      categoryId,
      title,
      description: note || `${title}。`,
      saleType: "BUY_NOW",
      priceCents: hkdToCents(String(formData.get("price") || "")),
      startPriceCents: null,
      auctionEndsAt: null,
      offersEnabled: false,
      minOfferCents: null,
      shippingDays: 3,
      shipSfCod: true,
      shipMeetup: false,
      shipPickup: false,
      meetupDistrict: null,
      meetupWindow: null,
      meetupNotes: null,
      quantity: 1,
      game: groupKey === "tcg" ? String(formData.get("game") || "").trim() || null : null,
      setName: groupKey === "tcg" ? String(formData.get("setName") || "").trim() || null : null,
      cardName: groupKey === "tcg" ? title : null,
      language: groupKey === "tcg" ? String(formData.get("language") || "").trim() || null : null,
      personName: groupKey === "tcg" ? null : title,
      seasonYear: groupKey === "tcg" ? null : String(formData.get("seasonYear") || "").trim() || null,
      brandSeries: groupKey === "tcg" ? null : String(formData.get("brandSeries") || "").trim() || null,
      conditionTrack: cond.conditionTrack,
      rawGrade: cond.rawGrade,
      grader: cond.grader,
      gradeValue: cond.gradeValue,
      certNumber: null,
      videoUrl: null,
      photos,
      publishAt: null,
      intent: "publish",
    };
    const result = await saveListing(user.id, input);
    if (!result.ok) return { error: result.error };
    const synced = await syncListingInventory(result.id, { visibility });
    revalidatePath("/");
    revalidatePath("/me");
    revalidatePath("/search");
    redirect(synced.postId ? `/post/${synced.postId}?ok=posted` : `/listing/${result.id}?ok=published`);
  }

  let created: Awaited<ReturnType<typeof createCollectionItem>>;
  try {
    created = await createCollectionItem({
      ownerId: user.id,
      title,
      note,
      visibility,
      conditionTrack: cond.conditionTrack,
      rawGrade: cond.rawGrade,
      grader: cond.grader,
      gradeValue: cond.gradeValue,
      photos,
      publishToFeed: formData.get("publish") === "on",
    });
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return { error: "photo_url" };
  }
  revalidatePath("/");
  revalidatePath("/me");
  redirect(created.postId ? `/post/${created.postId}?ok=posted` : "/me?tab=box&ok=collected");
}

export async function savePost(_prev: { error?: string } | null, formData: FormData) {
  const user = await viewer("/add?kind=post");
  const body = String(formData.get("body") || "").trim();
  const photos = parsePhotos(formData) ?? [];
  const alsoList = formData.get("alsoList") === "on";
  if ((body.length < 1 && photos.length < 1) || body.length > 500) return { error: "post" };
  if (photos.length > (alsoList ? 12 : 6)) return { error: "photos" };
  if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { error: "photo_url" };
  if (!alsoList) {
    let stored = photos;
    try {
      stored = await storeUploadedImages(photos, "uploads/posts");
    } catch (error) {
      if (!(error instanceof PhotoStoreError)) throw error;
      return { error: "photo_url" };
    }
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        body,
        photos: { create: stored.map((photo, position) => ({ url: photo.url, position })) },
      },
    });
    revalidatePath("/");
    revalidatePath("/me");
    redirect(`/post/${post.id}?ok=posted`);
  }
  if (!user.phoneVerified) return { error: "phone" };
  if (photos.length < 2) return { error: "photos" };
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2 || title.length > 80) return { error: "title" };
  const cond = conditionFrom(formData);
  if (cond.conditionTrack === "RAW" && !cond.rawGrade) return { error: "grade" };
  if (cond.conditionTrack === "GRADED" && (cond.gradeValue == null || !cond.grader)) return { error: "grade" };
  const categoryId = String(formData.get("categoryId") || "");
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
  const groupKey = category?.groupKey || category?.parent?.groupKey || "tcg";
  const input: ListingInput = {
    categoryId,
    title,
    description: body || `${title}。`,
    saleType: "BUY_NOW",
    priceCents: hkdToCents(String(formData.get("price") || "")),
    startPriceCents: null,
    auctionEndsAt: null,
    offersEnabled: false,
    minOfferCents: null,
    shippingDays: 3,
    shipSfCod: true,
    shipMeetup: false,
    shipPickup: false,
    meetupDistrict: null,
    meetupWindow: null,
    meetupNotes: null,
    quantity: 1,
    game: groupKey === "tcg" ? String(formData.get("game") || "").trim() || null : null,
    setName: groupKey === "tcg" ? String(formData.get("setName") || "").trim() || null : null,
    cardName: groupKey === "tcg" ? String(formData.get("cardName") || "").trim() || title : null,
    language: groupKey === "tcg" ? String(formData.get("language") || "").trim() || null : null,
    personName: groupKey === "tcg" ? null : String(formData.get("personName") || "").trim() || title,
    seasonYear: groupKey === "tcg" ? null : String(formData.get("seasonYear") || "").trim() || null,
    brandSeries: groupKey === "tcg" ? null : String(formData.get("brandSeries") || "").trim() || null,
    conditionTrack: cond.conditionTrack,
    rawGrade: cond.rawGrade,
    grader: cond.grader,
    gradeValue: cond.gradeValue,
    certNumber: null,
    videoUrl: null,
    photos,
    publishAt: null,
    intent: "publish",
    catalogCardId: String(formData.get("catalogCardId") || "").trim() || null,
  };
  const result = await saveListing(user.id, input);
  if (!result.ok) return { error: result.error };
  const synced = await syncListingInventory(result.id, { postBody: body });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/search");
  redirect(synced.postId ? `/post/${synced.postId}?ok=posted` : `/listing/${result.id}?ok=published`);
}

export async function togglePostLike(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  const next = String(formData.get("next") || `/post/${postId}`);
  const user = await viewer(next);
  const post = await readablePost(postId, user.id);
  if (!post) redirect("/?err=forbidden");
  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId, userId: user.id } } });
  if (existing) await prisma.postLike.delete({ where: { id: existing.id } });
  else await prisma.postLike.create({ data: { postId, userId: user.id } });
  // redirect(next) is a navigation. On the feed, next is the current URL, so the
  // app router remounts the page (loading.tsx) and jumps scroll. Revalidate instead.
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/me");
}

export async function addComment(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  const user = await viewer(`/post/${postId}`);
  const post = await readablePost(postId, user.id);
  if (!post) redirect("/?err=forbidden");
  const body = String(formData.get("body") || "").trim();
  if (body.length < 1 || body.length > 300) redirect(`/post/${postId}?err=comment`);
  await prisma.postComment.create({ data: { postId, authorId: user.id, body } });
  // redirect(`/post/${id}#comments`) is the same same-page navigation as a like.
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}

export async function toggleCollectionVisibility(formData: FormData) {
  const user = await viewer("/me?tab=box");
  const id = String(formData.get("id") || "");
  const item = await prisma.collectionItem.findUnique({ where: { id } });
  if (!item || item.ownerId !== user.id) redirect("/me?tab=box&err=forbidden");
  await prisma.collectionItem.update({
    where: { id },
    data: { visibility: item.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" },
  });
  revalidatePath("/me");
  revalidatePath("/");
  redirect("/me?tab=box&ok=saved");
}
