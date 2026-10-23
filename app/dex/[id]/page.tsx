import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectCatalogCard } from "@/actions/dex";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { primaryCardName, regionLabel, secondaryCardName, setDisplayName } from "@/lib/dex";
import { getDexCard, salesForCard } from "@/lib/dex-query";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { conditionLabel } from "@/lib/rules";
import { hiddenUserIds } from "@/lib/social";
import { Flash } from "@/components/shell";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getDexCard(id);
  if (!card) return { title: "圖鑑" };
  return { title: `${card.nameJa} ${card.nameEn}`, description: `${card.set.nameEn} ${card.collectorNumber}` };
}

function ask(listing: { saleType: string; auctionSettled: boolean; auctionEndsAt: Date | null; currentBid: number | null; startPrice: number | null; price: number | null }) {
  const live = listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  return live ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? 0;
}

export default async function DexCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const card = await getDexCard(id);
  if (!card) notFound();
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const [listings, owned] = await Promise.all([
    salesForCard(card.id, hidden),
    viewer
      ? prisma.collectionItem.findFirst({ where: { ownerId: viewer.id, catalogCardId: card.id }, select: { id: true } }).then(Boolean)
      : Promise.resolve(false),
  ]);
  const sales = sp.tab === "sales";
  const primary = primaryCardName(card, prefs.locale);
  const secondary = secondaryCardName(card, prefs.locale);
  const setName = setDisplayName(card.set, card.printRegion, prefs.locale);
  const rows: [string, string][] = [
    [tx(prefs.locale, "日文名", "Japanese name"), card.nameJa],
    [tx(prefs.locale, "英文名", "English name"), card.nameEn],
    [tx(prefs.locale, "系列", "Set"), setName],
    [tx(prefs.locale, "系列代碼", "Set code"), card.set.code],
    [tx(prefs.locale, "卡號", "Number"), card.collectorNumber],
    [tx(prefs.locale, "罕貴", "Rarity"), card.rarity || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "繪師", "Artist"), card.artist || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "語言", "Language"), regionLabel(card.printRegion, prefs.locale)],
  ];

  return (
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <Link href="/dex" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-link">
        {tx(prefs.locale, "返回圖鑑", "Back to the dex")}
      </Link>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
        <img src={card.imageUrl} alt={`${card.nameJa} ${card.nameEn}`} className="surface aspect-[63/88] w-full bg-[#f4efe6] object-contain" />
        <div>
          <p className="text-sm text-muted">
            {regionLabel(card.printRegion, prefs.locale)} · {setName}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{primary}</h1>
          {secondary ? <p className="mt-1 text-lg text-muted">{secondary}</p> : null}
          <p className="mt-2 font-semibold">{card.collectorNumber}</p>
          {owned ? (
            <Link href="/me?tab=box" className="btn btn-ghost mt-4 w-full md:w-auto">
              {tx(prefs.locale, "已加入收藏", "In your collection")}
            </Link>
          ) : (
            <form action={collectCatalogCard}>
              <input type="hidden" name="cardId" value={card.id} />
              <button className="btn btn-primary mt-4 w-full md:w-auto" type="submit">
                {tx(prefs.locale, "加入收藏", "Add to collection")}
              </button>
            </form>
          )}
        </div>
      </div>
      <nav className="chips mt-6" aria-label={tx(prefs.locale, "卡牌內容", "Card sections")}>
        <Link href={`/dex/${card.id}`} className={tabClass(!sales)} aria-current={!sales ? "page" : undefined}>
          {tx(prefs.locale, "資料", "Details")}
        </Link>
        <Link href={`/dex/${card.id}?tab=sales`} className={tabClass(sales)} aria-current={sales ? "page" : undefined}>
          {tx(prefs.locale, "放售", "For sale")} {listings.length ? `(${listings.length})` : ""}
        </Link>
      </nav>
      {sales ? (
        <section className="mt-4" aria-labelledby="dex-sales">
          <h2 id="dex-sales" className="sr-only">
            {tx(prefs.locale, "放售", "For sale")}
          </h2>
          {listings.length === 0 ? <p className="empty">{tx(prefs.locale, "暫時未有放售。", "Nothing for sale yet.")}</p> : null}
          <ul className="grid gap-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link href={`/listing/${listing.id}`} className="surface flex min-h-[5.5rem] items-center gap-3 p-3">
                  <img src={listing.photos[0]?.url || "/demo/back.svg"} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-[#f4efe6] object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block font-semibold">{listing.title}</span>
                    <span className="text-sm text-muted">
                      {conditionLabel(listing)} · {listing.seller.nickname}
                    </span>
                  </span>
                  <span className="price shrink-0 text-lg">{formatHkd(ask(listing), prefs.locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/search?q=${encodeURIComponent(card.nameEn)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link">
            {tx(prefs.locale, "睇全部放售", "See all for sale")}
          </Link>
        </section>
      ) : (
        <dl className="surface mt-4 grid gap-3 p-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function tabClass(on: boolean) {
  return on
    ? "inline-flex h-11 items-center rounded-full bg-gradient-to-r from-rose to-teal px-4 text-sm font-semibold text-[#1b1418]"
    : "inline-flex h-11 items-center rounded-full bg-card px-4 text-sm font-semibold text-ink shadow-card";
}
