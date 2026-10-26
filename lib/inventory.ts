import type { ConditionTrack, Grader, RawGrade } from "@prisma/client";
import { prisma } from "./db";
import { shouldPublishPost, type CollectionVisibility } from "./posts";
import { storeUploadedImages } from "./r2";

const listingForSync = {
  photos: { orderBy: { position: "asc" as const } },
} as const;

/** Keep the collection row attached to this listing and post once the sale is live. */
export async function syncListingInventory(listingId: string, opts?: { visibility?: CollectionVisibility; postBody?: string }) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: listingForSync });
  if (!listing) return { itemId: null as string | null, postId: null as string | null };
  const existing = await prisma.collectionItem.findUnique({ where: { listingId } });
  // Drafts stay out of the binder until the listing is actually live.
  if (!existing && listing.status !== "ACTIVE") {
    return { itemId: null, postId: null };
  }
  const fields = {
    title: listing.title,
    cardName: listing.cardName || listing.personName || listing.title,
    conditionTrack: listing.conditionTrack,
    rawGrade: listing.rawGrade,
    grader: listing.grader,
    gradeValue: listing.gradeValue,
    catalogCardId: listing.catalogCardId,
  };
  const item = existing
    ? await prisma.collectionItem.update({
        where: { id: existing.id },
        data: {
          ...fields,
          ...(opts?.visibility ? { visibility: opts.visibility } : {}),
        },
      })
    : await prisma.collectionItem.create({
        data: {
          ...fields,
          ownerId: listing.sellerId,
          listingId,
          visibility: opts?.visibility ?? "PUBLIC",
          note: listing.description.slice(0, 500),
        },
      });
  await prisma.collectionPhoto.deleteMany({ where: { itemId: item.id } });
  if (listing.photos.length) {
    await prisma.collectionPhoto.createMany({
      data: listing.photos.map((photo) => ({
        itemId: item.id,
        url: photo.url,
        position: photo.position,
        role: photo.role,
      })),
    });
  }
  const postId = await ensurePost(item.id, listing.sellerId, listing.status === "ACTIVE", opts?.postBody, listing.description);
  return { itemId: item.id, postId };
}

async function ensurePost(itemId: string, authorId: string, listingPublished: boolean, postBody?: string, fallback = "") {
  const existing = await prisma.post.findUnique({ where: { collectionItemId: itemId } });
  if (existing) {
    if (postBody != null) await prisma.post.update({ where: { id: existing.id }, data: { body: postBody.slice(0, 500) } });
    return existing.id;
  }
  if (!shouldPublishPost({ forSale: true, listingPublished, publishToFeed: false })) return null;
  const post = await prisma.post.create({
    data: { authorId, collectionItemId: itemId, body: (postBody ?? fallback).slice(0, 500) },
  });
  return post.id;
}

export async function createCollectionItem(input: {
  ownerId: string;
  title: string;
  note: string;
  visibility: CollectionVisibility;
  conditionTrack: ConditionTrack;
  rawGrade: RawGrade | null;
  grader: Grader | null;
  gradeValue: number | null;
  photos: { url: string; role: "FRONT" | "BACK" | "GALLERY" }[];
  publishToFeed: boolean;
  catalogCardId?: string | null;
  cardName?: string | null;
}) {
  const photos = await storeUploadedImages(input.photos, "uploads/collection");
  const item = await prisma.collectionItem.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      cardName: input.cardName || input.title,
      catalogCardId: input.catalogCardId ?? null,
      note: input.note,
      visibility: input.visibility,
      conditionTrack: input.conditionTrack,
      rawGrade: input.rawGrade,
      grader: input.grader,
      gradeValue: input.gradeValue,
      photos: {
        create: photos.map((photo, position) => ({ url: photo.url, role: photo.role, position })),
      },
    },
  });
  if (!shouldPublishPost({ forSale: false, listingPublished: false, publishToFeed: input.publishToFeed })) {
    return { itemId: item.id, postId: null as string | null };
  }
  const post = await prisma.post.create({ data: { authorId: input.ownerId, collectionItemId: item.id, body: input.note } });
  return { itemId: item.id, postId: post.id };
}
