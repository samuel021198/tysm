export const ADMIN_TABS = ["users", "applications", "listings", "reports", "disputes", "categories"] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

/** Missing or unknown tab opens 申請. */
export function adminTab(value: string | undefined): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : "applications";
}

export function reportHref(type: string, id: string): string | null {
  if (!id || id.includes("/") || id.includes("\\")) return null;
  if (type === "LISTING") return `/listing/${id}`;
  if (type === "USER") return `/u/${id}`;
  if (type === "POST") return `/post/${id}`;
  if (type === "THREAD") return `/messages/${id}`;
  return null;
}

/** OPEN and APPEALED stay above decided rows. Relative order inside a band is kept. */
export function openFirst<T extends { status: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(a.status !== "OPEN" && a.status !== "APPEALED") - Number(b.status !== "OPEN" && b.status !== "APPEALED"));
}
