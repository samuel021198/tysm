import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseBasketballCsv, parseChecklistHtml, type ToppsCardRow, type ToppsGame, type ToppsSetFile } from "../lib/topps";

/**
 * Rebuild committed name-only JSON from local checklist files.
 * Ingest reads `data/topps` and does not call this. Pass one `--file` per set:
 *   npx tsx scripts/build-topps-data.ts --file=TCB2526=/tmp/topps/2526-chrome.csv
 */

type Spec = {
  code: string;
  game: ToppsGame;
  nameEn: string;
  series: string;
  releaseDate: string;
  source: string;
  format: "csv" | "html";
};

const SPECS: Record<string, Spec> = {
  TCB2526: {
    code: "TCB2526",
    game: "TOPPS_BASKETBALL",
    nameEn: "2025-26 Topps Chrome Basketball",
    series: "Chrome",
    releaseDate: "2025-12-18",
    source: "https://basketball.cards/checklists/2025-26-topps-chrome-basketball.csv",
    format: "csv",
  },
  TB2526: {
    code: "TB2526",
    game: "TOPPS_BASKETBALL",
    nameEn: "2025-26 Topps Basketball",
    series: "Flagship",
    releaseDate: "2025-10-23",
    source: "https://basketball.cards/checklists/2025-26-topps-basketball.csv",
    format: "csv",
  },
  TCB2425: {
    code: "TCB2425",
    game: "TOPPS_BASKETBALL",
    nameEn: "2024-25 Topps Chrome Basketball",
    series: "Chrome",
    releaseDate: "2025-06-12",
    source: "https://www.checklistinsider.com/2024-25-topps-chrome-basketball",
    format: "html",
  },
  UEFA2425: {
    code: "UEFA2425",
    game: "TOPPS_SOCCER",
    nameEn: "2024-25 Topps Chrome UEFA Club Competitions",
    series: "Chrome",
    releaseDate: "2025-05-15",
    source: "https://www.checklistinsider.com/2024-25-topps-chrome-uefa-club-competitions",
    format: "html",
  },
  MLS24: {
    code: "MLS24",
    game: "TOPPS_SOCCER",
    nameEn: "2024 Topps Chrome MLS",
    series: "Chrome",
    releaseDate: "2024-12-06",
    source: "https://www.checklistinsider.com/2024-topps-chrome-mls",
    format: "html",
  },
  PL2526: {
    code: "PL2526",
    game: "TOPPS_SOCCER",
    nameEn: "2025-26 Topps Premier League",
    series: "Premier League",
    releaseDate: "2025-09-17",
    source: "https://www.checklistinsider.com/2025-26-topps-premier-league",
    format: "html",
  },
};

function argFiles(): { code: string; file: string }[] {
  const out: { code: string; file: string }[] = [];
  for (const item of process.argv) {
    if (!item.startsWith("--file=")) continue;
    const raw = item.slice("--file=".length);
    const cut = raw.indexOf("=");
    if (cut <= 0) throw new Error(`expected --file=CODE=path, got ${item}`);
    out.push({ code: raw.slice(0, cut), file: raw.slice(cut + 1) });
  }
  return out;
}

function cardsFor(spec: Spec, file: string): ToppsCardRow[] {
  const text = readFileSync(file, "utf8");
  return spec.format === "csv" ? parseBasketballCsv(text) : parseChecklistHtml(text);
}

function main() {
  const files = argFiles();
  if (!files.length) {
    console.error("pass --file=CODE=path for each set to rebuild");
    process.exit(1);
  }
  const dir = path.join(process.cwd(), "data", "topps");
  mkdirSync(dir, { recursive: true });
  for (const item of files) {
    const spec = SPECS[item.code];
    if (!spec) throw new Error(`unknown set ${item.code}`);
    const cards = cardsFor(spec, item.file);
    if (cards.length < 40) throw new Error(`${item.code} only parsed ${cards.length} cards`);
    const payload: ToppsSetFile = {
      code: spec.code,
      game: spec.game,
      nameEn: spec.nameEn,
      series: spec.series,
      releaseDate: spec.releaseDate,
      source: spec.source,
      cards,
    };
    const dest = path.join(dir, `${spec.code.toLowerCase()}.json`);
    writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`);
    const base = cards.filter((card) => card.subset === "Base").length;
    console.log(`${spec.code} ${cards.length} cards (${base} base) -> ${dest}`);
  }
}

main();
