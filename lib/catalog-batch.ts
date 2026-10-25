import { formatDexCursor, parseDexCursor } from "./tcgdex";

export type BatchItem = { externalId: string };

export type CatalogStep<T> = { item: T; cardOffset: number };

/**
 * A set is done when a finished pass stored `total` and the card rows cover it.
 * ponytail: `total` is the skip marker. A later source that grows the set is ignored until the row is deleted.
 */
export function catalogSetSettled(db: { count: number; total: number | null } | undefined): boolean {
  if (!db || db.total == null) return false;
  return db.count >= db.total;
}

/** Next sets to fetch. Settled rows do not consume `maxSets`. A `#offset` cursor stays on that set. */
export function planCatalogSteps<T extends BatchItem>(
  queue: readonly T[],
  args: { cursor: string | null | undefined; settled: ReadonlySet<string>; maxSets: number },
): { steps: CatalogStep<T>[]; skippedSettled: number } {
  const maxSets = Math.max(0, args.maxSets);
  const parsed = parseDexCursor(args.cursor);
  let index = 0;
  let forcedOffset: number | null = null;
  if (parsed) {
    const at = queue.findIndex((row) => row.externalId === parsed.externalId);
    if (at >= 0) {
      if (parsed.cardOffset == null) index = at + 1;
      else {
        index = at;
        forcedOffset = parsed.cardOffset;
      }
    }
  }
  const steps: CatalogStep<T>[] = [];
  let skippedSettled = 0;
  while (index < queue.length && steps.length < maxSets) {
    const item = queue[index]!;
    const resumeOffset = forcedOffset != null && steps.length === 0 && item.externalId === parsed?.externalId ? forcedOffset : 0;
    if (resumeOffset <= 0 && args.settled.has(item.externalId)) {
      skippedSettled += 1;
      index += 1;
      forcedOffset = null;
      continue;
    }
    steps.push({ item, cardOffset: resumeOffset });
    index += 1;
    forcedOffset = null;
  }
  return { steps, skippedSettled };
}

/** How many sets are still ahead of `cursor`, counting a mid-set cursor as unfinished. */
export function catalogRemaining<T extends BatchItem>(queue: readonly T[], settled: ReadonlySet<string>, cursor: string | null): number {
  const parsed = parseDexCursor(cursor);
  let start = 0;
  let mid = false;
  if (parsed) {
    const at = queue.findIndex((row) => row.externalId === parsed.externalId);
    if (at >= 0) {
      if (parsed.cardOffset == null) start = at + 1;
      else {
        start = at;
        mid = true;
      }
    }
  }
  let count = 0;
  for (let i = start; i < queue.length; i += 1) {
    if (mid && i === start) {
      count += 1;
      continue;
    }
    if (!settled.has(queue[i]!.externalId)) count += 1;
  }
  return count;
}

export function catalogCursor(externalId: string, cardOffset: number | null): string {
  return formatDexCursor(externalId, cardOffset);
}
