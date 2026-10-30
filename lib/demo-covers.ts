/**
 * Production QA rows stored green JPEGs on R2. A deploy cannot change those
 * database URLs, so the page swaps the known objects for real card files.
 * `scripts/refresh-demo-covers.ts` writes the same paths back onto those rows only.
 */
export const DEMO_COVERS = [
  {
    ids: ["cmvtt924j000fl6071w36tui6"],
    titles: ["QA soft-launch 拍賣 Charizard"],
    photo: "/demo/photos/charizard.webp",
    from: ["https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/uploads/listings/6d83b20f6759074beffc8493.jpg", "/demo/cards/seed_charizard.svg"],
  },
  {
    ids: ["cmvtt63d70001l607aczgcp64"],
    titles: ["QA 拍賣測試 1元"],
    photo: "/demo/photos/pikachu.webp",
    from: ["https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/uploads/listings/e231693f8a4aa3b27934df3c.jpg", "/demo/cards/seed_pikachu.svg"],
  },
] as const;

const BY_URL = new Map<string, string>(DEMO_COVERS.flatMap((row) => row.from.map((url) => [url, row.photo])));

export function displayPhoto(url: string | null | undefined): string {
  if (!url) return "/demo/back.svg";
  return BY_URL.get(url) ?? url;
}

/** Drop a reserve amount written into the public description. The field itself stays hidden. */
export function buyerDescription(text: string): string {
  return text
    .replace(/,?\s*\breserve\s+\d+(?:\.\d+)?\b/gi, "")
    .replace(/[，,]?\s*底價(?:\s*HK\$)?\s*\d+(?:\.\d+)?/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
