import Link from "next/link";
import { catalogDisplayTitle } from "@/lib/card-title";
import type { DexPrintRegion } from "@/lib/dex";
import type { Locale } from "@/lib/i18n";

export type DexGridCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  imageUrl: string;
  printRegion: DexPrintRegion;
  rarity: string | null;
  set: { code: string; releaseDate: string | null };
};

export function DexGrid({ cards, locale }: { cards: DexGridCard[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => {
        const title = catalogDisplayTitle({
          releaseDate: card.set.releaseDate,
          setCode: card.set.code,
          printRegion: card.printRegion,
          collectorNumber: card.collectorNumber,
          cardName: card.nameEn,
          rarity: card.rarity,
        });
        const japanese = locale !== "en" && card.nameJa && card.nameJa !== card.nameEn ? card.nameJa : "";
        return (
          <li key={card.id}>
            <Link href={`/dex/${card.id}`} className="surface flex h-full flex-col overflow-hidden active:scale-[0.99]">
              <img src={card.imageUrl} alt="" className="aspect-[63/88] w-full bg-[#f4efe6] object-contain" />
              <span className={`line-clamp-3 px-3 pt-2.5 text-[15px] font-semibold leading-snug ${japanese ? "" : "pb-2.5"}`}>{title}</span>
              {japanese ? <span className="line-clamp-1 px-3 pb-2.5 pt-1 text-xs text-muted">{japanese}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
