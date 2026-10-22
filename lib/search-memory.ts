import { forgetMemory, memoryKey, mergeMemory, rememberMemory, type MemoryItem } from "./search";

export const MEMORY_EVENT = "tysm-search-memory";

const RECENT = "tysm-recent-searches";
const SAVED = "tysm-saved-searches";

// ponytail: saved searches and category scope live on this device only. The account
// stores the query string. Upgrade path: a SavedSearch table plus cat slug on SearchHistory.
let ignorePull = false;
const dropped = new Set<string>();

function read(key: string): MemoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as MemoryItem[];
    if (!Array.isArray(parsed)) return [];
    return mergeMemory(parsed, [], key === SAVED ? 20 : 12);
  } catch {
    return [];
  }
}

function write(key: string, items: MemoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event(MEMORY_EVENT));
}

function send(body: unknown) {
  if (typeof fetch !== "function") return;
  void fetch("/api/recent", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function readRecent(): MemoryItem[] {
  return read(RECENT);
}

export function readSaved(): MemoryItem[] {
  return read(SAVED);
}

export function writeRecent(items: MemoryItem[]) {
  write(RECENT, items);
}

export function writeSaved(items: MemoryItem[]) {
  write(SAVED, items.slice(0, 20));
}

export function pushRecent(item: MemoryItem): MemoryItem[] {
  if (!item.cat) dropped.delete(memoryKey(item));
  const next = rememberMemory(readRecent(), item, 12);
  writeRecent(next);
  return next;
}

export function removeRecent(item: MemoryItem): MemoryItem[] {
  if (!item.cat) {
    dropped.add(memoryKey(item));
    send({ query: item.query });
  }
  const next = forgetMemory(readRecent(), item);
  writeRecent(next);
  return next;
}

export function mergeAccount(incoming: MemoryItem[]): MemoryItem[] {
  if (typeof window === "undefined" || ignorePull) return readRecent();
  const next = mergeMemory(
    readRecent(),
    incoming.filter((item) => !dropped.has(memoryKey(item))),
    12,
  );
  writeRecent(next);
  return next;
}

export function clearRecent(): MemoryItem[] {
  ignorePull = true;
  dropped.clear();
  writeRecent([]);
  send({ all: true });
  return [];
}

export function pushSaved(item: MemoryItem): MemoryItem[] {
  const next = rememberMemory(readSaved(), item, 20);
  writeSaved(next);
  return next;
}

export function removeSaved(item: { query: string; cat?: string }): MemoryItem[] {
  const next = forgetMemory(readSaved(), item);
  writeSaved(next);
  return next;
}

export async function pullAccountRecent(): Promise<void> {
  if (typeof fetch !== "function" || ignorePull) return;
  try {
    const res = await fetch("/api/recent");
    if (!res.ok || ignorePull) return;
    const rows = (await res.json()) as { query?: string }[];
    if (ignorePull || !Array.isArray(rows)) return;
    const incoming = rows
      .map((row) => ({ query: row.query || "" }))
      .filter((row) => row.query && !dropped.has(memoryKey(row)));
    if (ignorePull) return;
    writeRecent(mergeMemory(readRecent(), incoming, 12));
  } catch {
    /* offline or logged out */
  }
}
