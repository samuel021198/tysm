import Link from "next/link";
import { primaryCardName, secondaryCardName, setDisplayName, type DexPrintRegion } from "@/lib/dex";
import type { Locale } from "@/lib/i18n";

export type DexGridCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  imageUrl: string;
  printRegion: DexPrintRegion;
  set: { nameEn: string; nameJa: string };
};

export function DexGrid({ cards, locale }: { cards: DexGridCard[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => {
        const primary = primaryCardName(card, locale);
        const secondary = secondaryCardName(card, locale);
        const setName = setDisplayName(card.set, card.printRegion, locale);
        return (
          <li key={card.id}>
            <Link href={`/dex/${card.id}`} className="surface flex h-full flex-col overflow-hidden active:scale-[0.99]">
              <img src={card.imageUrl} alt="" className="aspect-[63/88] w-full bg-[#f4efe6] object-contain" />
              <span className="line-clamp-2 px-3 pt-2.5 text-[15px] font-semibold leading-snug">{primary}</span>
              {secondary ? <span className="line-clamp-1 px-3 text-xs text-muted">{secondary}</span> : null}
              <span className="line-clamp-2 px-3 pb-3 pt-1 text-xs text-muted">
                {setName} · {card.collectorNumber}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
