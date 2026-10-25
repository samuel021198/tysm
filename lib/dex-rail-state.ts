/** First tap selects and opens sets. A second tap on the same game only collapses the set list. */
export function railToggle<T extends string>(current: T, open: boolean, next: T): { game: T; open: boolean; changed: boolean } {
  if (next === current) return { game: current, open: !open, changed: false };
  return { game: next, open: true, changed: true };
}
