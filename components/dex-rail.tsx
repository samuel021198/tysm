"use client";

import type { ReactNode } from "react";
import { setDisplayName, type DexGame, type DexPrintRegion } from "@/lib/dex";
import { tx, type Locale } from "@/lib/i18n";

const GAMES = [
  ["POKEMON", "寶可夢", "Pokémon"],
  ["ONE_PIECE", "海賊王", "One Piece"],
  ["RIFTBOUND", "Riftbound", "Riftbound"],
  ["TOPPS_BASKETBALL", "Topps 籃球", "Topps Basketball"],
  ["TOPPS_SOCCER", "Topps 足球", "Topps Soccer"],
  ["DEMO", "Demo", "Demo"],
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
  open,
  setId,
  sets,
  onGame,
  onSet,
}: {
  locale: Locale;
  game: DexGame;
  open: boolean;
  setId: string;
  sets: DexRailSet[];
  onGame: (game: DexGame) => void;
  onSet: (setId: string) => void;
}) {
  return (
    <nav aria-label={tx(locale, "遊戲同系列", "Games and sets")} className="flex h-full min-h-0 w-[4.25rem] shrink-0 flex-col md:w-52">
      <ul className="flex min-h-0 flex-1 flex-col gap-1">
        {GAMES.map(([value, zh, en]) => {
          const on = game === value;
          const expanded = on && open;
          return (
            <li key={value} className={expanded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "shrink-0"}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                aria-expanded={on ? open : false}
                onClick={() => onGame(value)}
                className={`flex min-h-11 w-full shrink-0 items-center rounded-xl px-2 text-left text-sm font-semibold md:px-3 ${on ? "bg-card text-ink shadow-card" : "text-muted"}`}
              >
                <span className="truncate">{tx(locale, zh, en)}</span>
              </button>
              {expanded ? (
                <ul className="mt-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto overscroll-contain pb-2 pl-1 md:pl-2" aria-label={tx(locale, "系列", "Sets")}>
                  <li>
                    <button
                      type="button"
                      aria-current={!setId ? "page" : undefined}
                      onClick={() => onSet("")}
                      className={`flex min-h-11 w-full items-center rounded-lg px-2 text-left text-xs md:px-3 ${!setId ? "bg-soft font-semibold text-ink" : "text-muted"}`}
                    >
                      {tx(locale, "全部", "All")}
                    </button>
                  </li>
                  {sets.map((set) => {
                    const name = setDisplayName(set, set.printRegion, locale);
                    const selected = set.id === setId;
                    return (
                      <li key={set.id}>
                        <button
                          type="button"
                          title={name}
                          aria-current={selected ? "page" : undefined}
                          onClick={() => onSet(set.id)}
                          className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-2 text-left md:px-3 ${selected ? "bg-soft font-semibold text-ink" : "text-muted"}`}
                        >
                          <span className="truncate text-[11px] font-semibold leading-tight md:hidden">{set.code}</span>
                          <span className="hidden truncate text-xs leading-tight md:block">{name}</span>
                          <span className="hidden truncate text-[10px] text-muted md:block">{set.code}</span>
                        </button>
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
    <div className="mt-3 flex min-h-0 min-w-0 flex-1 items-stretch gap-2 overflow-hidden md:gap-5">
      {rail}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
