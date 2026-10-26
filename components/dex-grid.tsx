import Link from "next/link";
import { compactSetLine } from "@/lib/card-line";
import { catalogTileSrc } from "@/lib/catalog-image";
import type { DexPrintRegion } from "@/lib/dex";
import type { Locale } from "@/lib/i18n";

export type DexGridCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  imageUrl: string;
  printRegion: DexPrintRegion;
  set: { code: string; releaseDate?: string | null };
};

export function cardDisplayName(card: { nameEn: string; nameJa: string; printRegion: string }, locale: Locale): string {
  if (locale === "en") return card.nameEn;
  if (card.printRegion === "JP" && card.nameJa && card.nameJa !== card.nameEn) return card.nameJa;
  return card.nameEn;
}

export function DexGrid({ cards, locale }: { cards: DexGridCard[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {cards.map((card, index) => {
        const title = cardDisplayName(card, locale);
        return (
          <li key={card.id} className="min-w-0">
            <Link href={`/dex/${card.id}`} className="surface flex h-full min-w-0 flex-col overflow-hidden active:scale-[0.99]">
              <img
                src={catalogTileSrc(card.imageUrl)}
                alt=""
                width={126}
                height={176}
                loading={index < 6 ? "eager" : "lazy"}
                decoding="async"
                className="aspect-[63/88] w-full bg-soft object-contain"
              />
              <span className="line-clamp-2 px-1.5 pt-1.5 text-[15px] font-semibold leading-snug">{title}</span>
              <span className="line-clamp-1 px-1.5 pb-1.5 text-[10px] leading-tight text-muted">{compactSetLine(card.set.code, card.collectorNumber)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
