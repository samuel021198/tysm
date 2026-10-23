import { prisma } from "./db";

export type CompRow = {
  id: string;
  title: string;
  unitPrice: number;
  completedAt: Date | null;
  conditionTrack: "RAW" | "GRADED";
  rawGrade: string | null;
  grader: string | null;
  gradeValue: number | null;
  matched: boolean;
};

type Identity = {
  id: string;
  cardName: string | null;
  personName: string | null;
  conditionTrack: "RAW" | "GRADED";
  rawGrade: string | null;
  grader: string | null;
  gradeValue: number | null;
};

export function compKey(row: {
  cardName?: string | null;
  personName?: string | null;
  conditionTrack?: string | null;
  rawGrade?: string | null;
  grader?: string | null;
  gradeValue?: number | null;
}): string {
  const name = (row.cardName || row.personName || "").trim();
  if (!name) return "";
  const grade = row.conditionTrack === "GRADED" ? `${row.grader ?? ""}:${row.gradeValue ?? ""}` : `RAW:${row.rawGrade ?? ""}`;
  return `${name}|${grade}`;
}

function sameGrade(listing: Identity, row: { conditionTrack: string; rawGrade: string | null; grader: string | null; gradeValue: number | null }) {
  if (listing.conditionTrack === "GRADED") {
    return row.conditionTrack === "GRADED" && row.grader === listing.grader && row.gradeValue === listing.gradeValue;
  }
  return row.conditionTrack === "RAW" && row.rawGrade === listing.rawGrade;
}

export async function loadComps(listing: Identity): Promise<{ matched: CompRow[]; others: CompRow[] }> {
  const name = listing.cardName || listing.personName;
  if (!name) return { matched: [], others: [] };
  const rows = await prisma.orderItem.findMany({
    where: {
      order: { status: "COMPLETED" },
      listingId: { not: listing.id },
      ...(listing.cardName ? { cardName: listing.cardName } : { personName: listing.personName }),
    },
    include: {
      order: { select: { completedAt: true } },
      listing: { select: { conditionTrack: true, rawGrade: true, grader: true, gradeValue: true } },
    },
    orderBy: { order: { completedAt: "desc" } },
    take: 24,
  });
  const mapped: CompRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    unitPrice: row.unitPrice,
    completedAt: row.order.completedAt,
    conditionTrack: row.listing.conditionTrack,
    rawGrade: row.listing.rawGrade,
    grader: row.listing.grader,
    gradeValue: row.listing.gradeValue,
    matched: sameGrade(listing, row.listing),
  }));
  return {
    matched: mapped.filter((row) => row.matched).slice(0, 6),
    others: mapped.filter((row) => !row.matched).slice(0, 4),
  };
}

export async function loadCompSeries(): Promise<Map<string, number[]>> {
  const rows = await prisma.orderItem.findMany({
    where: { order: { status: "COMPLETED" } },
    include: {
      order: { select: { completedAt: true } },
      listing: {
        select: { cardName: true, personName: true, conditionTrack: true, rawGrade: true, grader: true, gradeValue: true },
      },
    },
    orderBy: { order: { completedAt: "asc" } },
    take: 240,
  });
  const series = new Map<string, number[]>();
  for (const row of rows) {
    const key = compKey({ ...row.listing, cardName: row.cardName ?? row.listing.cardName, personName: row.personName ?? row.listing.personName });
    if (!key) continue;
    const bucket = series.get(key) ?? [];
    bucket.push(row.unitPrice);
    series.set(key, bucket);
  }
  return series;
}
