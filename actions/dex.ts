"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { catalogTitleFromCard } from "@/lib/card-title";
import { catalogImageSrc } from "@/lib/catalog-image";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCollectionItem } from "@/lib/inventory";

export async function collectCatalogCard(formData: FormData) {
  const id = String(formData.get("cardId") || "");
  const next = id ? `/dex/${id}` : "/dex";
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const card = id
    ? await prisma.catalogCard.findUnique({
        where: { id },
        include: { set: { select: { code: true, releaseDate: true } } },
      })
    : null;
  if (!card) redirect("/dex");
  const existing = await prisma.collectionItem.findFirst({
    where: { ownerId: user.id, catalogCardId: card.id },
    select: { id: true },
  });
  if (!existing) {
    const title = catalogTitleFromCard(card).slice(0, 120);
    await createCollectionItem({
      ownerId: user.id,
      title: title || card.nameEn,
      cardName: card.nameJa || card.nameEn,
      note: "",
      visibility: "PUBLIC",
      conditionTrack: "RAW",
      rawGrade: "A",
      grader: null,
      gradeValue: null,
      photos: [{ url: catalogImageSrc(card.imageUrl), role: "FRONT" }],
      publishToFeed: false,
      catalogCardId: card.id,
    });
  }
  revalidatePath(`/dex/${card.id}`);
  revalidatePath("/me");
  redirect(`/dex/${card.id}?ok=collected`);
}
