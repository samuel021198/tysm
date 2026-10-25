import Link from "next/link";
import { gameHasRegion, gameParam, type DexGame } from "@/lib/dex";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

const GAMES = [
  ["POKEMON", "寶可夢", "Pokémon"],
  ["ONE_PIECE", "海賊王", "One Piece"],
  ["RIFTBOUND", "Riftbound", "Riftbound"],
] as const;

const REGIONS = [
  ["", "全部", "All"],
  ["JP", "日文", "Japanese"],
  ["WEST", "英文", "English"],
] as const;

function chipClass(on: boolean) {
  return on
    ? "inline-flex h-11 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]"
    : "inline-flex h-11 items-center rounded-full bg-card px-4 text-sm font-semibold text-ink shadow-card";
}

export function DexToolbar({
  locale,
  q,
  region,
  game,
  action,
  chips,
}: {
  locale: Locale;
  q: string;
  region: string;
  game: DexGame;
  action: string;
  chips: string;
}) {
  const current = region === "JP" || region === "WEST" ? region : "";
  const regions = gameHasRegion(game);
  function href(next: { game?: DexGame; region?: string }) {
    const params = new URLSearchParams();
    const nextGame = next.game ?? game;
    params.set("game", gameParam(nextGame));
    if (q) params.set("q", q);
    const nextRegion = next.game && next.game !== game ? "" : next.region ?? current;
    if (nextRegion && gameHasRegion(nextGame)) params.set("region", nextRegion);
    return `${chips}?${params.toString()}`;
  }
  const placeholder =
    game === "ONE_PIECE"
      ? tx(locale, "卡名或卡號，例如 路飛 或 OP01-001", "Name or number, e.g. Luffy or OP01-001")
      : game === "RIFTBOUND"
        ? tx(locale, "卡名或卡號，例如 Annie 或 017", "Name or number, e.g. Annie or 017")
        : tx(locale, "卡名或卡號，例如 噴火龍 或 020", "Name or number, e.g. Charizard or 020");

  return (
    <div className="grid gap-3">
      <form action={action} className="flex h-14 items-center gap-2 rounded-full bg-card pl-3.5 pr-1.5 shadow-card">
        <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
        <label className="sr-only" htmlFor="dex-q">
          {tx(locale, "搜尋卡牌", "Search cards")}
        </label>
        <input
          id="dex-q"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-[var(--field-placeholder)]"
        />
        <input type="hidden" name="game" value={gameParam(game)} />
        {current && regions ? <input type="hidden" name="region" value={current} /> : null}
        <button className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]" type="submit">
          {tx(locale, "搜尋", "Search")}
        </button>
      </form>
      <div className="chips" aria-label={tx(locale, "遊戲", "Game")}>
        {GAMES.map(([value, zh, en]) => (
          <Link key={value} href={href({ game: value })} className={chipClass(game === value)} aria-current={game === value ? "page" : undefined}>
            {tx(locale, zh, en)}
          </Link>
        ))}
      </div>
      {regions ? (
        <div className="chips" aria-label={tx(locale, "語言", "Language")}>
          {REGIONS.map(([value, zh, en]) => (
            <Link key={value || "all"} href={href({ region: value })} className={chipClass(current === value)} aria-current={current === value ? "page" : undefined}>
              {tx(locale, zh, en)}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{tx(locale, "而家只有英文。", "English only for now.")}</p>
      )}
    </div>
  );
}
