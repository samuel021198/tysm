/** Showcase cards are the Demo game. A Pokémon set coded DEMO is not one of its series. */
export function hidePokemonDemoSeries<T extends { code: string }>(game: string, sets: readonly T[]): T[] {
  if (game !== "POKEMON") return sets as T[];
  return sets.filter((set) => set.code !== "DEMO");
}

/** First tap selects and opens sets. A second tap on the same game only collapses the set list. */
export function railToggle<T extends string>(current: T, open: boolean, next: T): { game: T; open: boolean; changed: boolean } {
  if (next === current) return { game: current, open: !open, changed: false };
  return { game: next, open: true, changed: true };
}
