import type { ConditionTrack, Grader, PhotoRole, RawGrade, SaleType } from "@prisma/client";
import { DISTRICTS, fromHkDate, fromHkInput, hkdToCents, isAllowedMediaUrl } from "./format";
import { isAuctionDays } from "./auction";
import { parseGrade } from "./rules";

export const PHOTO_MAX = 10;

export type PhotoInput = { url: string; role: PhotoRole };

export type CardItemInput = {
  cardName: string | null;
  catalogCardId: string | null;
  catalogTitle: string | null;
  year: string | null;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  language: string | null;
  game: string | null;
  priceCents: number | null;
  conditionTrack: ConditionTrack;
  rawGrade: RawGrade | null;
  grader: Grader | null;
  gradeValue: number | null;
  certNumber: string | null;
};

export type ListingInput = {
  categoryId: string;
  title: string;
  description: string;
  saleType: SaleType;
  priceCents: number | null;
  startPriceCents: number | null;
  /** Hidden reserve. Null when the seller left it blank. */
  reserveCents?: number | null;
  /** 1, 3, 5, or 7. Absent on CSV and older callers, which still send auctionEndsAt. */
  auctionDays?: number | null;
  auctionEndsAt: Date | null;
  offersEnabled: boolean;
  minOfferCents: number | null;
  shippingDays: number;
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
  meetupDistrict: string | null;
  meetupWindow: string | null;
  meetupNotes: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
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
  catalogCardId?: string | null;
  /** Present on the 4-step form. Absent on CSV and older callers, which keep the stricter card rules. */
  items?: CardItemInput[];
  stockType?: "IN_STOCK" | "PREORDER";
  shipWithinDays?: number | null;
  preorderShipDate?: Date | null;
  /** Absent on CSV and locked edits, which leave the existing flag alone. */
  promote?: boolean;
};

export const RAW: RawGrade[] = ["A", "B", "C", "D"];
export const GRADERS: Grader[] = ["PSA", "BGS", "CGC", "TAG"];
export const SHIP_WITHIN = [3, 7, 30] as const;

function hkDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(date);
}

function gradedRowInvalid(track: ConditionTrack, grader: Grader | null, gradeValue: number | null) {
  return track === "GRADED" && (!grader || gradeValue == null);
}

export function validateListing(input: ListingInput, groupKey: string, now = new Date(), storeReady = true): string[] {
  const errors: string[] = [];
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) errors.push("title");
  if (input.intent === "draft") return [...new Set(errors)];

  const description = input.description.trim();
  if (description.length > 5000) errors.push("description");
  const photos = input.photos.filter((photo) => photo.url.trim());
  if (photos.length < 1 || photos.length > PHOTO_MAX) errors.push("photos");
  if (photos.some((photo) => !isAllowedMediaUrl(photo.url.trim()))) errors.push("photo_url");
  if (input.videoUrl) {
    try {
      if (new URL(input.videoUrl).protocol !== "https:") errors.push("video");
    } catch {
      errors.push("video");
    }
  }
  if (!input.shipSfCod && !input.shipMeetup && !input.shipPickup) errors.push("shipping");
  if (input.shipMeetup) {
    const district = input.meetupDistrict?.trim() ?? "";
    const known = DISTRICTS.some(([name]) => name === district);
    const timeWindow = input.meetupWindow?.trim() ?? "";
    const notes = input.meetupNotes?.trim() ?? "";
    if (!known || timeWindow.length > 80 || notes.length > 200) errors.push("meetup");
  }
  if (input.shipPickup && !storeReady) errors.push("store");
  if (input.quantity < 1 || input.quantity > 99) errors.push("qty");

  const rows = input.items;
  const multi = (rows?.length ?? 0) >= 2;
  const auction = input.saleType !== "BUY_NOW";
  const buyNow = input.saleType !== "AUCTION";
  if (auction && input.quantity !== 1) errors.push("qty");
  if (multi) {
    if (rows!.some((row) => row.priceCents == null || row.priceCents <= 0)) errors.push("card_price");
  } else if (buyNow && (input.priceCents == null || input.priceCents <= 0)) {
    errors.push("price");
  }
  if (auction && (input.startPriceCents == null || input.startPriceCents <= 0)) errors.push("start");
  if (
    input.saleType === "BOTH" &&
    input.priceCents != null &&
    input.startPriceCents != null &&
    input.priceCents <= input.startPriceCents
  ) {
    errors.push("both_price");
  }
  if (auction && input.reserveCents != null && (input.reserveCents <= 0 || (input.startPriceCents != null && input.reserveCents < input.startPriceCents))) {
    errors.push("reserve");
  }

  const goLive = input.intent === "schedule" && input.publishAt ? input.publishAt : now;
  if (input.intent === "schedule" && (!input.publishAt || input.publishAt.getTime() <= now.getTime())) errors.push("schedule");
  if (auction) {
    if (input.auctionDays != null) {
      if (!isAuctionDays(input.auctionDays)) errors.push("auction_days");
    } else if (!input.auctionEndsAt) errors.push("auction_end");
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

  if (rows) {
    if (rows.some((row) => gradedRowInvalid(row.conditionTrack, row.grader, row.gradeValue))) errors.push("grade");
  } else if (input.conditionTrack === "RAW") {
    if (!input.rawGrade) errors.push("grade");
  } else if (!input.grader || input.gradeValue == null) errors.push("grade");

  if (input.stockType === "PREORDER") {
    if (!input.preorderShipDate || hkDay(input.preorderShipDate) < hkDay(now)) errors.push("preorder");
  } else if (input.stockType === "IN_STOCK") {
    if (!SHIP_WITHIN.includes(input.shipWithinDays as (typeof SHIP_WITHIN)[number])) errors.push("ship_within");
  }

  // CSV and other callers that do not send items still need a named card. The 4-step form does not.
  if (!rows) {
    if (groupKey === "tcg") {
      if (!input.game?.trim() || !input.setName?.trim() || !input.cardName?.trim() || !input.language?.trim()) errors.push("tcg");
    } else if (!input.personName?.trim() || !input.seasonYear?.trim() || !input.brandSeries?.trim()) {
      errors.push("person");
    }
  }
  return [...new Set(errors)];
}

const STEP_CODES = [
  ["title", "description", "photos", "photo_url", "price", "video", "start", "both_price", "offer", "qty", "reserve", "auction_days"],
  ["card_price", "grade", "category", "tcg", "person"],
  ["shipping", "meetup", "store", "preorder", "ship_within"],
  ["schedule", "auction_end"],
] as const;

const STEP_OF: Record<string, number> = {
  title: 0,
  description: 0,
  photos: 0,
  photo_url: 0,
  price: 0,
  video: 0,
  start: 0,
  reserve: 0,
  auction_days: 0,
  both_price: 0,
  offer: 0,
  qty: 0,
  tokens: 0,
  card_price: 1,
  grade: 1,
  category: 1,
  tcg: 1,
  person: 1,
  shipping: 2,
  meetup: 2,
  store: 2,
  preorder: 2,
  ship_within: 2,
  schedule: 3,
  auction_end: 3,
};

function withCategory(input: ListingInput, groupKey: string, now: Date, storeReady: boolean): string[] {
  const errors = validateListing(input, groupKey, now, storeReady);
  if (input.intent !== "draft" && !input.categoryId.trim()) errors.unshift("category");
  return [...new Set(errors)];
}

/** Issues that belong to this step. Steps are skippable in the form; publish uses the full list. */
export function wizardStepIssues(step: number, input: ListingInput, groupKey: string, now = new Date(), storeReady = true): string[] {
  const all = withCategory({ ...input, intent: "publish" }, groupKey, now, storeReady);
  if (step >= 3) return all;
  const allow = new Set<string>(STEP_CODES[step] ?? []);
  return all.filter((code) => allow.has(code));
}

/** Issues for an explicit save. Drafts only need a title; publish and schedule use the full rules. */
export function wizardPublishIssues(input: ListingInput, groupKey: string, now = new Date(), storeReady = true): string[] {
  return withCategory(input, groupKey, now, storeReady);
}

export function wizardStepForIssue(code: string): number | null {
  return code in STEP_OF ? STEP_OF[code] : null;
}

export function wizardPanels(codes: string[]) {
  return {
    photoExtra: codes.includes("photo_url"),
    more: codes.includes("video"),
    priceExtra: codes.includes("offer") || codes.includes("qty"),
    ship: codes.includes("shipping") || codes.includes("meetup") || codes.includes("store") || codes.includes("preorder") || codes.includes("ship_within"),
    schedule: codes.includes("schedule"),
  };
}

/** Form control to focus for an issue. Empty string means the form has no matching control. */
export function wizardFocusField(code: string, input?: ListingInput | null): string {
  if (code === "photos") return input && input.photos.length > PHOTO_MAX ? "photos" : "photos-add";
  if (code === "photo_url") return "photo_url";
  if (code === "title") return "title";
  if (code === "description") return "description";
  if (code === "category") return "categoryId";
  if (code === "video") return "videoUrl";
  if (code === "price" || code === "both_price") return "price";
  if (code === "tokens") return "promote";
  if (code === "card_price") return "cardPrice";
  if (code === "start") return "startPrice";
  if (code === "reserve") return "reserve";
  if (code === "auction_days") return "auctionDays";
  if (code === "auction_end") return input?.auctionDays ? "auctionDays" : "auctionEndsAt";
  if (code === "offer") return "minOffer";
  if (code === "qty") return "quantity";
  if (code === "schedule") return "publishAt";
  if (code === "preorder") return "preorderShipDate";
  if (code === "ship_within") return "shipWithin";
  if (code === "grade") return input?.conditionTrack === "GRADED" ? "gradeScore" : "rawGrade";
  if (code === "tcg") {
    if (!input?.game?.trim()) return "game";
    if (!input.setName?.trim()) return "setName";
    if (!input.cardName?.trim()) return "cardName";
    return "language";
  }
  if (code === "person") {
    if (!input?.personName?.trim()) return "personName";
    if (!input.seasonYear?.trim()) return "seasonYear";
    return "brandSeries";
  }
  if (code === "shipping") return "shipSfCod";
  if (code === "meetup") {
    const district = input?.meetupDistrict?.trim() ?? "";
    if (!DISTRICTS.some(([name]) => name === district)) return "meetupDistrict";
    if ((input?.meetupWindow?.trim().length ?? 0) > 80) return "meetupWindow";
    return "meetupNotes";
  }
  if (code === "store") return "store";
  return "";
}

function blank(value: string) {
  const text = value.trim();
  return text || null;
}

/** First picked catalog card, else the listing-level id. Blank means the row stays unlinked. */
export function listingCatalogId(
  items: { catalogCardId?: string | null }[] | undefined,
  fallback?: string | null,
): string | null {
  for (const item of items ?? []) {
    const id = item.catalogCardId?.trim();
    if (id) return id;
  }
  return fallback?.trim() || null;
}

function parseCard(raw: Record<string, unknown>): CardItemInput | null {
  const track = raw.conditionTrack === "GRADED" ? "GRADED" : raw.conditionTrack === "RAW" ? "RAW" : null;
  if (!track) return null;
  const rawGrade = String(raw.rawGrade || "").toUpperCase();
  const grader = String(raw.grader || "").toUpperCase();
  const score = String(raw.gradeScore || "");
  return {
    cardName: blank(String(raw.cardName || "")),
    catalogCardId: blank(String(raw.catalogCardId || "")),
    catalogTitle: blank(String(raw.catalogTitle || "")),
    year: blank(String(raw.year || "")),
    setName: blank(String(raw.setName || "")),
    setCode: blank(String(raw.setCode || "")),
    collectorNumber: blank(String(raw.collectorNumber || "")),
    rarity: blank(String(raw.rarity || "")),
    language: blank(String(raw.language || "")),
    game: blank(String(raw.game || "")),
    priceCents: hkdToCents(String(raw.price || "")),
    conditionTrack: track,
    rawGrade: track === "RAW" && RAW.includes(rawGrade as RawGrade) ? (rawGrade as RawGrade) : null,
    grader: track === "GRADED" && GRADERS.includes(grader as Grader) ? (grader as Grader) : null,
    gradeValue: track === "GRADED" && score ? parseGrade(grader, score) : null,
    certNumber: blank(String(raw.certNumber || "")),
  };
}

function parseCards(raw: string): CardItemInput[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items: CardItemInput[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") return null;
      const item = parseCard(row as Record<string, unknown>);
      if (!item) return null;
      items.push(item);
    }
    return items;
  } catch {
    return null;
  }
}

function auctionDaysFrom(raw: string): number | null {
  if (!raw.trim()) return null;
  const days = Number(raw);
  return Number.isInteger(days) ? days : null;
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
  const cardsRaw = formData.get("cards");
  const items = cardsRaw == null || String(cardsRaw) === "" ? undefined : parseCards(String(cardsRaw));
  if (items === null) return null;
  const sale = String(formData.get("saleType") || "");
  const track = String(formData.get("conditionTrack") || items?.[0]?.conditionTrack || "");
  const intent = String(formData.get("intent") || "publish");
  if ((sale !== "BUY_NOW" && sale !== "AUCTION" && sale !== "BOTH") || (track !== "RAW" && track !== "GRADED")) return null;
  if (intent !== "draft" && intent !== "schedule" && intent !== "publish") return null;
  const raw = String(formData.get("rawGrade") || items?.[0]?.rawGrade || "").toUpperCase();
  const grader = String(formData.get("grader") || items?.[0]?.grader || "").toUpperCase();
  const score = String(formData.get("gradeScore") || "");
  const stockRaw = String(formData.get("stockType") || "");
  const stockType = stockRaw === "PREORDER" || stockRaw === "IN_STOCK" ? stockRaw : undefined;
  const within = Number(formData.get("shipWithinDays") || "");
  const first = items?.[0];
  return {
    categoryId: String(formData.get("categoryId") || ""),
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    saleType: sale,
    priceCents: hkdToCents(String(formData.get("price") || "")),
    startPriceCents: hkdToCents(String(formData.get("startPrice") || "")),
    reserveCents: hkdToCents(String(formData.get("reserve") || "")),
    auctionDays: auctionDaysFrom(String(formData.get("auctionDays") || "")),
    auctionEndsAt: fromHkInput(String(formData.get("auctionEndsAt") || "")),
    offersEnabled: formData.get("offersEnabled") === "on",
    minOfferCents: hkdToCents(String(formData.get("minOffer") || "")),
    shippingDays: Number(formData.get("shippingDays") || 3),
    shipSfCod: formData.get("shipSfCod") === "on",
    shipMeetup: formData.get("shipMeetup") === "on",
    shipPickup: formData.get("shipPickup") === "on",
    meetupDistrict: String(formData.get("meetupDistrict") || "") || null,
    meetupWindow: String(formData.get("meetupWindow") || "") || null,
    meetupNotes: String(formData.get("meetupNotes") || "") || null,
    cardNumber: first?.collectorNumber || String(formData.get("cardNumber") || "") || null,
    rarity: first?.rarity || String(formData.get("rarity") || "") || null,
    quantity: Number(formData.get("quantity") || 0),
    game: first?.game || String(formData.get("game") || "") || null,
    setName: first?.setName || String(formData.get("setName") || "") || null,
    cardName: first?.cardName || String(formData.get("cardName") || "") || null,
    language: first?.language || String(formData.get("language") || "") || null,
    personName: String(formData.get("personName") || "") || null,
    seasonYear: first?.year || String(formData.get("seasonYear") || "") || null,
    brandSeries: String(formData.get("brandSeries") || "") || null,
    conditionTrack: track,
    rawGrade: RAW.includes(raw as RawGrade) ? (raw as RawGrade) : null,
    grader: GRADERS.includes(grader as Grader) ? (grader as Grader) : null,
    gradeValue: score ? parseGrade(grader, score) : first?.gradeValue ?? null,
    certNumber: first?.certNumber || String(formData.get("certNumber") || "") || null,
    videoUrl: String(formData.get("videoUrl") || "") || null,
    photos,
    catalogCardId: first?.catalogCardId || String(formData.get("catalogCardId") || "").trim() || null,
    publishAt: fromHkInput(String(formData.get("publishAt") || "")),
    intent,
    items,
    stockType,
    shipWithinDays: SHIP_WITHIN.includes(within as (typeof SHIP_WITHIN)[number]) ? within : null,
    preorderShipDate: fromHkDate(String(formData.get("preorderShipDate") || "")),
    promote: formData.has("promote") ? formData.get("promote") === "on" : undefined,
  };
}
