import type { CardKind, Grader, RawGrade, SaleType } from "@prisma/client";
import { prisma } from "./db";
import { headerIndex, parseCsv, PERSON_HEADERS, TCG_HEADERS } from "./csv";
import { hkdToCents, isAllowedMediaUrl } from "./format";
import { parseGrade } from "./rules";
import { syncListingInventory } from "./inventory";
import { hasStoreAddress } from "./shipping";
import { GRADERS, RAW, parseListingForm, validateListing, type ListingInput, type PhotoInput } from "./sell-wizard";

export type { ListingInput, PhotoInput };
export { parseListingForm, validateListing };

function kindFor(groupKey: string): CardKind {
  if (groupKey === "athlete") return "ATHLETE";
  if (groupKey === "celebrity") return "CELEBRITY";
  return "TCG";
}

function dataFor(input: ListingInput, groupKey: string, now: Date) {
  const photos = input.photos.filter((photo) => photo.url.trim()).slice(0, 12);
  const status = input.intent === "draft" ? "DRAFT" : input.intent === "schedule" ? "SCHEDULED" : "ACTIVE";
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
    shippingDays: input.shippingDays >= 1 && input.shippingDays <= 30 ? input.shippingDays : 3,
    shipLockerFee: 0,
    shipMeetFee: 0,
    shipSfCod: input.shipSfCod,
    shipMeetup: input.shipMeetup,
    shipPickup: input.shipPickup,
    meetupDistrict: input.shipMeetup ? input.meetupDistrict?.trim() || null : null,
    meetupWindow: input.shipMeetup ? input.meetupWindow?.trim() || null : null,
    meetupNotes: input.shipMeetup ? input.meetupNotes?.trim() || null : null,
    cardNumber: input.cardNumber?.trim() || null,
    rarity: input.rarity?.trim() || null,
    price: input.saleType === "AUCTION" ? null : input.priceCents,
    offersEnabled: input.offersEnabled && input.saleType !== "AUCTION",
    minOffer: input.offersEnabled ? input.minOfferCents : null,
    startPrice: input.saleType === "BUY_NOW" ? null : input.startPriceCents,
    auctionEndsAt: input.saleType === "BUY_NOW" ? null : input.auctionEndsAt,
    cardKind: kindFor(groupKey),
    game: groupKey === "tcg" ? input.game?.trim() || null : null,
    setName: groupKey === "tcg" ? input.setName?.trim() || null : null,
    cardName: groupKey === "tcg" ? input.cardName?.trim() || null : null,
    language: groupKey === "tcg" ? input.language?.trim() || null : null,
    personName: groupKey === "tcg" ? null : input.personName?.trim() || null,
    seasonYear: groupKey === "tcg" ? null : input.seasonYear?.trim() || null,
    brandSeries: groupKey === "tcg" ? null : input.brandSeries?.trim() || null,
    conditionTrack: input.conditionTrack,
    rawGrade: input.conditionTrack === "RAW" ? input.rawGrade : null,
    grader: input.conditionTrack === "GRADED" ? input.grader : null,
    gradeValue: input.conditionTrack === "GRADED" ? input.gradeValue : null,
    certNumber: input.certNumber?.trim() || null,
    videoUrl: input.videoUrl?.trim() || null,
    publishAt: input.intent === "schedule" ? input.publishAt : null,
    status: status as "DRAFT" | "SCHEDULED" | "ACTIVE",
    publishedAt: status === "ACTIVE" ? now : null,
    photos,
  };
}

async function leaf(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
  if (!category || category.level !== "LEAF") return null;
  return { category, groupKey: category.groupKey || category.parent?.groupKey || "tcg" };
}

export async function saveListing(userId: string, input: ListingInput, listingId?: string) {
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
      if (!description || description.length > 5000) return { ok: false as const, error: "description" };
      const extras = input.photos.filter((photo) => photo.url.trim() && !listing.photos.some((existing) => existing.url === photo.url.trim()));
      const photos = [...listing.photos.map((photo) => ({ url: photo.url, role: photo.role })), ...extras].slice(0, 12);
      if (photos.length > 12) return { ok: false as const, error: "photos" };
      if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { ok: false as const, error: "photo_url" };
      await prisma.$transaction([
        prisma.listing.update({ where: { id: listing.id }, data: { description } }),
        prisma.listingPhoto.deleteMany({ where: { listingId: listing.id } }),
        prisma.listingPhoto.createMany({
          data: photos.map((photo, index) => ({ listingId: listing.id, url: photo.url, role: photo.role, position: index })),
        }),
      ]);
      return done(listing.id);
    }
  }

  const seller = await prisma.user.findUnique({ where: { id: userId }, select: { storeDistrict: true, storeLine1: true } });
  const errors = validateListing(input, found.groupKey, new Date(), hasStoreAddress(seller));
  if (errors.length) return { ok: false as const, error: errors[0] };
  const now = new Date();
  const data = dataFor(input, found.groupKey, now);

  if (!listing) {
    const { photos, ...rest } = data;
    const created = await prisma.listing.create({
      data: {
        sellerId: userId,
        categoryId: input.categoryId,
        ...rest,
        quantityAvailable: rest.quantity,
        photos: { create: photos.map((photo, index) => ({ url: photo.url.trim(), role: photo.role, position: index })) },
      },
    });
    return done(created.id);
  }

  const reserved = listing.quantity - listing.quantityAvailable;
  if (data.quantity < reserved) return { ok: false as const, error: "stock" };
  const { photos, ...rest } = data;
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
  ]);
  return done(listing.id);
}

async function done(id: string) {
  await syncListingInventory(id);
  return { ok: true as const, id };
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
  const now = new Date();
  const ids = await prisma.$transaction(
    inputs.map((input) => {
      const { photos, ...rest } = dataFor(input, found.groupKey, now);
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
