import { listingTitleFromCatalog } from "./card-title";
import { prisma } from "./db";
import { pickCatalogCard, type DexLinkCard, type DexLinkListing } from "./dex";

const cardSelect = {
  id: true,
  nameEn: true,
  nameJa: true,
  numberKey: true,
  collectorNumber: true,
  rarity: true,
  printRegion: true,
  set: { select: { code: true, nameEn: true, nameJa: true, releaseDate: true } },
} as const;

type TitledCard = DexLinkCard & { collectorNumber: string; rarity: string | null };

async function loadTitledCards(): Promise<TitledCard[]> {
  const cards = await prisma.catalogCard.findMany({ select: cardSelect });
  return cards.map((card) => ({
    id: card.id,
    nameEn: card.nameEn,
    nameJa: card.nameJa,
    numberKey: card.numberKey,
    collectorNumber: card.collectorNumber,
    rarity: card.rarity,
    printRegion: card.printRegion,
    releaseDate: card.set.releaseDate || "",
    setNameEn: card.set.nameEn,
    setNameJa: card.set.nameJa,
    setCode: card.set.code,
  }));
}

export async function loadLinkCards(): Promise<DexLinkCard[]> {
  return loadTitledCards();
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

/**
 * Match Pokémon listings (and their collection rows) onto catalog cards. O(listings × cards).
 * ponytail: a full pass restarts at the first listing. ~2s per listing at 37k cards, so ingest
 * must not call this on mid-walk batches. Upgrade path: index cards by name token, or persist a listing cursor.
 */
export async function linkCatalogListings(opts?: { deadlineMs?: number }): Promise<{ listings: number; collectionItems: number }> {
  const deadlineMs = opts?.deadlineMs;
  if (deadlineMs != null && Date.now() >= deadlineMs) return { listings: 0, collectionItems: 0 };

  const cards = await loadTitledCards();
  if (!cards.length) return { listings: 0, collectionItems: 0 };

  const listings = await prisma.listing.findMany({
    where: { cardKind: "TCG", category: { slug: "pokemon" } },
    select: { id: true, title: true, cardName: true, setName: true, cardNumber: true, language: true, catalogCardId: true },
  });
  const byId = new Map(cards.map((card) => [card.id, card]));
  const listingLinks = new Map<string, string | null>();
  let listingWrites = 0;
  let listingsFinished = true;
  for (const listing of listings) {
    if (deadlineMs != null && Date.now() >= deadlineMs) {
      listingsFinished = false;
      break;
    }
    const next = pickCatalogCard(listingShape(listing), cards)?.id ?? null;
    listingLinks.set(listing.id, next);
    const linked = next ? byId.get(next) : undefined;
    const title = linked
      ? listingTitleFromCatalog({
          releaseDate: linked.releaseDate,
          setCode: linked.setCode,
          printRegion: linked.printRegion,
          collectorNumber: linked.collectorNumber,
          numberKey: linked.numberKey,
          cardName: linked.nameEn,
          rarity: linked.rarity,
        })
      : "";
    const data: { catalogCardId?: string | null; title?: string } = {};
    if (listing.catalogCardId !== next) data.catalogCardId = next;
    if (title.length >= 2 && title !== listing.title) data.title = title;
    if (!Object.keys(data).length) continue;
    await prisma.listing.update({ where: { id: listing.id }, data });
    listingWrites += 1;
  }

  if (!listingsFinished) return { listings: listingWrites, collectionItems: 0 };

  const items = await prisma.collectionItem.findMany({
    select: { id: true, title: true, cardName: true, listingId: true, catalogCardId: true },
  });
  let collectionWrites = 0;
  for (const item of items) {
    if (deadlineMs != null && Date.now() >= deadlineMs) break;
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
