import { hkdToCents, isAllowedMediaUrl } from "./format";

/** Square covers, same crop as 上架. */
export const BUYOUT_PHOTO_MAX = 3;
export const BUYOUT_NOTE_MAX = 500;
/** One optional line: district or meet-up. */
export const BUYOUT_HANDOVER_MAX = 80;

export type BuyoutDraft = {
  cardName: string;
  catalogCardId: string | null;
  note: string;
  priceCents: number;
  negotiable: boolean;
  handover: string | null;
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

  const handover = cleanHandover(String(formData.get("handover") || ""));
  if (handover === false) return { ok: false, error: "buyout_handover" };

  const rawCatalog = String(formData.get("catalogCardId") || "").trim();
  const catalogCardId = /^[\w-]{1,40}$/.test(rawCatalog) ? rawCatalog : null;

  return {
    ok: true,
    value: {
      cardName,
      catalogCardId,
      note,
      priceCents,
      negotiable: formData.get("negotiable") === "on",
      handover,
      photos,
    },
  };
}

/** Empty stays null. Newlines collapse so the field stays one sentence. */
function cleanHandover(raw: string): string | null | false {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > BUYOUT_HANDOVER_MAX) return false;
  return text;
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
