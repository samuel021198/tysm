import Link from "next/link";
import type { DexPrintRegion } from "@/lib/dex";
import { catalogImageSrc } from "@/lib/catalog-image";
import type { Locale } from "@/lib/i18n";

export type DexGridCard = {
  id: string;
  nameEn: string;
  nameJa: string;
  collectorNumber: string;
  imageUrl: string;
  printRegion: DexPrintRegion;
  rarity: string | null;
  game?: string | null;
  set: { code: string; releaseDate: string | null };
};

function shortName(card: DexGridCard, locale: Locale): string {
  if (locale === "en") return card.nameEn;
  if (card.printRegion === "JP" && card.nameJa && card.nameJa !== card.nameEn) return card.nameJa;
  return card.nameEn;
}

export function DexGrid({ cards, locale }: { cards: DexGridCard[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => {
        const title = shortName(card, locale);
        return (
          <li key={card.id}>
            <Link href={`/dex/${card.id}`} className="surface flex h-full flex-col overflow-hidden active:scale-[0.99]">
              <img src={catalogImageSrc(card.imageUrl)} alt="" className="aspect-[63/88] w-full bg-[#f4efe6] object-contain" />
              <span className="line-clamp-2 px-1.5 pt-1.5 text-[13px] font-semibold leading-snug">{title}</span>
              <span className="line-clamp-1 px-1.5 pb-1.5 text-[11px] text-muted">
                {card.set.code} · {card.collectorNumber}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
