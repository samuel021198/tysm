import { buyoutPhotoForPage } from "./buyout";
import { prisma } from "./db";
import { PhotoStoreError, storeUploadedImage } from "./r2";

export const BUYOUT_PHOTO_FOLDER = "uploads/buyouts";

/**
 * Cover URL safe to send to the client.
 * ponytail: two loads can upload one data URL twice before the row flips to https. Upgrade: single-flight per photo id.
 */
export async function hostedBuyoutPhoto(photo: { id: string; url: string } | null | undefined): Promise<string> {
  const ready = buyoutPhotoForPage(photo?.url);
  if (ready || !photo?.url) return ready;
  try {
    const stored = await storeUploadedImage(photo.url, BUYOUT_PHOTO_FOLDER);
    const hosted = buyoutPhotoForPage(stored);
    if (!hosted) return "";
    await prisma.buyoutPhoto.updateMany({ where: { id: photo.id, url: photo.url }, data: { url: hosted } });
    return hosted;
  } catch (error) {
    if (!(error instanceof PhotoStoreError)) throw error;
    return "";
  }
}
