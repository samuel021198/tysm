"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { parseBuyoutForm } from "@/lib/buyout";
import { prisma } from "@/lib/db";

export async function publishBuyout(_prev: { error?: string } | null, formData: FormData) {
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent("/me?tab=buyout")}`);
  const parsed = parseBuyoutForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const draft = parsed.value;
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
      photos: { create: draft.photos.map((photo, position) => ({ url: photo.url, position })) },
    },
  });
  revalidatePath("/me");
  revalidatePath(`/u/${user.id}`);
  redirect("/me?tab=buyout&ok=buyout");
}
