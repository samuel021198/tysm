import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fronts } from "../prisma/demo-card-fronts";
import { demoListings } from "../prisma/demo-catalog";

/** Real card scans already used by the dex. Embedded so an <img src="*.svg"> still shows the photo. */
const PHOTO: Record<string, string> = {
  seed_charizard: fronts.charizard,
  seed_sold_zard: fronts.charizard,
  seed_sold_zard_b: fronts.charizardSar,
  seed_sold_zard_c: fronts.charizardBase,
  seed_sold_zard_d: fronts.charizard,
  seed_sold_zard_e: fronts.charizardSar,
  seed_sold_zard_psa10: fronts.charizard,
  seed_sold_zard_psa9: fronts.charizardBase,
  seed_sold_zard_bgs: fronts.charizardSar,
  seed_pikachu: fronts.pikachu,
  seed_psyduck: "https://assets.tcgdex.net/en/base/base1/53/high.webp",
  seed_mewtwo: fronts.mewtwo,
  seed_gengar: fronts.gengar,
  seed_umbreon: fronts.umbreon,
  seed_lugia: "https://assets.tcgdex.net/en/neo/neo1/9/high.webp",
  seed_rayquaza: "https://assets.tcgdex.net/en/swsh/swsh7/136/high.webp",
  seed_eevee: fronts.eevee,
  seed_luffy: fronts.luffy,
  seed_sold_luffy_a: fronts.luffy,
  seed_sold_luffy_b: fronts.luffyLeader,
  seed_sold_luffy_c: fronts.luffyOp01,
  seed_nami: fronts.nami,
  seed_zoro: fronts.zoro,
  seed_sold_zoro_a: fronts.zoro,
  seed_sold_zoro_b: fronts.zoro,
  seed_sold_zoro_c: fronts.zoro,
  seed_messi: fronts.messi,
  seed_salah: fronts.salah,
  seed_curry: fronts.curry,
};

const INK = "#1b1418";
const PAPER = "#f7f1e8";

function xml(value: string) {
  return value.replace(/[&<>]/g, (char) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : "&gt;"));
}

async function shot(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const mime = (res.headers.get("content-type") || "image/webp").split(";")[0];
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { mime, b64 };
}

async function main() {
const root = join(dirname(new URL(import.meta.url).pathname), "..");
const dir = join(root, "public", "demo", "cards");
const byId = new Map(demoListings.map((row) => [row.id, row]));

for (const [id, url] of Object.entries(PHOTO)) {
  const row = byId.get(id);
  if (!row) throw new Error(`missing listing ${id}`);
  const image = await shot(url);
  const slab = row.conditionTrack === "GRADED";
  const body = `<image href="data:${image.mime};base64,${image.b64}" x="48" y="48" width="704" height="904" preserveAspectRatio="xMidYMid meet"/>
  <path d="M48 48 H96" fill="none" stroke="${INK}" stroke-width="6"/>
  <text x="64" y="84" fill="${INK}" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${xml(row.zh)}</text>`;
  const inner = slab
    ? `<rect x="28" y="16" width="744" height="968" rx="28" fill="#d5e3ea"/>
    <text x="72" y="86" fill="${INK}" font-size="28" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">TYSM SLAB</text>
    <text x="72" y="120" fill="${INK}" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif">${xml(row.zh)}</text>
    ${body}`
    : body;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${xml(row.zh)} ${xml(row.en)}">
  <rect width="800" height="1000" fill="${PAPER}"/>
  ${inner}
</svg>
`;
  writeFileSync(join(dir, `${id}.svg`), svg);
  console.log(id, image.mime, image.b64.length);
}
}

main();
