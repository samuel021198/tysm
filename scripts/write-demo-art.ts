import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { demoListings } from "../prisma/demo-catalog";
import { formatGradeValue } from "../lib/rules";

const PAPER = "#f7f1e8";
const INK = "#1b1418";
const CREAM = "#fffaf6";

const PALETTES: Record<string, [string, string, string][]> = {
  cat_pokemon: [
    ["#e85d4c", "#f6c945", "#7a1f18"],
    ["#f2c14e", "#fff4c2", "#8a5a10"],
    ["#5b8def", "#d7e4ff", "#1d3f86"],
    ["#7a4ea3", "#e7d4f7", "#3d215c"],
    ["#2a9d8f", "#d5f5ef", "#0f4f48"],
    ["#e07a3d", "#ffe0c2", "#7a3412"],
    ["#c73e66", "#ffd0de", "#6e1834"],
    ["#3d5a80", "#d6e2f0", "#1b2e48"],
  ],
  cat_onepiece: [
    ["#1d4e89", "#f2d16b", "#102a4c"],
    ["#e36414", "#ffd6a5", "#7a2e08"],
    ["#0f766e", "#cdeee8", "#083f3c"],
    ["#9b2226", "#f8d0c8", "#4c1012"],
    ["#355070", "#d9e2ec", "#1a2838"],
    ["#b08968", "#f3e6d8", "#5c4030"],
  ],
  cat_football: [
    ["#1b7f4e", "#d8f3dc", "#0d3b26"],
    ["#245501", "#e9f5db", "#122b00"],
    ["#0b6e4f", "#d8f3dc", "#063528"],
    ["#2d6a4f", "#b7e4c7", "#163628"],
    ["#1b4332", "#95d5b2", "#0c241a"],
  ],
  cat_basketball: [
    ["#e85d04", "#ffe8d6", "#7a2e02"],
    ["#dc2f02", "#ffd6c9", "#6e1801"],
    ["#9a3412", "#ffedd5", "#4a1808"],
    ["#c2410c", "#ffedd5", "#5c1e06"],
    ["#b45309", "#fef3c7", "#5c2c04"],
  ],
  cat_baseball: [
    ["#1e3a5f", "#f4d6d6", "#0e1c30"],
    ["#7f1d1d", "#fee2e2", "#3f0e0e"],
    ["#1d4ed8", "#dbeafe", "#0e2870"],
    ["#9f1239", "#ffe4e6", "#4c091c"],
    ["#1e40af", "#dbeafe", "#0e2058"],
  ],
  cat_singers: [
    ["#7c3aed", "#ede9fe", "#3b1680"],
    ["#a21caf", "#fae8ff", "#501058"],
    ["#be185d", "#fce7f3", "#5e0c2e"],
    ["#4c1d95", "#ddd6fe", "#240e48"],
    ["#9d174d", "#fce7f3", "#4e0b26"],
  ],
  cat_actors: [
    ["#292524", "#f5e6c8", "#141211"],
    ["#44403c", "#e7e5e4", "#221f1d"],
    ["#78350f", "#fef3c7", "#3c1a07"],
    ["#1c1917", "#d6d3d1", "#0e0c0b"],
    ["#854d0e", "#fef9c3", "#422606"],
  ],
  cat_idols: [
    ["#db2777", "#fce7f3", "#6e123c"],
    ["#ec4899", "#fdf2f8", "#76184c"],
    ["#be123c", "#ffe4e6", "#5e091e"],
    ["#c026d3", "#fae8ff", "#60136a"],
    ["#e11d48", "#ffe4e6", "#700e24"],
  ],
};

function xml(value: string) {
  return value.replace(/[&<>]/g, (char) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : "&gt;"));
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function art(id: string, accent: string, ink: string, kind: string) {
  const h = hash(id);
  const a = 80 + (h % 90);
  const b = 140 + ((h >> 3) % 120);
  if (kind === "ATHLETE") {
    return `<path d="M70 430 H610" stroke="${ink}" stroke-width="8" opacity="0.35"/>
      <path d="M70 250 H610 M70 340 H610" stroke="${CREAM}" stroke-width="6" opacity="0.45"/>
      <path d="M160 120 Q340 ${40 + (h % 40)} 560 150" fill="none" stroke="${accent}" stroke-width="18"/>
      <rect x="250" y="150" width="180" height="230" rx="16" fill="${ink}"/>
      <path d="M268 188 H412 M268 230 H390 M268 272 H412" stroke="${CREAM}" stroke-width="10" stroke-linecap="round"/>
      <text x="340" y="340" text-anchor="middle" fill="${accent}" font-size="72" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${(h % 89) + 1}</text>
      <path d="M120 400 Q340 330 560 400" fill="none" stroke="${ink}" stroke-width="14"/>`;
  }
  if (kind === "CELEBRITY") {
    return `<circle cx="340" cy="230" r="150" fill="${accent}" opacity="0.35"/>
      <path d="M120 80 H560 V430 H120 Z" fill="none" stroke="${ink}" stroke-width="10"/>
      <path d="M150 110 H300 V260 H150 Z" fill="${ink}" opacity="0.18"/>
      <path d="M390 180 H530 V400 H390 Z" fill="${accent}" opacity="0.55"/>
      <path d="M170 360 Q340 250 520 370" fill="none" stroke="${ink}" stroke-width="16"/>
      <circle cx="${180 + (h % 40)}" cy="${140 + ((h >> 4) % 30)}" r="18" fill="${CREAM}"/>
      <circle cx="${460 + (h % 20)}" cy="160" r="10" fill="${ink}"/>`;
  }
  return `<ellipse cx="250" cy="230" rx="${70 + (h % 30)}" ry="${48 + ((h >> 2) % 24)}" fill="${ink}" opacity="0.9"/>
    <ellipse cx="430" cy="210" rx="${90 + ((h >> 5) % 40)}" ry="62" fill="${accent}"/>
    <path d="M${a + 80} 120 C${b} 40, ${b + 180} 80, ${a + 360} 150 C${b + 80} 240, ${a + 40} 280, ${a + 80} 120 Z" fill="${ink}" opacity="0.78"/>
    <path d="M180 300 Q340 ${220 + (h % 50)} 520 290" fill="none" stroke="${CREAM}" stroke-width="14"/>
    <circle cx="300" cy="210" r="16" fill="${CREAM}"/>
    <circle cx="430" cy="188" r="12" fill="${INK}"/>
    <path d="M220 340 L280 390 L210 400 Z M430 330 L500 390 L410 410 Z" fill="${ink}"/>`;
}

function cardFace(input: {
  id: string;
  zh: string;
  en: string;
  line: string;
  number: string;
  rarity: string;
  kind: string;
  accent: string;
  alt: string;
  deep: string;
}) {
  const zh = xml(input.zh);
  const en = xml(input.en);
  const line = xml(input.line);
  const number = xml(input.number);
  const rarity = xml(input.rarity);
  return `<g>
    <rect x="36" y="28" width="728" height="944" rx="36" fill="${input.deep}"/>
    <rect x="54" y="46" width="692" height="908" rx="28" fill="${input.accent}"/>
    <rect x="74" y="66" width="652" height="78" rx="16" fill="${CREAM}"/>
    <text x="96" y="118" fill="${INK}" font-size="40" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${zh}</text>
    <text x="690" y="116" text-anchor="end" fill="${input.deep}" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${input.kind === "TCG" ? "HP" : "★"}</text>
    <rect x="74" y="160" width="652" height="470" rx="18" fill="${PAPER}"/>
    <g transform="translate(90,176)">
      ${art(input.id, input.alt, input.deep, input.kind)}
    </g>
    <rect x="74" y="648" width="652" height="168" rx="16" fill="${CREAM}"/>
    <text x="96" y="704" fill="${INK}" font-size="32" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${en}</text>
    <text x="96" y="748" fill="${input.deep}" font-size="24" font-family="ui-sans-serif, system-ui, sans-serif">${line}</text>
    <text x="96" y="790" fill="${INK}" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif">${rarity}</text>
    <text x="96" y="868" fill="${INK}" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif">${number}</text>
    <text x="690" y="868" text-anchor="end" fill="${input.deep}" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">TYSM</text>
  </g>`;
}

function slab(inner: string, label: string) {
  const text = xml(label);
  return `<rect x="28" y="16" width="744" height="968" rx="28" fill="#d5e3ea"/>
    <rect x="48" y="36" width="704" height="118" rx="16" fill="${CREAM}"/>
    <text x="72" y="86" fill="${INK}" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${text}</text>
    <text x="72" y="126" fill="#5c6b73" font-size="20" font-family="ui-sans-serif, system-ui, sans-serif">TYSM SLAB</text>
    <g transform="translate(86,168) scale(0.78)">${inner}</g>`;
}

function faceSvg(input: Parameters<typeof cardFace>[0] & { slab: string | null }) {
  const body = cardFace(input);
  const inner = input.slab ? slab(body, input.slab) : body;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${xml(input.zh)} ${xml(input.en)}">
  <rect width="800" height="1000" fill="${PAPER}"/>
  ${inner}
</svg>
`;
}

function backSvg(input: { zh: string; en: string; line: string; accent: string; deep: string }) {
  const h = hash(input.zh + input.en);
  const cells: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 6; x++) {
      const on = (x + y + (h % 3)) % 2 === 0;
      cells.push(`<rect x="${120 + x * 92}" y="${180 + y * 78}" width="70" height="56" rx="8" fill="${on ? input.accent : CREAM}" opacity="${on ? 0.85 : 0.9}"/>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${xml(input.zh)} 背面">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="36" y="28" width="728" height="944" rx="36" fill="${input.deep}"/>
  <rect x="68" y="60" width="664" height="880" rx="24" fill="${CREAM}"/>
  ${cells.join("\n  ")}
  <circle cx="400" cy="490" r="92" fill="${input.deep}"/>
  <text x="400" y="506" text-anchor="middle" fill="${CREAM}" font-size="42" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${xml(input.zh.slice(0, 1))}</text>
  <text x="400" y="860" text-anchor="middle" fill="${INK}" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif">背面 · ${xml(input.line)}</text>
</svg>
`;
}

const sharedBack = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="卡背">
  <rect width="800" height="1000" fill="${PAPER}"/>
  <rect x="24" y="24" width="752" height="952" rx="40" fill="${INK}"/>
  <rect x="56" y="56" width="688" height="888" rx="28" fill="#5c3044"/>
  <rect x="88" y="88" width="624" height="824" rx="22" fill="${CREAM}"/>
  <rect x="116" y="116" width="568" height="560" rx="16" fill="none" stroke="#5c3044" stroke-width="10"/>
  <path d="M400 220 L520 390 L400 560 L280 390 Z" fill="none" stroke="#5c3044" stroke-width="16"/>
  <text x="400" y="760" text-anchor="middle" fill="${INK}" font-size="72" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">卡背</text>
  <text x="400" y="840" text-anchor="middle" fill="#5c3044" font-size="36" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">TYSM</text>
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
  const [accent, alt, deep] = palette[n % palette.length];
  const slabLabel =
    listing.conditionTrack === "GRADED" && listing.grader && listing.gradeValue != null
      ? `${listing.grader} ${formatGradeValue(listing.gradeValue)}`
      : null;
  writeFileSync(
    join(dir, `${listing.id}.svg`),
    faceSvg({
      id: listing.id,
      zh: listing.zh,
      en: listing.en,
      line: listing.line,
      number: listing.cardNumber,
      rarity: listing.rarity,
      kind: listing.cardKind,
      accent,
      alt,
      deep,
      slab: slabLabel,
    }),
  );
  writeFileSync(
    join(dir, `${listing.id}-back.svg`),
    backSvg({ zh: listing.zh, en: listing.en, line: listing.line, accent, deep }),
  );
}

writeFileSync(join(root, "public", "demo", "back.svg"), sharedBack);
console.log(`wrote ${demoListings.length} card faces and backs`);
