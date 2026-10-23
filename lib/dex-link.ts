import { prisma } from "./db";
import { pickCatalogCard, type DexLinkCard, type DexLinkListing } from "./dex";

const cardSelect = {
  id: true,
  nameEn: true,
  nameJa: true,
  numberKey: true,
  printRegion: true,
  set: { select: { code: true, nameEn: true, nameJa: true, releaseDate: true } },
} as const;

export async function loadLinkCards(): Promise<DexLinkCard[]> {
  const cards = await prisma.catalogCard.findMany({ select: cardSelect });
  return cards.map((card) => ({
    id: card.id,
    nameEn: card.nameEn,
    nameJa: card.nameJa,
    numberKey: card.numberKey,
    printRegion: card.printRegion,
    releaseDate: card.set.releaseDate || "",
    setNameEn: card.set.nameEn,
    setNameJa: card.set.nameJa,
    setCode: card.set.code,
  }));
}

function listingShape(row: {
  id: string;
  title: string;
  cardName: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  language?: string | null;
}): DexLinkListing {
  return {
    id: row.id,
    title: row.title,
    cardName: row.cardName,
    setName: row.setName ?? null,
    cardNumber: row.cardNumber ?? null,
    language: row.language ?? null,
  };
}

/** Match Pokémon listings (and their collection rows) onto catalog cards. O(listings × cards); fine for the demo subset. */
export async function linkCatalogListings(): Promise<{ listings: number; collectionItems: number }> {
  const cards = await loadLinkCards();
  if (!cards.length) return { listings: 0, collectionItems: 0 };

  const listings = await prisma.listing.findMany({
    where: { cardKind: "TCG", category: { slug: "pokemon" } },
    select: { id: true, title: true, cardName: true, setName: true, cardNumber: true, language: true, catalogCardId: true },
  });
  const listingLinks = new Map<string, string | null>();
  let listingWrites = 0;
  for (const listing of listings) {
    const next = pickCatalogCard(listingShape(listing), cards)?.id ?? null;
    listingLinks.set(listing.id, next);
    if (listing.catalogCardId !== next) {
      await prisma.listing.update({ where: { id: listing.id }, data: { catalogCardId: next } });
      listingWrites += 1;
    }
  }

  const items = await prisma.collectionItem.findMany({
    select: { id: true, title: true, cardName: true, listingId: true, catalogCardId: true },
  });
  let collectionWrites = 0;
  for (const item of items) {
    let next: string | null | undefined;
    if (item.listingId && listingLinks.has(item.listingId)) next = listingLinks.get(item.listingId) ?? null;
    else if (!item.catalogCardId) {
      next =
        pickCatalogCard(
          listingShape({ id: item.id, title: item.title, cardName: item.cardName }),
          cards,
        )?.id ?? null;
      if (!next) continue;
    } else continue;
    if (item.catalogCardId !== next) {
      await prisma.collectionItem.update({ where: { id: item.id }, data: { catalogCardId: next } });
      collectionWrites += 1;
    }
  }
  return { listings: listingWrites, collectionItems: collectionWrites };
}
