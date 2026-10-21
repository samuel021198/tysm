import type { CardKind, ConditionTrack, Grader, PhotoRole, RawGrade, SaleType } from "@prisma/client";
import { prisma } from "./db";
import { headerIndex, parseCsv, PERSON_HEADERS, TCG_HEADERS } from "./csv";
import { fromHkInput, hkdToCents, isAllowedMediaUrl } from "./format";
import { gradedPhotosOk, parseGrade } from "./rules";

export type PhotoInput = { url: string; role: PhotoRole };

export type ListingInput = {
  categoryId: string;
  title: string;
  description: string;
  saleType: SaleType;
  priceCents: number | null;
  startPriceCents: number | null;
  auctionEndsAt: Date | null;
  offersEnabled: boolean;
  minOfferCents: number | null;
  shippingFeeCents: number;
  shippingDays: number;
  quantity: number;
  game: string | null;
  setName: string | null;
  cardName: string | null;
  language: string | null;
  personName: string | null;
  seasonYear: string | null;
  brandSeries: string | null;
  conditionTrack: ConditionTrack;
  rawGrade: RawGrade | null;
  grader: Grader | null;
  gradeValue: number | null;
  certNumber: string | null;
  videoUrl: string | null;
  photos: PhotoInput[];
  publishAt: Date | null;
  intent: "draft" | "schedule" | "publish";
};

const RAW: RawGrade[] = ["A", "B", "C", "D"];
const GRADERS: Grader[] = ["PSA", "BGS", "CGC", "TAG"];

export function validateListing(input: ListingInput, groupKey: string, now = new Date()): string[] {
  const errors: string[] = [];
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) errors.push("title");
  if (input.intent === "draft") return [...new Set(errors)];

  const description = input.description.trim();
  if (!description || description.length > 5000) errors.push("description");
  const photos = input.photos.filter((photo) => photo.url.trim());
  if (photos.length < 2 || photos.length > 12) errors.push("photos");
  if (photos.some((photo) => !isAllowedMediaUrl(photo.url.trim()))) errors.push("photo_url");
  if (input.conditionTrack === "GRADED" && !gradedPhotosOk(photos)) errors.push("front_back");
  if (input.videoUrl) {
    try {
      if (new URL(input.videoUrl).protocol !== "https:") errors.push("video");
    } catch {
      errors.push("video");
    }
  }
  if (input.shippingFeeCents < 0 || input.shippingDays < 1 || input.shippingDays > 30) errors.push("shipping");
  if (input.quantity < 1 || input.quantity > 99) errors.push("qty");

  const auction = input.saleType !== "BUY_NOW";
  const buyNow = input.saleType !== "AUCTION";
  if (auction && input.quantity !== 1) errors.push("qty");
  if (buyNow && (input.priceCents == null || input.priceCents <= 0)) errors.push("price");
  if (auction && (input.startPriceCents == null || input.startPriceCents <= 0)) errors.push("start");
  if (
    input.saleType === "BOTH" &&
    input.priceCents != null &&
    input.startPriceCents != null &&
    input.priceCents <= input.startPriceCents
  ) {
    errors.push("both_price");
  }

  const goLive = input.intent === "schedule" && input.publishAt ? input.publishAt : now;
  if (input.intent === "schedule" && (!input.publishAt || input.publishAt.getTime() <= now.getTime())) errors.push("schedule");
  if (auction) {
    if (!input.auctionEndsAt) errors.push("auction_end");
    else {
      const delta = input.auctionEndsAt.getTime() - goLive.getTime();
      if (delta < 30 * 60 * 1000 || delta > 14 * 24 * 60 * 60 * 1000) errors.push("auction_end");
    }
  }
  if (input.offersEnabled) {
    if (
      !buyNow ||
      input.priceCents == null ||
      input.minOfferCents == null ||
      input.minOfferCents <= 0 ||
      input.minOfferCents >= input.priceCents
    ) {
      errors.push("offer");
    }
  }
  if (input.conditionTrack === "RAW") {
    if (!input.rawGrade) errors.push("grade");
  } else if (!input.grader || input.gradeValue == null) errors.push("grade");

  if (groupKey === "tcg") {
    if (!input.game?.trim() || !input.setName?.trim() || !input.cardName?.trim() || !input.language?.trim()) errors.push("tcg");
  } else if (!input.personName?.trim() || !input.seasonYear?.trim() || !input.brandSeries?.trim()) {
    errors.push("person");
  }
  return [...new Set(errors)];
}

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
    shippingFee: input.intent === "draft" ? Math.max(0, input.shippingFeeCents) : input.shippingFeeCents,
    shippingDays: input.shippingDays >= 1 && input.shippingDays <= 30 ? input.shippingDays : input.intent === "draft" ? 3 : input.shippingDays,
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
  const errors = validateListing(input, found.groupKey);
  if (errors.length) return { ok: false as const, error: errors[0] };
  const now = new Date();
  const data = dataFor(input, found.groupKey, now);

  if (!listingId) {
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
    return { ok: true as const, id: created.id };
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { photos: true } });
  if (!listing || listing.sellerId !== userId) return { ok: false as const, error: "forbidden" };
  if (!["DRAFT", "SCHEDULED", "ACTIVE"].includes(listing.status)) return { ok: false as const, error: "state" };
  if (listing.binLockOrderId) return { ok: false as const, error: "locked" };
  const bidCount = await prisma.proxyBid.count({ where: { listingId } });
  if (bidCount > 0) {
    if (!data.description || data.description.length > 5000) return { ok: false as const, error: "description" };
    const extras = data.photos.filter((photo) => !listing.photos.some((existing) => existing.url === photo.url.trim()));
    const photos = [...listing.photos.map((photo) => ({ url: photo.url, role: photo.role })), ...extras].slice(0, 12);
    if (photos.length > 12) return { ok: false as const, error: "photos" };
    if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { ok: false as const, error: "photo_url" };
    await prisma.$transaction([
      prisma.listing.update({ where: { id: listingId }, data: { description: data.description } }),
      prisma.listingPhoto.deleteMany({ where: { listingId } }),
      prisma.listingPhoto.createMany({
        data: photos.map((photo, index) => ({ listingId, url: photo.url, role: photo.role, position: index })),
      }),
    ]);
    return { ok: true as const, id: listingId };
  }

  const reserved = listing.quantity - listing.quantityAvailable;
  if (data.quantity < reserved) return { ok: false as const, error: "stock" };
  const { photos, ...rest } = data;
  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listingId },
      data: {
        ...rest,
        categoryId: input.categoryId,
        quantityAvailable: data.quantity - reserved,
        currentBid: rest.saleType === "BUY_NOW" ? null : listing.currentBid,
      },
    }),
    prisma.listingPhoto.deleteMany({ where: { listingId } }),
    prisma.listingPhoto.createMany({
      data: photos.map((photo, index) => ({ listingId, url: photo.url.trim(), role: photo.role, position: index })),
    }),
  ]);
  return { ok: true as const, id: listingId };
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
      shippingFeeCents: money(cell(row, "shipping_fee_hkd")) ?? -1,
      shippingDays: Number(cell(row, "shipping_days")),
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

export function parseListingForm(formData: FormData): ListingInput | null {
  let photos: PhotoInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("photos") || "[]")) as { url?: string; role?: string }[];
    if (!Array.isArray(parsed)) return null;
    photos = parsed
      .map((photo) => ({
        url: String(photo.url || "").trim(),
        role: (photo.role === "FRONT" || photo.role === "BACK" ? photo.role : "GALLERY") as PhotoRole,
      }))
      .filter((photo) => photo.url);
  } catch {
    return null;
  }
  const sale = String(formData.get("saleType") || "");
  const track = String(formData.get("conditionTrack") || "");
  const intent = String(formData.get("intent") || "publish");
  if ((sale !== "BUY_NOW" && sale !== "AUCTION" && sale !== "BOTH") || (track !== "RAW" && track !== "GRADED")) return null;
  if (intent !== "draft" && intent !== "schedule" && intent !== "publish") return null;
  const raw = String(formData.get("rawGrade") || "").toUpperCase();
  const grader = String(formData.get("grader") || "").toUpperCase();
  const score = String(formData.get("gradeScore") || "");
  return {
    categoryId: String(formData.get("categoryId") || ""),
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    saleType: sale,
    priceCents: hkdToCents(String(formData.get("price") || "")),
    startPriceCents: hkdToCents(String(formData.get("startPrice") || "")),
    auctionEndsAt: fromHkInput(String(formData.get("auctionEndsAt") || "")),
    offersEnabled: formData.get("offersEnabled") === "on",
    minOfferCents: hkdToCents(String(formData.get("minOffer") || "")),
    shippingFeeCents: hkdToCents(String(formData.get("shippingFee") || "")) ?? -1,
    shippingDays: Number(formData.get("shippingDays") || 0),
    quantity: Number(formData.get("quantity") || 0),
    game: String(formData.get("game") || "") || null,
    setName: String(formData.get("setName") || "") || null,
    cardName: String(formData.get("cardName") || "") || null,
    language: String(formData.get("language") || "") || null,
    personName: String(formData.get("personName") || "") || null,
    seasonYear: String(formData.get("seasonYear") || "") || null,
    brandSeries: String(formData.get("brandSeries") || "") || null,
    conditionTrack: track,
    rawGrade: RAW.includes(raw as RawGrade) ? (raw as RawGrade) : null,
    grader: GRADERS.includes(grader as Grader) ? (grader as Grader) : null,
    gradeValue: score ? parseGrade(grader, score) : null,
    certNumber: String(formData.get("certNumber") || "") || null,
    videoUrl: String(formData.get("videoUrl") || "") || null,
    photos,
    publishAt: fromHkInput(String(formData.get("publishAt") || "")),
    intent,
  };
}
