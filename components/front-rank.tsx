import Link from "next/link";
import { frontRankBadge, type FrontRankPerson } from "@/lib/front-rank";
import { tx, type Locale } from "@/lib/i18n";

/** 64px slot fits the 56px avatar plus its corner badge. gap-2 separates cells. */
const SLOT = "w-16 shrink-0";

export function FrontRank({ locale, people }: { locale: Locale; people: FrontRankPerson[] }) {
  if (people.length === 0) return null;
  return (
    <section aria-label={tx(locale, "排行", "Ranking")} className="min-w-0 max-w-full">
      <div
        className="flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-gesture=""
        data-front-rank=""
      >
        {people.map((person) => {
          const badge = frontRankBadge(person.rank);
          return (
            <Link
              key={person.id}
              href={`/u/${person.id}`}
              aria-label={tx(locale, `第 ${person.rank} 名 ${person.nickname}`, `Rank ${person.rank} ${person.nickname}`)}
              className={`flex min-w-0 ${SLOT} flex-col items-center gap-1`}
            >
              <span className="relative flex h-16 w-14 shrink-0 items-end">
                <span className="grid h-14 min-h-0 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt="" width={56} height={56} decoding="async" className="h-full max-h-full w-full object-cover" />
                  ) : (
                    person.nickname.slice(0, 1)
                  )}
                </span>
                <span
                  aria-hidden
                  className={`absolute right-0 top-0 z-10 grid place-items-center rounded-full font-semibold leading-none ring-2 ring-bg ${badge.top ? "h-[18px] min-w-[18px] px-0.5 text-[9px]" : "h-3.5 min-w-3.5 px-0.5 text-[8px]"}`}
                  style={{ backgroundColor: badge.fill, color: badge.ink }}
                >
                  {badge.label}
                </span>
              </span>
              <span className="relative z-10 w-full truncate text-center text-[11px] leading-4">{person.nickname}</span>
            </Link>
          );
        })}
        <Link href="/rank" className={`flex min-w-0 ${SLOT} flex-col items-center`} aria-label={tx(locale, "全部排行", "All rankings")}>
          <span className="grid h-16 w-14 shrink-0 place-items-end">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-line bg-card text-xs font-semibold">{tx(locale, "全部", "All")}</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
