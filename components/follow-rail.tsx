import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";
import type { FollowRailPerson } from "@/lib/social";

/** Phone strip: 44px avatar + 12px name = 58px, four gaps, 4.5 slots so the next avatar peeks. */
const SLOT = "w-[calc((100%-2rem)/4.5)]";

export function FollowRail({ locale, people }: { locale: Locale; people: FollowRailPerson[] }) {
  if (people.length === 0) return null;
  return (
    <section aria-label={tx(locale, "關注的人", "Following")} className="h-[58px] overflow-hidden">
      <div
        className="flex h-[58px] flex-nowrap gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-gesture=""
      >
        {people.map((person) => (
          <Link key={person.id} href={`/shop/${person.id}`} className={`flex h-[58px] ${SLOT} shrink-0 flex-col items-center gap-0.5`}>
            <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-accent">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" width={44} height={44} decoding="async" className="absolute inset-0 h-11 w-11 object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold leading-none text-white">{person.nickname.slice(0, 1)}</span>
              )}
            </span>
            <span className="h-3 w-full truncate text-center text-[10px] leading-3 text-muted">{person.nickname}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
