import type { ReactNode } from "react";
import Link from "next/link";
import { gameHasRegion, gameParam, setDisplayName, type DexGame, type DexPrintRegion } from "@/lib/dex";
import { tx, type Locale } from "@/lib/i18n";

const GAMES = [
  ["POKEMON", "寶可夢", "Pokémon"],
  ["ONE_PIECE", "海賊王", "One Piece"],
  ["RIFTBOUND", "Riftbound", "Riftbound"],
] as const;

export type DexRailSet = {
  id: string;
  code: string;
  nameEn: string;
  nameJa: string;
  printRegion: DexPrintRegion;
};

export function DexRail({
  locale,
  game,
  region,
  setId,
  sets,
  q,
  base,
}: {
  locale: Locale;
  game: DexGame;
  region: string;
  setId: string;
  sets: DexRailSet[];
  q: string;
  base: string;
}) {
  function href(next: { game?: DexGame; set?: string }) {
    const params = new URLSearchParams();
    const nextGame = next.game ?? game;
    params.set("game", gameParam(nextGame));
    if (q) params.set("q", q);
    if (region && gameHasRegion(nextGame) && nextGame === game) params.set("region", region);
    if (next.set) params.set("set", next.set);
    return `${base}?${params.toString()}`;
  }

  return (
    <nav
      aria-label={tx(locale, "遊戲同系列", "Games and sets")}
      className="sticky top-[var(--header-h)] max-h-[calc(100dvh-var(--header-h)-var(--tab-h)-0.75rem)] w-[4.75rem] shrink-0 overflow-y-auto overscroll-contain md:w-52"
    >
      <ul className="grid gap-1">
        {GAMES.map(([value, zh, en]) => {
          const on = game === value;
          return (
            <li key={value}>
              <Link
                href={href({ game: value })}
                aria-current={on && !setId ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold md:px-3 ${on ? "bg-card text-ink shadow-card" : "text-muted"}`}
              >
                <span className="truncate">{tx(locale, zh, en)}</span>
              </Link>
              {on ? (
                <ul className="mt-1 grid max-h-[50vh] gap-0.5 overflow-y-auto overscroll-contain pb-2" aria-label={tx(locale, "系列", "Sets")}>
                  <li>
                    <Link
                      href={href({ game: value })}
                      aria-current={!setId ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-2 text-xs md:px-3 ${!setId ? "bg-soft font-semibold text-ink" : "text-muted"}`}
                    >
                      {tx(locale, "全部", "All")}
                    </Link>
                  </li>
                  {sets.map((set) => {
                    const name = setDisplayName(set, set.printRegion, locale);
                    const selected = set.id === setId;
                    return (
                      <li key={set.id}>
                        <Link
                          href={href({ game: value, set: set.id })}
                          title={name}
                          aria-current={selected ? "page" : undefined}
                          className={`flex min-h-11 flex-col justify-center rounded-lg px-2 md:px-3 ${selected ? "bg-soft font-semibold text-ink" : "text-muted"}`}
                        >
                          <span className="truncate text-[11px] font-semibold leading-tight md:hidden">{set.code}</span>
                          <span className="hidden truncate text-xs leading-tight md:block">{name}</span>
                          <span className="hidden truncate text-[10px] text-muted md:block">{set.code}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DexColumns({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 md:gap-5">
      {rail}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
