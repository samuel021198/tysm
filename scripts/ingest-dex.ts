import { ingestDex } from "../lib/dex-ingest";

async function main() {
  const counts = await ingestDex({ deadlineMs: 10 * 60 * 1000 });
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ingest failed");
  process.exit(1);
});
