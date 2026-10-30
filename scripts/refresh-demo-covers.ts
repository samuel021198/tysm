/**
 * Point known demo/QA listing covers at /demo/photos/*.webp and strip a
 * reserve amount from those descriptions.
 *
 * Dry-run (default) prints the rows. `--apply` writes them.
 * Matches only the QA titles/ids in lib/demo-covers.ts, plus seed_/demo_auction_
 * rows whose cover is one of those placeholder URLs. Does not delete users or
 * touch any other listing.
 *
 * Production images update on deploy via displayPhoto even before this runs.
 * Run this against the live database so the stored URL matches:
 *   DATABASE_URL=... npx tsx scripts/refresh-demo-covers.ts --apply
 */
import { prisma } from "../lib/db";
import { DEMO_COVERS, buyerDescription } from "../lib/demo-covers";

const apply = process.argv.includes("--apply");

function coverFor(id: string, title: string, urls: string[]) {
  const row = DEMO_COVERS.find((item) => (item.ids as readonly string[]).includes(id) || (item.titles as readonly string[]).includes(title));
  if (row) return row.photo;
  for (const url of urls) {
    const hit = DEMO_COVERS.find((item) => (item.from as readonly string[]).includes(url));
    if (hit && (id.startsWith("seed_") || id.startsWith("demo_auction_"))) return hit.photo;
  }
  return null;
}

async function main() {
  const ids = DEMO_COVERS.flatMap((row) => [...row.ids]);
  const titles = DEMO_COVERS.flatMap((row) => [...row.titles]);
  const from = DEMO_COVERS.flatMap((row) => [...row.from]);
  const rows = await prisma.listing.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { title: { in: titles } },
        { id: { startsWith: "seed_" }, photos: { some: { url: { in: from } } } },
        { id: { startsWith: "demo_auction_" }, photos: { some: { url: { in: from } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      photos: { orderBy: { position: "asc" }, select: { id: true, url: true, position: true } },
    },
  });
  if (rows.length > 24) throw new Error(`refusing to touch ${rows.length} listings`);
  let photos = 0;
  let descriptions = 0;
  for (const row of rows) {
    const nextPhoto = coverFor(row.id, row.title, row.photos.map((photo) => photo.url));
    const nextDescription = buyerDescription(row.description);
    const known = from as readonly string[];
    const photoIds = row.photos.filter((photo) => photo.position === 0 || known.includes(photo.url)).map((photo) => photo.id);
    console.log(`${apply ? "write" : "dry"} ${row.id} ${row.title}`);
    if (nextPhoto) console.log(`  cover ${row.photos[0]?.url ?? "(none)"} -> ${nextPhoto}`);
    if (nextDescription !== row.description) console.log("  description drops the reserve amount");
    if (!apply) continue;
    if (nextPhoto && photoIds.length) {
      await prisma.listingPhoto.updateMany({ where: { id: { in: photoIds }, listingId: row.id }, data: { url: nextPhoto } });
      photos += photoIds.length;
    }
    if (nextDescription !== row.description) {
      await prisma.listing.update({ where: { id: row.id }, data: { description: nextDescription } });
      descriptions += 1;
    }
  }
  console.log(apply ? `updated ${photos} photos, ${descriptions} descriptions` : `dry-run ${rows.length} listings (pass --apply to write)`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "refresh failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
