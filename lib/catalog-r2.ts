import type { CatalogGame } from "@prisma/client";
import { CATALOG_UA } from "./catalog-http";
import { prisma } from "./db";
import { catalogObjectKey, putR2Object, r2Config } from "./r2";

const MAX_BYTES = 8_000_000;

function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

function rasterType(header: string, buf: Buffer): string | null {
  const sniffed = sniffImage(buf);
  if (sniffed) return sniffed;
  if (header === "image/png" || header === "image/jpeg" || header === "image/webp" || header === "image/gif") return header;
  if (header === "image/jpg") return "image/jpeg";
  return null;
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  return "webp";
}

/** Fetch one remote card image into the public bucket. Null keeps the source URL. */
export async function mirrorRemoteImage(game: CatalogGame, externalId: string, source: string): Promise<string | null> {
  if (!source.startsWith("https://") || !r2Config()) return null;
  const res = await fetch(source, {
    headers: { accept: "image/*", "user-agent": CATALOG_UA },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok || !res.url.startsWith("https://")) return null;
  const declared = Number(res.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  // ponytail: buffers the body, then rejects over 8MB. Upgrade path: stream and abort past the cap.
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > MAX_BYTES) return null;
  const header = (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
  const contentType = rasterType(header, buf);
  if (!contentType) return null;
  return putR2Object(catalogObjectKey(game, externalId, extensionFor(contentType)), buf, contentType);
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function mirrorImages(game: CatalogGame, items: { externalId: string; source: string }[], deadline: number): Promise<number> {
  if (!items.length || !r2Config()) return 0;
  let imagesUploaded = 0;
  await pool(items, 4, async (item) => {
    if (Date.now() > deadline) return;
    try {
      const url = await mirrorRemoteImage(game, item.externalId, item.source);
      if (!url) return;
      await prisma.catalogCard.update({ where: { externalId: item.externalId }, data: { imageUrl: url } });
      imagesUploaded += 1;
    } catch (error) {
      console.error("catalog image skipped", item.externalId, error instanceof Error ? error.message.slice(0, 160) : "error");
    }
  });
  return imagesUploaded;
}

async function listUnmirrored(game: CatalogGame, take: number): Promise<{ externalId: string; source: string }[]> {
  const r2 = r2Config();
  if (!r2 || take <= 0) return [];
  const rows = await prisma.catalogCard.findMany({
    where: {
      game,
      sourceImageUrl: { startsWith: "https://" },
      NOT: { imageUrl: { startsWith: `${r2.publicBase}/` } },
    },
    select: { externalId: true, sourceImageUrl: true },
    take,
  });
  return rows.flatMap((row) => (row.sourceImageUrl ? [{ externalId: row.externalId, source: row.sourceImageUrl }] : []));
}

async function countUnmirrored(game: CatalogGame): Promise<number> {
  const r2 = r2Config();
  if (!r2) return 0;
  return prisma.catalogCard.count({
    where: {
      game,
      sourceImageUrl: { startsWith: "https://" },
      NOT: { imageUrl: { startsWith: `${r2.publicBase}/` } },
    },
  });
}

/**
 * Mirror this game's new rows, then up to 40 older ones, until `deadline`.
 * No-ops when R2 env is missing. Does not start a cron.
 */
export async function drainCatalogImages(
  game: CatalogGame,
  pending: { externalId: string; source: string }[],
  deadline: number,
): Promise<{ uploaded: number; pending: number; configured: boolean }> {
  if (!r2Config()) return { uploaded: 0, pending: 0, configured: false };
  let uploaded = 0;
  if (Date.now() < deadline) uploaded += await mirrorImages(game, pending, deadline);
  // ponytail: 40-image backlog per call, 4 at a time. Upgrade path: cursor on CatalogCard.id.
  if (Date.now() < deadline - 2_000) {
    const seen = new Set(pending.map((item) => item.externalId));
    const backlog = await listUnmirrored(game, 40);
    uploaded += await mirrorImages(
      game,
      backlog.filter((item) => !seen.has(item.externalId)),
      deadline,
    );
  }
  return { uploaded, pending: await countUnmirrored(game), configured: true };
}
