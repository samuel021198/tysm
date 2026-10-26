const OFFICIAL_OP_IMAGE =
  /^https:\/\/www\.onepiece-cardgame\.com\/images\/cardlist\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/;

const R2_DEV_HOST = /^https:\/\/[a-z0-9.-]+\.r2\.dev(?:\/|$)/i;

/** Official Japanese card art. Anything else stays a direct URL. */
export function officialOpImageUrl(url: string): string | null {
  const value = url.trim();
  return OFFICIAL_OP_IMAGE.test(value) ? value : null;
}

/** Public R2 object. `*.r2.dev` works without env; a custom domain uses `R2_PUBLIC_BASE_URL`. */
export function isR2PublicUrl(url: string): boolean {
  const value = url.trim();
  if (R2_DEV_HOST.test(value)) return true;
  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "";
  if (!base.startsWith("https://")) return false;
  return value === base || value.startsWith(`${base}/`);
}

/**
 * The official host sends Cross-Origin-Resource-Policy: same-site, so a browser
 * on TYSM will not paint the file. Same-origin proxy only for that host.
 * Objects already on R2 are served from the public base.
 */
export function catalogImageSrc(url: string): string {
  if (isR2PublicUrl(url)) return url;
  const official = officialOpImageUrl(url);
  return official ? `/api/catalog/image?src=${encodeURIComponent(official)}` : url;
}

/** Grid tiles ask TCGdex for the small file. R2 and other hosts keep the stored URL. */
export function catalogTileSrc(url: string): string {
  const src = catalogImageSrc(url);
  if (!url.startsWith("https://assets.tcgdex.net/")) return src;
  return src.replace(/\/high\.webp(?=$|\?)/, "/low.webp");
}
