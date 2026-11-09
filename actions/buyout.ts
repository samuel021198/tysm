"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { parseBuyoutForm } from "@/lib/buyout";
import { BUYOUT_PHOTO_FOLDER } from "@/lib/buyout-store";
import { prisma } from "@/lib/db";
import { PhotoStoreError, storeUploadedImages } from "@/lib/r2";

type State = { error?: string; ok?: true } | null;

export async function publishBuyout(_prev: State, formData: FormData): Promise<State> {
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent("/me?tab=buyout")}`);
  const parsed = parseBuyoutForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const draft = parsed.value;
  let photos: { url: string }[];
  try {
    photos = await storeUploadedImages(draft.photos, BUYOUT_PHOTO_FOLDER);
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return { error: "photo_url" };
  }
  const catalogCardId = draft.catalogCardId
    ? ((await prisma.catalogCard.findUnique({ where: { id: draft.catalogCardId }, select: { id: true } }))?.id ?? null)
    : null;
  await prisma.buyout.create({
    data: {
      userId: user.id,
      cardName: draft.cardName,
      catalogCardId,
      note: draft.note,
      priceCents: draft.priceCents,
      negotiable: draft.negotiable,
      handover: draft.handover,
      photos: { create: photos.map((photo, position) => ({ url: photo.url, position })) },
    },
  });
  revalidatePath("/me");
  revalidatePath(`/u/${user.id}`);
  // redirect() renders /me inside this POST. That response 500s after the row commits, so the button stays on ….
  // The sheet does a full load of ?ok=buyout, which is the request that already shows the list.
  return { ok: true };
}
