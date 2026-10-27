import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { collectCatalogCard } from "@/actions/dex";
import { getPrefs, getViewer } from "@/lib/auth";
import { compactSetLine } from "@/lib/card-line";
import { catalogTitleFromCard } from "@/lib/card-title";
import { catalogImageSrc } from "@/lib/catalog-image";
import { prisma } from "@/lib/db";
import { gameHasRegion, gameParam, numberKey, parseGame, regionLabel, setDisplayName } from "@/lib/dex";
import { getDexCard } from "@/lib/dex-query";
import { tx, type Locale } from "@/lib/i18n";
import { parseTrendRange, snkrEnabled, type SnkrCardRef, type TrendRange } from "@/lib/snkrdunk";
import { DexSales, DexStory, GameMarketNotice, GameMarketPanel, LiveMarketAside, LiveMarketFacts, LivePricePanel, MarketSkeleton } from "@/components/dex-market-panel";
import { ShareButton } from "@/components/share-button";
import { Flash } from "@/components/shell";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getDexCard(id);
  if (!card) return { title: "圖鑑" };
  const title = catalogTitleFromCard(card);
  return { title, description: title };
}

function cardName(card: { nameEn: string; nameJa: string; printRegion: string }, locale: Locale) {
  if (locale === "en") return card.nameEn;
  if (card.printRegion === "JP" && card.nameJa && card.nameJa !== card.nameEn) return card.nameJa;
  return card.nameEn;
}

const RANGES_NOTE = "價格";

export default async function DexCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; tab?: string; range?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const card = await getDexCard(id);
  if (!card) notFound();
  const game = parseGame(card.game) ?? "POKEMON";
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const owned = viewer
    ? await prisma.collectionItem.findFirst({ where: { ownerId: viewer.id, catalogCardId: card.id }, select: { id: true } }).then(Boolean)
    : false;
  const tab = sp.tab === "data" || sp.tab === "story" || sp.tab === "sales" ? sp.tab : "price";
  const range = parseTrendRange(sp.range);
  const title = cardName(card, prefs.locale);
  const setName = setDisplayName(card.set, card.printRegion, prefs.locale);
  const back = dexBack(game, card.printRegion, card.set.id);
  const quoted = snkrEnabled(card.game);
  const ref: SnkrCardRef = {
    game: card.game,
    printRegion: card.printRegion,
    setCode: card.set.code,
    setNameEn: card.set.nameEn,
    setNameJa: card.set.nameJa,
    collectorNumber: card.collectorNumber,
    numberKey: card.numberKey || numberKey(card.collectorNumber),
    nameEn: card.nameEn,
    nameJa: card.nameJa,
    rarity: card.rarity,
    finish: card.finish,
  };
  const topps = game === "TOPPS_BASKETBALL" || game === "TOPPS_SOCCER";
  const rows: [string, string][] = [
    ...(card.nameJa !== card.nameEn
      ? ([
          [tx(prefs.locale, "日文名", "Japanese name"), card.nameJa],
          [tx(prefs.locale, "英文名", "English name"), card.nameEn],
        ] as [string, string][])
      : [[tx(prefs.locale, "卡名", "Name"), card.nameEn] as [string, string]]),
    [tx(prefs.locale, "系列", "Set"), setName],
    [tx(prefs.locale, "系列代碼", "Set code"), card.set.code],
    [tx(prefs.locale, "卡號", "Number"), card.collectorNumber],
    [
      topps ? tx(prefs.locale, "球隊", "Team") : tx(prefs.locale, "版本", "Finish"),
      card.finish || (topps ? tx(prefs.locale, "未有", "Unknown") : tx(prefs.locale, "普通", "Normal")),
    ],
    [tx(prefs.locale, "罕貴", "Rarity"), card.rarity || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "繪師", "Artist"), card.artist || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "語言", "Language"), regionLabel(card.printRegion, prefs.locale)],
  ];

  return (
    <div className="mx-auto max-w-lg pb-28">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <header className="flex items-center gap-0.5">
        <Link href={back} aria-label={tx(prefs.locale, "返回圖鑑", "Back to the dex")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full">
          <Chevron />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.2rem] font-bold leading-tight">{title}</h1>
          <p className="truncate text-[11px] text-muted">{compactSetLine(card.set.code, card.collectorNumber)}</p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-start gap-3">
        <img src={catalogImageSrc(card.imageUrl)} alt={title} width={240} height={336} decoding="async" className="aspect-[63/88] w-full rounded-2xl bg-soft object-contain shadow-card" />
        {quoted ? (
          <Suspense fallback={<MarketSkeleton />}>
            <LiveMarketAside card={ref} locale={prefs.locale} />
          </Suspense>
        ) : (
          <GameMarketNotice locale={prefs.locale} />
        )}
      </div>
      {quoted ? (
        <Suspense fallback={null}>
          <LiveMarketFacts card={ref} locale={prefs.locale} />
        </Suspense>
      ) : null}

      <nav className="mt-5 flex border-b border-line" aria-label={tx(prefs.locale, "卡牌內容", "Card sections")}>
        {(
          [
            ["price", tx(prefs.locale, RANGES_NOTE, "Price")],
            ["data", tx(prefs.locale, "資料", "Details")],
            ["story", tx(prefs.locale, "背景故事", "Story")],
            ["sales", tx(prefs.locale, "放售", "For sale")],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={tabHref(card.id, key, range)} className={tabClass(tab === key)} aria-current={tab === key ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "price" ? (
        quoted ? (
          <Suspense fallback={<p className="empty">{tx(prefs.locale, "載入行情…", "Loading prices…")}</p>}>
            <LivePricePanel card={ref} locale={prefs.locale} range={range} cardId={card.id} />
          </Suspense>
        ) : (
          <GameMarketPanel locale={prefs.locale} />
        )
      ) : null}
      {tab === "data" ? (
        <dl className="surface mt-4 grid gap-3 p-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tab === "story" ? (
        <Suspense fallback={<p className="empty">{tx(prefs.locale, "載入背景…", "Loading story…")}</p>}>
          <DexStory externalId={card.externalId} game={card.game} locale={prefs.locale} />
        </Suspense>
      ) : null}
      {tab === "sales" ? (
        <Suspense fallback={<p className="empty">{tx(prefs.locale, "載入放售…", "Loading listings…")}</p>}>
          <DexSales cardId={card.id} game={card.game} locale={prefs.locale} nameEn={card.nameEn} imageUrl={card.imageUrl} />
        </Suspense>
      ) : null}

      <div className="fixed inset-x-0 bottom-[var(--tab-h)] z-30 border-t border-line bg-card/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          {owned ? (
            <Link href="/me?tab=box" className="btn btn-primary flex-1">
              {tx(prefs.locale, "已加入收藏", "In your collection")}
            </Link>
          ) : (
            <form action={collectCatalogCard} className="flex-1">
              <input type="hidden" name="cardId" value={card.id} />
              <button className="btn btn-primary w-full" type="submit">
                {tx(prefs.locale, "加入收藏", "Add to collection")}
              </button>
            </form>
          )}
          <ShareButton path={`/dex/${card.id}`} label={tx(prefs.locale, "分享", "Share")} copiedLabel={tx(prefs.locale, "已複製", "Copied")} icon />
        </div>
      </div>
    </div>
  );
}

function dexBack(game: ReturnType<typeof parseGame>, region: string, setId: string) {
  const resolved = game ?? "POKEMON";
  const params = new URLSearchParams();
  params.set("game", gameParam(resolved));
  if (gameHasRegion(resolved) && (region === "JP" || region === "WEST")) params.set("region", region);
  params.set("set", setId);
  return `/dex?${params.toString()}`;
}

function tabHref(id: string, tab: string, range: TrendRange) {
  const params = new URLSearchParams();
  if (tab !== "price") params.set("tab", tab);
  if (tab === "price" && range !== "all") params.set("range", range);
  const query = params.toString();
  return query ? `/dex/${id}?${query}` : `/dex/${id}`;
}

function tabClass(on: boolean) {
  return on
    ? "flex min-h-11 flex-1 items-center justify-center border-b-2 border-ink text-sm font-semibold"
    : "flex min-h-11 flex-1 items-center justify-center text-sm font-medium text-muted";
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14.5 6.5 8.5 12l6 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

