import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { demoListings } from "../prisma/demo-catalog";

const PAPER = "#f7f1e8";
const INK = "#1b1418";
const MUTED = "#6d5c66";

const PALETTES: Record<string, [string, string][]> = {
  cat_pokemon: [
    ["#e85d4c", "#f6c945"],
    ["#f2c14e", "#fff4c2"],
    ["#5b8def", "#d7e4ff"],
    ["#7a4ea3", "#e7d4f7"],
    ["#2a9d8f", "#d5f5ef"],
    ["#e07a3d", "#ffe0c2"],
    ["#c73e66", "#ffd0de"],
    ["#3d5a80", "#d6e2f0"],
    ["#bc6c25", "#f3d5b5"],
  ],
  cat_onepiece: [
    ["#1d4e89", "#f2d16b"],
    ["#e36414", "#ffd6a5"],
    ["#0f766e", "#cdeee8"],
    ["#9b2226", "#f8d0c8"],
    ["#355070", "#d9e2ec"],
    ["#b08968", "#f3e6d8"],
    ["#6a4c93", "#e6d9f5"],
    ["#0077b6", "#caf0f8"],
  ],
  cat_football: [
    ["#1b7f4e", "#d8f3dc"],
    ["#245501", "#e9f5db"],
    ["#0b6e4f", "#d8f3dc"],
    ["#2d6a4f", "#b7e4c7"],
    ["#40916c", "#d8f3dc"],
    ["#1b4332", "#95d5b2"],
    ["#52b788", "#e8f6ef"],
  ],
  cat_basketball: [
    ["#e85d04", "#ffe8d6"],
    ["#dc2f02", "#ffd6c9"],
    ["#9a3412", "#ffedd5"],
    ["#c2410c", "#ffedd5"],
    ["#ea580c", "#fff7ed"],
    ["#b45309", "#fef3c7"],
    ["#f97316", "#ffedd5"],
  ],
  cat_baseball: [
    ["#1e3a5f", "#f4d6d6"],
    ["#7f1d1d", "#fee2e2"],
    ["#1d4ed8", "#dbeafe"],
    ["#9f1239", "#ffe4e6"],
    ["#0f172a", "#e2e8f0"],
    ["#1e40af", "#dbeafe"],
    ["#b91c1c", "#fee2e2"],
  ],
  cat_singers: [
    ["#7c3aed", "#ede9fe"],
    ["#a21caf", "#fae8ff"],
    ["#6d28d9", "#ede9fe"],
    ["#be185d", "#fce7f3"],
    ["#4c1d95", "#ddd6fe"],
    ["#9d174d", "#fce7f3"],
    ["#5b21b6", "#ede9fe"],
  ],
  cat_actors: [
    ["#292524", "#f5e6c8"],
    ["#44403c", "#e7e5e4"],
    ["#78350f", "#fef3c7"],
    ["#1c1917", "#d6d3d1"],
    ["#7c2d12", "#ffedd5"],
    ["#3f3f46", "#e4e4e7"],
    ["#854d0e", "#fef9c3"],
  ],
  cat_idols: [
    ["#db2777", "#fce7f3"],
    ["#ec4899", "#fdf2f8"],
    ["#be123c", "#ffe4e6"],
    ["#f43f5e", "#fff1f2"],
    ["#c026d3", "#fae8ff"],
    ["#e11d48", "#ffe4e6"],
    ["#fb7185", "#fff1f2"],
  ],
};

function xml(value: string) {
  return value.replace(/[&<>]/g, (char) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : "&gt;"));
}

function channel(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function lum(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function inkOn(hex: string) {
  const dark = "#1b1418";
  const light = "#fffaf6";
  const L = lum(hex);
  const cDark = (L + 0.05) / (lum(dark) + 0.05);
  const cLight = (lum(light) + 0.05) / (L + 0.05);
  return cDark >= cLight ? dark : light;
}

function motif(categoryId: string, accent: string, ink: string) {
  if (categoryId === "cat_football") {
    return `<circle cx="400" cy="330" r="132" fill="none" stroke="${ink}" stroke-width="14"/>
      <path d="M400 236 L446 272 L428 332 L372 332 L354 272 Z" fill="${ink}"/>
      <path d="M354 272 L304 286 L326 348 L372 332 Z M446 272 L496 286 L474 348 L428 332 Z M372 332 L360 392 L400 414 L440 392 L428 332 Z" fill="${ink}" opacity="0.72"/>`;
  }
  if (categoryId === "cat_basketball") {
    return `<circle cx="400" cy="330" r="140" fill="none" stroke="${ink}" stroke-width="16"/>
      <path d="M260 330 H540 M400 190 V470" stroke="${ink}" stroke-width="14"/>
      <path d="M286 236 Q400 330 286 424 M514 236 Q400 330 514 424" fill="none" stroke="${ink}" stroke-width="14"/>`;
  }
  if (categoryId === "cat_baseball") {
    return `<circle cx="400" cy="330" r="140" fill="#fffaf6"/>
      <path d="M322 236 Q372 330 322 424" fill="none" stroke="${accent}" stroke-width="12"/>
      <path d="M478 236 Q428 330 478 424" fill="none" stroke="${accent}" stroke-width="12"/>
      <path d="M338 268 H304 M342 300 H298 M342 360 H298 M338 392 H304 M462 268 H496 M458 300 H502 M458 360 H502 M462 392 H496" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`;
  }
  if (categoryId === "cat_singers" || categoryId === "cat_actors" || categoryId === "cat_idols") {
    return `<circle cx="400" cy="250" r="70" fill="${ink}"/>
      <path d="M300 455 Q400 330 500 455 V510 H300 Z" fill="${ink}"/>
      <circle cx="250" cy="168" r="14" fill="${ink}" opacity="0.75"/>
      <circle cx="548" cy="196" r="9" fill="${ink}" opacity="0.75"/>`;
  }
  return `<path d="M400 196 L436 292 H538 L456 352 L488 450 L400 392 L312 450 L344 352 L262 292 H364 Z" fill="${ink}"/>`;
}

function cardSvg(input: { zh: string; en: string; line: string; categoryId: string; accent: string; alt: string }) {
  const zh = xml(input.zh);
  const en = xml(input.en);
  const line = xml(input.line);
  const ink = inkOn(input.accent);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${zh} ${en}">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="24" y="24" width="752" height="952" rx="40" fill="#1b1418"/>
  <rect x="48" y="48" width="704" height="620" rx="22" fill="${input.accent}"/>
  <rect x="48" y="48" width="704" height="620" rx="22" fill="url(#sheen)"/>
  <text x="400" y="470" text-anchor="middle" fill="${ink}" fill-opacity="0.16" font-size="200" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${zh.slice(0, 1)}</text>
  ${motif(input.categoryId, input.accent, ink)}
  <rect x="48" y="692" width="704" height="252" rx="22" fill="#fffaf6"/>
  <text x="72" y="790" fill="${INK}" font-size="64" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${zh}</text>
  <text x="72" y="848" fill="${INK}" font-size="32" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600">${en}</text>
  <text x="72" y="900" fill="${MUTED}" font-size="24" font-family="ui-sans-serif, system-ui, sans-serif">${line}</text>
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${input.alt}" stop-opacity="0.42"/>
      <stop offset="0.55" stop-color="${input.accent}" stop-opacity="0"/>
      <stop offset="1" stop-color="#1b1418" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
</svg>
`;
}

const back = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="卡背">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="24" y="24" width="752" height="952" rx="40" fill="#1b1418"/>
  <rect x="56" y="56" width="688" height="888" rx="28" fill="#5c3044"/>
  <rect x="88" y="88" width="624" height="824" rx="22" fill="#fffaf6"/>
  <rect x="116" y="116" width="568" height="560" rx="16" fill="none" stroke="#5c3044" stroke-width="10"/>
  <path d="M400 220 L520 390 L400 560 L280 390 Z" fill="none" stroke="#5c3044" stroke-width="16"/>
  <text x="400" y="760" text-anchor="middle" fill="#1b1418" font-size="120" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">卡背</text>
  <text x="400" y="840" text-anchor="middle" fill="#5c3044" font-size="48" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">TYSM</text>
</svg>
`;

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const dir = join(root, "public", "demo", "cards");
mkdirSync(dir, { recursive: true });

const seen = new Map<string, number>();
for (const listing of demoListings) {
  const palette = PALETTES[listing.categoryId] ?? PALETTES.cat_pokemon;
  const n = seen.get(listing.categoryId) ?? 0;
  seen.set(listing.categoryId, n + 1);
  const [accent, alt] = palette[n % palette.length];
  const file = join(dir, `${listing.id}.svg`);
  writeFileSync(
    file,
    cardSvg({
      zh: listing.zh,
      en: listing.en,
      line: listing.line,
      categoryId: listing.categoryId,
      accent,
      alt,
    }),
  );
}

writeFileSync(join(root, "public", "demo", "back.svg"), back);
console.log(`wrote ${demoListings.length} card faces`);
