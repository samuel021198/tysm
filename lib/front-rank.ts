import { DEMO_ACCOUNTS, TRIAL_ACCOUNTS } from "./demo-login";
import { prisma } from "./db";
import { SOFT_SELLER_IDS } from "./soft-sellers";

/** Story row on Front. Ten cells, then the 全部 chip. */
export const FRONT_RANK_LIMIT = 10;

/**
 * Demo strip order: soft-seed sellers, then the reseed demo sellers that exist.
 * ponytail: not deals, 飛, or ratings. Upgrade path: swap this list for the formal /rank metric.
 */
export const FRONT_RANK_ORDER: readonly string[] = [
  ...SOFT_SELLER_IDS,
  ...DEMO_ACCOUNTS.map((row) => row.id),
  ...TRIAL_ACCOUNTS.map((row) => row.id),
];

export type FrontRankPerson = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  rank: number;
};

export function frontRankBadge(rank: number): { fill: string; ink: string; label: string; top: boolean } {
  if (rank === 1) return { fill: "#E0B53A", ink: "#ffffff", label: "#1", top: true };
  if (rank === 2) return { fill: "#B7C0C8", ink: "#ffffff", label: "#2", top: true };
  if (rank === 3) return { fill: "#C9844A", ink: "#ffffff", label: "#3", top: true };
  return { fill: "#e2e8f0", ink: "#64748b", label: String(rank), top: false };
}

/** Keep `order`. Skip anyone missing or hidden. Do not sort by a score. */
export function pickFrontRank(
  order: readonly string[],
  people: { id: string; nickname: string; avatarUrl: string | null }[],
  hidden: string[],
  limit = FRONT_RANK_LIMIT,
): FrontRankPerson[] {
  const hiddenSet = new Set(hidden);
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: FrontRankPerson[] = [];
  for (const id of order) {
    if (hiddenSet.has(id)) continue;
    const person = byId.get(id);
    if (!person) continue;
    rows.push({ id: person.id, nickname: person.nickname, avatarUrl: person.avatarUrl, rank: rows.length + 1 });
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function loadFrontRank(hiddenIds: string[]): Promise<FrontRankPerson[]> {
  const hidden = new Set(hiddenIds);
  const ids = FRONT_RANK_ORDER.filter((id) => !hidden.has(id));
  if (!ids.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, nickname: true, avatarUrl: true },
  });
  return pickFrontRank(FRONT_RANK_ORDER, users, hiddenIds);
}
