import { backfillCatalogTitles, ingestDex } from "../lib/dex-ingest";

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  if (process.argv.includes("--backfill-titles")) {
    let cursor: string | null = arg("cursor");
    for (let batch = 1; batch <= 2000; batch += 1) {
      const result = await backfillCatalogTitles({ deadlineMs: 90_000, cursor });
      console.log(JSON.stringify({ batch, mode: "backfillTitles", ...result }));
      if (result.done) return;
      if (!result.cursor || result.cursor === cursor) {
        console.error("backfill stalled");
        process.exit(1);
      }
      cursor = result.cursor;
    }
    console.error("backfill stopped after 2000 batches");
    process.exit(1);
  }
  const sets = Number(arg("sets") || "6");
  const maxSets = Number.isInteger(sets) && sets >= 1 && sets <= 25 ? sets : 6;
  const lang = arg("lang");
  const langs = lang === "en" || lang === "ja" ? ([lang] as const) : undefined;
  let cursor: string | null = arg("cursor");
  for (let batch = 1; batch <= 2000; batch += 1) {
    const result = await ingestDex({ deadlineMs: 90_000, cursor, maxSets, langs });
    console.log(JSON.stringify({ batch, ...result }));
    if (result.done) return;
    if (!result.cursor || (result.cursor === cursor && result.counts.cards === 0 && result.processedSetIds.length === 0)) {
      console.error("ingest stalled");
      process.exit(1);
    }
    cursor = result.cursor;
  }
  console.error("ingest stopped after 2000 batches");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ingest failed");
  process.exit(1);
});
