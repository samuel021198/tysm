import type { CardKind, Grader, RawGrade, SaleType } from "@prisma/client";
import { prisma } from "./db";
import { headerIndex, parseCsv, PERSON_HEADERS, TCG_HEADERS } from "./csv";
import { hkdToCents, isAllowedMediaUrl } from "./format";
import { PhotoStoreError, storeUploadedImages } from "./r2";
import { parseGrade } from "./rules";
import { catalogSuggestion, type CatalogSuggestCard } from "./catalog-suggest";
import { syncListingInventory } from "./inventory";
import { hasStoreAddress } from "./shipping";
import { GRADERS, PHOTO_MAX, RAW, listingCatalogId, parseListingForm, validateListing, type CardItemInput, type ListingInput, type PhotoInput } from "./sell-wizard";

export type { ListingInput, PhotoInput };
export { parseListingForm, validateListing };

function kindFor(groupKey: string): CardKind {
  if (groupKey === "athlete") return "ATHLETE";
  if (groupKey === "celebrity") return "CELEBRITY";
  return "TCG";
}

function stockWindow(input: ListingInput, now: Date) {
  if (input.stockType === "PREORDER" && input.preorderShipDate) {
    const days = Math.ceil((input.preorderShipDate.getTime() - now.getTime()) / 86400000);
    return {
      stockType: "PREORDER" as const,
      shipWithinDays: null,
      preorderShipDate: input.preorderShipDate,
      shippingDays: Math.max(1, Math.min(365, days)),
    };
  }
  const within = input.shipWithinDays === 3 || input.shipWithinDays === 7 || input.shipWithinDays === 30 ? input.shipWithinDays : null;
  const legacy = input.shippingDays >= 1 && input.shippingDays <= 30 ? input.shippingDays : 3;
  return {
    stockType: "IN_STOCK" as const,
    shipWithinDays: within,
    preorderShipDate: null,
    shippingDays: within ?? legacy,
  };
}

function dataFor(input: ListingInput, groupKey: string, now: Date) {
  const photos = input.photos.filter((photo) => photo.url.trim()).slice(0, PHOTO_MAX);
  const status = input.intent === "draft" ? "DRAFT" : input.intent === "schedule" ? "SCHEDULED" : "ACTIVE";
  const first = input.items?.[0];
  const multi = (input.items?.length ?? 0) >= 2;
  const athlete = groupKey !== "tcg";
  const track = first?.conditionTrack ?? input.conditionTrack;
  const window = stockWindow(input, now);
  return {
    saleType: input.saleType,
    title: input.title.trim(),
    description: input.description.trim(),
    quantity:
      input.intent === "draft"
        ? Math.max(1, Number.isFinite(input.quantity) && input.quantity > 0 ? Math.min(99, input.quantity) : 1)
        : input.quantity,
    // Platform shipping is HK$0. Prepaid SF / locker / meetup fees are not stored anymore.
    shippingFee: 0,
    shippingDays: window.shippingDays,
    stockType: window.stockType,
    shipWithinDays: window.shipWithinDays,
    preorderShipDate: window.preorderShipDate,
    shipLockerFee: 0,
    shipMeetFee: 0,
    shipSfCod: input.shipSfCod,
    shipMeetup: input.shipMeetup,
    shipPickup: input.shipPickup,
    meetupDistrict: input.shipMeetup ? input.meetupDistrict?.trim() || null : null,
    meetupWindow: input.shipMeetup ? input.meetupWindow?.trim() || null : null,
    meetupNotes: input.shipMeetup ? input.meetupNotes?.trim() || null : null,
    cardNumber: first?.collectorNumber || input.cardNumber?.trim() || null,
    rarity: first?.rarity || input.rarity?.trim() || null,
    price: input.saleType === "AUCTION" ? null : multi ? input.items!.reduce((sum, row) => sum + (row.priceCents || 0), 0) : input.priceCents,
    offersEnabled: input.offersEnabled && input.saleType !== "AUCTION",
    minOffer: input.offersEnabled ? input.minOfferCents : null,
    startPrice: input.saleType === "BUY_NOW" ? null : input.startPriceCents,
    auctionEndsAt: input.saleType === "BUY_NOW" ? null : input.auctionEndsAt,
    cardKind: kindFor(groupKey),
    game: first?.game || (groupKey === "tcg" ? input.game?.trim() || null : null),
    setName: first?.setName || first?.setCode || (groupKey === "tcg" ? input.setName?.trim() || null : null),
    cardName: first?.cardName || input.cardName?.trim() || null,
    language: first?.language || (groupKey === "tcg" ? input.language?.trim() || null : null),
    personName: athlete ? first?.cardName || input.personName?.trim() || null : null,
    seasonYear: athlete ? first?.year || input.seasonYear?.trim() || null : null,
    brandSeries: athlete ? first?.setName || input.brandSeries?.trim() || null : null,
    conditionTrack: track,
    rawGrade: track === "RAW" ? first?.rawGrade ?? input.rawGrade : null,
    grader: track === "GRADED" ? first?.grader ?? input.grader : null,
    gradeValue: track === "GRADED" ? first?.gradeValue ?? input.gradeValue : null,
    certNumber: first?.certNumber || input.certNumber?.trim() || null,
    videoUrl: input.videoUrl?.trim() || null,
    publishAt: input.intent === "schedule" ? input.publishAt : null,
    status: status as "DRAFT" | "SCHEDULED" | "ACTIVE",
    publishedAt: status === "ACTIVE" ? now : null,
    catalogCardId: listingCatalogId(input.items, input.catalogCardId),
    photos,
    items: input.items,
  };
}

function itemRows(items: CardItemInput[]) {
  return items.map((item, position) => ({
    position,
    price: item.priceCents,
    cardName: item.cardName,
    catalogCardId: item.catalogCardId,
    catalogTitle: item.catalogTitle,
    year: item.year,
    setName: item.setName,
    setCode: item.setCode,
    collectorNumber: item.collectorNumber,
    rarity: item.rarity,
    language: item.language,
    game: item.game,
    conditionTrack: item.conditionTrack,
    rawGrade: item.conditionTrack === "RAW" ? item.rawGrade : null,
    grader: item.conditionTrack === "GRADED" ? item.grader : null,
    gradeValue: item.conditionTrack === "GRADED" ? item.gradeValue : null,
    certNumber: item.certNumber,
  }));
}

async function catalogPick(id: string) {
  const card = await prisma.catalogCard.findUnique({
    where: { id },
    select: {
      id: true,
      nameEn: true,
      nameJa: true,
      collectorNumber: true,
      numberKey: true,
      printRegion: true,
      rarity: true,
      finish: true,
      game: true,
      set: { select: { code: true, nameEn: true, nameJa: true, series: true, releaseDate: true } },
    },
  });
  if (!card) return null;
  const row: CatalogSuggestCard = {
    id: card.id,
    nameEn: card.nameEn,
    nameJa: card.nameJa,
    collectorNumber: card.collectorNumber,
    numberKey: card.numberKey,
    printRegion: card.printRegion,
    rarity: card.rarity,
    finish: card.finish,
    listingCount: 0,
    setNameEn: card.set.nameEn,
    setNameJa: card.set.nameJa,
    setCode: card.set.code,
    series: card.set.series,
    releaseDate: card.set.releaseDate,
  };
  return catalogSuggestion(row, card.game);
}

function fillItem(item: CardItemInput, pick: Awaited<ReturnType<typeof catalogPick>>): CardItemInput {
  if (!pick) return { ...item, catalogCardId: null, catalogTitle: null };
  return {
    ...item,
    catalogCardId: pick.id,
    catalogTitle: item.catalogTitle || pick.title,
    cardName: item.cardName || pick.cardName,
    game: item.game || pick.game,
    setName: item.setName || pick.setName,
    setCode: item.setCode || pick.setCode,
    year: item.year || pick.year || null,
    collectorNumber: item.collectorNumber || pick.collectorNumber,
    rarity: item.rarity || pick.rarity,
    language: item.language || pick.language,
  };
}

async function hydrateCatalog(input: ListingInput): Promise<ListingInput> {
  const title = input.title.trim();
  if (input.items) {
    const items = await Promise.all(
      input.items.map(async (item) => fillItem(item, item.catalogCardId ? await catalogPick(item.catalogCardId) : null)),
    );
    const first = items[0];
    return {
      ...input,
      title,
      items,
      catalogCardId: listingCatalogId(items, input.catalogCardId),
      cardName: first?.cardName ?? input.cardName,
      game: first?.game ?? input.game,
      setName: first?.setName ?? input.setName,
      language: first?.language ?? input.language,
      cardNumber: first?.collectorNumber ?? input.cardNumber,
      rarity: first?.rarity ?? input.rarity,
    };
  }
  const id = input.catalogCardId?.trim();
  if (!id) return { ...input, title, catalogCardId: null };
  const pick = await catalogPick(id);
  if (!pick) return { ...input, title, catalogCardId: null };
  return {
    ...input,
    title,
    catalogCardId: pick.id,
    game: input.game?.trim() || pick.game,
    setName: input.setName?.trim() || pick.setName,
    cardName: input.cardName?.trim() || pick.cardName,
    language: input.language?.trim() || pick.language,
    cardNumber: input.cardNumber?.trim() || pick.collectorNumber,
    rarity: input.rarity?.trim() || pick.rarity,
  };
}

async function leaf(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
  if (!category || category.level !== "LEAF") return null;
  return { category, groupKey: category.groupKey || category.parent?.groupKey || "tcg" };
}

export async function saveListing(userId: string, input: ListingInput, listingId?: string, collectionItemId?: string) {
  const found = await leaf(input.categoryId);
  if (!found) return { ok: false as const, error: "category" };
  const listing = listingId
    ? await prisma.listing.findUnique({ where: { id: listingId }, include: { photos: true } })
    : null;
  if (listingId && (!listing || listing.sellerId !== userId)) return { ok: false as const, error: "forbidden" };
  if (listing && !["DRAFT", "SCHEDULED", "ACTIVE"].includes(listing.status)) return { ok: false as const, error: "state" };
  if (listing?.binLockOrderId) return { ok: false as const, error: "locked" };
  if (listing) {
    const bidCount = await prisma.proxyBid.count({ where: { listingId: listing.id } });
    if (bidCount > 0) {
      const description = input.description.trim();
      if (description.length > 5000) return { ok: false as const, error: "description" };
      const extras = input.photos.filter((photo) => photo.url.trim() && !listing.photos.some((existing) => existing.url === photo.url.trim()));
      const photos = [...listing.photos.map((photo) => ({ url: photo.url, role: photo.role })), ...extras].slice(0, PHOTO_MAX);
      if (photos.length < 1 || photos.length > PHOTO_MAX) return { ok: false as const, error: "photos" };
      if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { ok: false as const, error: "photo_url" };
      let stored: PhotoInput[];
      try {
        stored = await storeUploadedImages(photos, "uploads/listings");
      } catch (error) {
        if (!(error instanceof PhotoStoreError)) throw error;
        return { ok: false as const, error: "photo_url" };
      }
      await prisma.$transaction([
        prisma.listing.update({ where: { id: listing.id }, data: { description } }),
        prisma.listingPhoto.deleteMany({ where: { listingId: listing.id } }),
        prisma.listingPhoto.createMany({
          data: stored.map((photo, index) => ({ listingId: listing.id, url: photo.url, role: photo.role, position: index })),
        }),
      ]);
      return done(listing.id, userId, collectionItemId);
    }
  }

  const seller = await prisma.user.findUnique({ where: { id: userId }, select: { storeDistrict: true, storeLine1: true } });
  const filled = await hydrateCatalog(input);
  const errors = validateListing(filled, found.groupKey, new Date(), hasStoreAddress(seller));
  if (errors.length) return { ok: false as const, error: errors[0] };
  const now = new Date();
  const data = dataFor(filled, found.groupKey, now);
  const { photos: sourcePhotos, items, ...rest } = data;
  let photos: PhotoInput[];
  try {
    photos = await storeUploadedImages(sourcePhotos, "uploads/listings");
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return { ok: false as const, error: "photo_url" };
  }

  if (!listing) {
    const created = await prisma.listing.create({
      data: {
        sellerId: userId,
        categoryId: input.categoryId,
        ...rest,
        quantityAvailable: rest.quantity,
        photos: { create: photos.map((photo, index) => ({ url: photo.url, role: photo.role, position: index })) },
        ...(items ? { items: { create: itemRows(items) } } : {}),
      },
    });
    return done(created.id, userId, collectionItemId);
  }

  const reserved = listing.quantity - listing.quantityAvailable;
  if (data.quantity < reserved) return { ok: false as const, error: "stock" };
  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listing.id },
      data: {
        ...rest,
        categoryId: input.categoryId,
        quantityAvailable: data.quantity - reserved,
        currentBid: rest.saleType === "BUY_NOW" ? null : listing.currentBid,
      },
    }),
    prisma.listingPhoto.deleteMany({ where: { listingId: listing.id } }),
    prisma.listingPhoto.createMany({
      data: photos.map((photo, index) => ({ listingId: listing.id, url: photo.url.trim(), role: photo.role, position: index })),
    }),
    ...(items
      ? [
          prisma.listingItem.deleteMany({ where: { listingId: listing.id } }),
          prisma.listingItem.createMany({ data: itemRows(items).map((row) => ({ ...row, listingId: listing.id })) }),
        ]
      : []),
  ]);
  return done(listing.id, userId, collectionItemId);
}

async function done(id: string, userId: string, collectionItemId?: string) {
  if (collectionItemId) {
    await prisma.collectionItem.updateMany({
      where: { id: collectionItemId, ownerId: userId, OR: [{ listingId: null }, { listingId: id }] },
      data: { listingId: id },
    });
  }
  const synced = await syncListingInventory(id);
  return { ok: true as const, id, postId: synced.postId };
}

export async function unlistListing(userId: string, listingId: string, asAdmin = false) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { ok: false as const, error: "unavailable" };
  if (!asAdmin && listing.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  if (!asAdmin && listing.saleType !== "BUY_NOW") {
    const bids = await prisma.proxyBid.count({ where: { listingId } });
    const started = listing.status === "ACTIVE" && listing.publishedAt != null && listing.publishedAt <= new Date();
    if (bids > 0 || started) return { ok: false as const, error: "state" };
  }
  if (!["DRAFT", "SCHEDULED", "ACTIVE"].includes(listing.status)) return { ok: false as const, error: "state" };
  await prisma.listing.update({ where: { id: listingId }, data: { status: "UNLISTED" } });
  return { ok: true as const };
}

export async function relistListing(userId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  if (listing.status !== "UNLISTED" || listing.quantityAvailable < 1) return { ok: false as const, error: "state" };
  if (listing.saleType !== "BUY_NOW" && listing.auctionEndsAt && listing.auctionEndsAt <= new Date()) {
    return { ok: false as const, error: "ended" };
  }
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "ACTIVE", publishedAt: listing.publishedAt ?? new Date() },
  });
  return { ok: true as const };
}

export async function deleteDraft(userId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  if (listing.status !== "DRAFT") return { ok: false as const, error: "state" };
  await prisma.listing.delete({ where: { id: listingId } });
  return { ok: true as const };
}

function truthy(value: string) {
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function money(value: string) {
  if (!value.trim()) return null;
  return hkdToCents(value);
}

export async function importCsv(userId: string, categoryId: string, text: string) {
  const found = await leaf(categoryId);
  if (!found) return { ok: false as const, error: "category", errors: [] as { row: number; code: string }[] };
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false as const, error: "empty", errors: [] };
  const expected = found.groupKey === "tcg" ? TCG_HEADERS : PERSON_HEADERS;
  const col = headerIndex(table[0], expected);
  if (!col) return { ok: false as const, error: "csv", errors: [{ row: 1, code: "csv" }] };
  const cell = (row: string[], name: string) => row[col(name)]?.trim() ?? "";
  const inputs: ListingInput[] = [];
  const errors: { row: number; code: string }[] = [];
  for (let index = 1; index < table.length; index++) {
    const row = table[index];
    const track = cell(row, "condition_track").toUpperCase() === "GRADED" ? "GRADED" : cell(row, "condition_track").toUpperCase() === "RAW" ? "RAW" : null;
    const sale = cell(row, "sale_type").toUpperCase();
    const saleType: SaleType | null = sale === "BUY_NOW" || sale === "AUCTION" || sale === "BOTH" ? sale : null;
    const raw = cell(row, "raw_grade").toUpperCase();
    const grader = cell(row, "grader").toUpperCase();
    const hours = Number(cell(row, "auction_hours"));
    const extras = cell(row, "photo_extra")
      .split("|")
      .map((url) => url.trim())
      .filter(Boolean);
    const photos: PhotoInput[] = [];
    if (cell(row, "photo_front")) photos.push({ url: cell(row, "photo_front"), role: "FRONT" });
    if (cell(row, "photo_back")) photos.push({ url: cell(row, "photo_back"), role: "BACK" });
    for (const url of extras) photos.push({ url, role: "GALLERY" });
    if (!track || !saleType) {
      errors.push({ row: index + 1, code: !track ? "grade" : "start" });
      continue;
    }
    const input: ListingInput = {
      categoryId,
      title: cell(row, "title"),
      description: cell(row, "description"),
      saleType,
      priceCents: money(cell(row, "price_hkd")),
      startPriceCents: money(cell(row, "start_price_hkd")),
      auctionEndsAt: saleType === "BUY_NOW" || !Number.isFinite(hours) ? null : new Date(Date.now() + hours * 60 * 60 * 1000),
      offersEnabled: truthy(cell(row, "offers_enabled")),
      minOfferCents: money(cell(row, "min_offer_hkd")),
      // shipping_fee_hkd is ignored. Bulk rows use 順豐到付 so each row still has one method.
      // Platform shipping stays HK$0; the old per-row prepaid fee is not charged.
      shippingDays: Number(cell(row, "shipping_days")) || 3,
      shipSfCod: true,
      shipMeetup: false,
      shipPickup: false,
      meetupDistrict: null,
      meetupWindow: null,
      meetupNotes: null,
      quantity: Number(cell(row, "quantity")),
      game: cell(row, "game") || null,
      setName: cell(row, "set_name") || null,
      cardName: cell(row, "card_name") || null,
      language: cell(row, "language") || null,
      personName: cell(row, "person_name") || null,
      seasonYear: cell(row, "season_year") || null,
      brandSeries: cell(row, "brand_series") || null,
      conditionTrack: track,
      rawGrade: RAW.includes(raw as RawGrade) ? (raw as RawGrade) : null,
      grader: GRADERS.includes(grader as Grader) ? (grader as Grader) : null,
      gradeValue: cell(row, "grade_score") ? parseGrade(grader, cell(row, "grade_score")) : null,
      certNumber: cell(row, "cert_number") || null,
      videoUrl: null,
      photos,
      publishAt: null,
      intent: "publish",
    };
    const rowErrors = validateListing(input, found.groupKey);
    if (rowErrors.length) errors.push({ row: index + 1, code: rowErrors[0] });
    else inputs.push(input);
  }
  if (errors.length) return { ok: false as const, error: "csv", errors };
  let ready: ListingInput[];
  try {
    ready = [];
    for (const input of inputs) ready.push({ ...input, photos: await storeUploadedImages(input.photos, "uploads/listings") });
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return { ok: false as const, error: "photo_url", errors: [] };
  }
  const now = new Date();
  const ids = await prisma.$transaction(
    ready.map((input) => {
      const { photos, items, ...rest } = dataFor(input, found.groupKey, now);
      return prisma.listing.create({
        data: {
          sellerId: userId,
          categoryId,
          ...rest,
          quantityAvailable: rest.quantity,
          photos: { create: photos.map((photo, index) => ({ url: photo.url.trim(), role: photo.role, position: index })) },
        },
      });
    }),
  );
  return { ok: true as const, ids: ids.map((row) => row.id), errors: [] };
}
