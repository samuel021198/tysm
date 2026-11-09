import { DISTRICTS, hkdToCents, isAllowedMediaUrl } from "./format";
import type { Locale } from "./i18n";

/** Square covers, same crop as 上架. Design cap is 3. */
export const BUYOUT_PHOTO_MAX = 3;
export const BUYOUT_NOTE_MAX = 500;

export type BuyoutDraft = {
  cardName: string;
  catalogCardId: string | null;
  note: string;
  priceCents: number;
  negotiable: boolean;
  shipSfCod: boolean;
  shipMeetup: boolean;
  meetupDistrict: string | null;
  photos: { url: string }[];
};

export type BuyoutParse = { ok: true; value: BuyoutDraft } | { ok: false; error: string };

/**
 * 可議價 is stored as a flag.
 * ponytail: Offer rows require a listing, so the detail page does not open 還價.
 * Upgrade path: a buyout thread that can call the existing offer action.
 */
export function parseBuyoutForm(formData: FormData): BuyoutParse {
  const cardName = String(formData.get("cardName") || "").trim();
  if (cardName.length < 2 || cardName.length > 80) return { ok: false, error: "buyout_card" };

  const note = String(formData.get("note") || "").trim();
  if (note.length < 1 || note.length > BUYOUT_NOTE_MAX) return { ok: false, error: "buyout_note" };

  const priceCents = hkdToCents(String(formData.get("price") || ""));
  if (priceCents == null || priceCents <= 0) return { ok: false, error: "buyout_price" };

  const photos = readPhotos(String(formData.get("photos") || ""));
  if (!photos || photos.length < 1 || photos.length > BUYOUT_PHOTO_MAX) return { ok: false, error: "buyout_photos" };
  if (photos.some((photo) => !isAllowedMediaUrl(photo.url))) return { ok: false, error: "photo_url" };

  const rawCatalog = String(formData.get("catalogCardId") || "").trim();
  const catalogCardId = /^[\w-]{1,40}$/.test(rawCatalog) ? rawCatalog : null;
  const shipSfCod = formData.get("shipSfCod") === "on";
  const shipMeetup = formData.get("shipMeetup") === "on";
  const district = String(formData.get("meetupDistrict") || "").trim();
  if (shipMeetup && !DISTRICTS.some(([zh]) => zh === district)) return { ok: false, error: "meetup" };

  return {
    ok: true,
    value: {
      cardName,
      catalogCardId,
      note,
      priceCents,
      negotiable: formData.get("negotiable") === "on",
      shipSfCod,
      shipMeetup,
      meetupDistrict: shipMeetup ? district : null,
      photos,
    },
  };
}

/** Corner badge. Whole dollars stay whole; cents only when the member typed them. */
export function buyoutPriceBadge(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) return "";
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `HKD ${amount}`;
}

export function buyoutHandoverLine(
  row: { shipSfCod: boolean; shipMeetup: boolean; meetupDistrict: string | null },
  locale: Locale,
): string | null {
  const parts: string[] = [];
  if (row.shipSfCod) parts.push(locale === "en" ? "SF cash on delivery" : "順豐到付");
  if (row.shipMeetup) {
    const place = row.meetupDistrict?.trim();
    if (place) parts.push(locale === "en" ? `Meet-up · ${place}` : `面交 · ${place}`);
    else parts.push(locale === "en" ? "Meet-up" : "面交");
  }
  return parts.length ? parts.join(" · ") : null;
}

function readPhotos(raw: string): { url: string }[] | null {
  try {
    const parsed = JSON.parse(raw) as { url?: string }[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map((photo) => ({ url: String(photo?.url || "").trim() })).filter((photo) => photo.url);
  } catch {
    return null;
  }
}
