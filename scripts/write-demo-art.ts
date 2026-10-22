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

function motif(categoryId: string, accent: string) {
  if (categoryId === "cat_football") {
    return `<circle cx="400" cy="390" r="150" fill="#fff" opacity="0.18"/>
      <circle cx="400" cy="390" r="92" fill="none" stroke="#fff" stroke-width="10" opacity="0.85"/>
      <path d="M400 298 L448 334 L430 392 L370 392 L352 334 Z" fill="${accent}" stroke="#fff" stroke-width="8"/>`;
  }
  if (categoryId === "cat_basketball") {
    return `<circle cx="400" cy="390" r="150" fill="none" stroke="#fff" stroke-width="14" opacity="0.9"/>
      <path d="M250 390 H550 M400 240 V540" stroke="#fff" stroke-width="12" opacity="0.9"/>
      <path d="M280 300 Q400 390 280 480 M520 300 Q400 390 520 480" fill="none" stroke="#fff" stroke-width="12" opacity="0.9"/>`;
  }
  if (categoryId === "cat_baseball") {
    return `<circle cx="400" cy="390" r="150" fill="#fff" opacity="0.92"/>
      <path d="M310 300 Q360 390 310 480" fill="none" stroke="${accent}" stroke-width="10"/>
      <path d="M490 300 Q440 390 490 480" fill="none" stroke="${accent}" stroke-width="10"/>
      <path d="M328 330 H292 M332 360 H288 M332 420 H288 M328 450 H292 M472 330 H508 M468 360 H512 M468 420 H512 M472 450 H508" stroke="${accent}" stroke-width="6"/>`;
  }
  if (categoryId === "cat_singers" || categoryId === "cat_actors" || categoryId === "cat_idols") {
    return `<ellipse cx="400" cy="430" rx="120" ry="150" fill="#fff" opacity="0.16"/>
      <circle cx="400" cy="340" r="78" fill="#fff" opacity="0.28"/>
      <path d="M300 520 Q400 430 500 520" fill="#fff" opacity="0.22"/>
      <circle cx="250" cy="250" r="18" fill="#fff" opacity="0.7"/>
      <circle cx="560" cy="280" r="10" fill="#fff" opacity="0.7"/>
      <circle cx="530" cy="210" r="6" fill="#fff" opacity="0.8"/>`;
  }
  return `<circle cx="400" cy="390" r="160" fill="#fff" opacity="0.14"/>
    <circle cx="400" cy="390" r="92" fill="#fff" opacity="0.16"/>
    <path d="M400 300 L424 360 H488 L436 398 L456 460 L400 422 L344 460 L364 398 L312 360 H376 Z" fill="#fff" opacity="0.9"/>`;
}

function cardSvg(input: { zh: string; en: string; line: string; categoryId: string; accent: string; alt: string }) {
  const zh = xml(input.zh);
  const en = xml(input.en);
  const line = xml(input.line);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${zh} ${en}">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="28" y="28" width="744" height="944" rx="36" fill="${input.accent}"/>
  <rect x="48" y="48" width="704" height="620" rx="24" fill="${input.alt}"/>
  <rect x="48" y="48" width="704" height="620" rx="24" fill="url(#shine)"/>
  ${motif(input.categoryId, input.accent)}
  <text x="400" y="470" text-anchor="middle" fill="#ffffff" fill-opacity="0.22" font-size="220" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${zh.slice(0, 1)}</text>
  <rect x="48" y="692" width="704" height="248" rx="24" fill="${PAPER}"/>
  <text x="72" y="790" fill="${INK}" font-size="64" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${zh}</text>
  <text x="72" y="848" fill="${INK}" font-size="32" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600">${en}</text>
  <text x="72" y="900" fill="${MUTED}" font-size="24" font-family="ui-sans-serif, system-ui, sans-serif">${line}</text>
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
</svg>
`;
}

const back = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="卡背">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="28" y="28" width="744" height="944" rx="36" fill="#7a3148"/>
  <rect x="56" y="56" width="688" height="888" rx="28" fill="none" stroke="#f7f1e8" stroke-width="8"/>
  <g fill="#f7f1e8" fill-opacity="0.16">
    ${Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 6 }, (_, col) => `<circle cx="${120 + col * 110}" cy="${150 + row * 110}" r="16"/>`).join(""),
    ).join("")}
  </g>
  <circle cx="400" cy="460" r="120" fill="none" stroke="#f7f1e8" stroke-width="10"/>
  <text x="400" y="450" text-anchor="middle" fill="#f7f1e8" font-size="64" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">TYSM</text>
  <text x="400" y="530" text-anchor="middle" fill="#f7f1e8" font-size="36" font-family="ui-sans-serif, system-ui, sans-serif">卡背</text>
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
