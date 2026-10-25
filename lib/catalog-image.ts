const OFFICIAL_OP_IMAGE =
  /^https:\/\/www\.onepiece-cardgame\.com\/images\/cardlist\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/;

/** Official Japanese card art. Anything else stays a direct URL. */
export function officialOpImageUrl(url: string): string | null {
  const value = url.trim();
  return OFFICIAL_OP_IMAGE.test(value) ? value : null;
}

/**
 * The official host sends Cross-Origin-Resource-Policy: same-site, so a browser
 * on TYSM will not paint the file. Same-origin proxy only for that host.
 */
export function catalogImageSrc(url: string): string {
  const official = officialOpImageUrl(url);
  return official ? `/api/catalog/image?src=${encodeURIComponent(official)}` : url;
}

/** Grid tiles ask TCGdex for the small file. Detail pages keep `/high.webp`. */
export function catalogTileSrc(url: string): string {
  return catalogImageSrc(url).replace(/\/high\.webp(?=$|\?)/, "/low.webp");
}
