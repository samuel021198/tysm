import type { ConditionTrack, Grader, PhotoRole, RawGrade, SaleType } from "@prisma/client";
import { DISTRICTS, fromHkInput, hkdToCents, isAllowedMediaUrl } from "./format";
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
};

export const RAW: RawGrade[] = ["A", "B", "C", "D"];
export const GRADERS: Grader[] = ["PSA", "BGS", "CGC", "TAG"];

export function validateListing(input: ListingInput, groupKey: string, now = new Date(), storeReady = true): string[] {
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

const STEP_CODES = [
  ["photos", "photo_url", "front_back"],
  ["title", "description", "category", "tcg", "person", "grade", "video", "front_back"],
  ["price", "start", "auction_end", "both_price", "offer", "qty"],
  ["shipping", "meetup", "store"],
] as const;

const STEP_OF: Record<string, number> = {
  photos: 0,
  photo_url: 0,
  front_back: 0,
  title: 1,
  description: 1,
  category: 1,
  tcg: 1,
  person: 1,
  grade: 1,
  video: 1,
  price: 2,
  start: 2,
  auction_end: 2,
  both_price: 2,
  offer: 2,
  qty: 2,
  shipping: 3,
  meetup: 3,
  store: 3,
  schedule: 4,
};

function withCategory(input: ListingInput, groupKey: string, now: Date, storeReady: boolean): string[] {
  const errors = validateListing(input, groupKey, now, storeReady);
  if (input.intent !== "draft" && !input.categoryId.trim()) errors.unshift("category");
  return [...new Set(errors)];
}

/** Issues that block leaving this wizard step. Step 4 is the full publish check. */
export function wizardStepIssues(step: number, input: ListingInput, groupKey: string, now = new Date(), storeReady = true): string[] {
  const all = withCategory({ ...input, intent: "publish" }, groupKey, now, storeReady);
  if (step >= 4) return all;
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
    ship: codes.includes("shipping") || codes.includes("meetup") || codes.includes("store"),
    schedule: codes.includes("schedule"),
  };
}

/** Form control to focus for an issue. Empty string means the form has no matching control. */
export function wizardFocusField(code: string, input?: ListingInput | null): string {
  if (code === "photos") return input && input.photos.length > 12 ? "photos" : "photos-add";
  if (code === "photo_url") return "photo_url";
  if (code === "front_back") return "front_back";
  if (code === "title") return "title";
  if (code === "description") return "description";
  if (code === "category") return "categoryId";
  if (code === "video") return "videoUrl";
  if (code === "price" || code === "both_price") return "price";
  if (code === "start") return "startPrice";
  if (code === "auction_end") return "auctionEndsAt";
  if (code === "offer") return "minOffer";
  if (code === "qty") return "quantity";
  if (code === "schedule") return "publishAt";
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
    shippingDays: Number(formData.get("shippingDays") || 3),
    shipSfCod: formData.get("shipSfCod") === "on",
    shipMeetup: formData.get("shipMeetup") === "on",
    shipPickup: formData.get("shipPickup") === "on",
    meetupDistrict: String(formData.get("meetupDistrict") || "") || null,
    meetupWindow: String(formData.get("meetupWindow") || "") || null,
    meetupNotes: String(formData.get("meetupNotes") || "") || null,
    cardNumber: String(formData.get("cardNumber") || "") || null,
    rarity: String(formData.get("rarity") || "") || null,
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
