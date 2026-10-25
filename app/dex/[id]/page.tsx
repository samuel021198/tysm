import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectCatalogCard } from "@/actions/dex";
import { getPrefs, getViewer } from "@/lib/auth";
import { catalogTitleFromCard } from "@/lib/card-title";
import { catalogImageSrc } from "@/lib/catalog-image";
import { prisma } from "@/lib/db";
import { gameParam, numberKey, parseGame, regionLabel, setDisplayName } from "@/lib/dex";
import { getDexCard, salesForCard } from "@/lib/dex-query";
import { catalogFlavor } from "@/lib/flavor";
import { formatHkd, formatJpy } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { conditionLabel } from "@/lib/rules";
import { hiddenUserIds } from "@/lib/social";
import {
  formatPct,
  gradeLabel,
  loadSnkrMarket,
  localizeSnkrDate,
  marketStats,
  parseTrendRange,
  slicePoints,
  type SnkrMarket,
  type TrendRange,
} from "@/lib/snkrdunk";
import { PriceChart } from "@/components/price-chart";
import { ShareButton } from "@/components/share-button";
import { Flash } from "@/components/shell";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getDexCard(id);
  if (!card) return { title: "圖鑑" };
  const title = catalogTitleFromCard(card);
  return { title, description: title };
}

function ask(listing: { saleType: string; auctionSettled: boolean; auctionEndsAt: Date | null; currentBid: number | null; startPrice: number | null; price: number | null }) {
  const live = listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt != null && listing.auctionEndsAt > new Date();
  return live ? listing.currentBid ?? listing.startPrice ?? 0 : listing.price ?? listing.currentBid ?? 0;
}

function shortName(card: { nameEn: string; nameJa: string; printRegion: string }, locale: Locale) {
  if (locale === "en") return card.nameEn;
  if (card.printRegion === "JP" && card.nameJa && card.nameJa !== card.nameEn) return card.nameJa;
  return card.nameEn;
}

const RANGES: TrendRange[] = ["1w", "1m", "3m", "all"];

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
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const [listings, owned, market, flavor] = await Promise.all([
    salesForCard(card.id, hidden, game),
    viewer
      ? prisma.collectionItem.findFirst({ where: { ownerId: viewer.id, catalogCardId: card.id }, select: { id: true } }).then(Boolean)
      : Promise.resolve(false),
    loadSnkrMarket({
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
    }),
    catalogFlavor(card.externalId, card.game),
  ]);
  const tab = sp.tab === "data" || sp.tab === "story" || sp.tab === "sales" ? sp.tab : "price";
  const range = parseTrendRange(sp.range);
  const title = shortName(card, prefs.locale);
  const setName = setDisplayName(card.set, card.printRegion, prefs.locale);
  const back = dexBack(game, card.printRegion, card.set.id);
  const shown = slicePoints(market.points, range, Date.now());
  const stats = marketStats(shown);
  const allChange = marketStats(market.points)?.changePct ?? null;
  const grade = market.grade ? gradeLabel(market.grade === "PSA10" ? "PSA10" : "A", prefs.locale) : null;
  const low = market.rangeLow ?? marketStats(market.points)?.low ?? null;
  const high = market.rangeHigh ?? marketStats(market.points)?.high ?? null;
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
    [tx(prefs.locale, "版本", "Finish"), card.finish || tx(prefs.locale, "普通", "Normal")],
    [tx(prefs.locale, "罕貴", "Rarity"), card.rarity || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "繪師", "Artist"), card.artist || tx(prefs.locale, "未有", "Unknown")],
    [tx(prefs.locale, "語言", "Language"), regionLabel(card.printRegion, prefs.locale)],
  ];

  return (
    <div className="mx-auto max-w-lg pb-28">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <header className="flex items-start gap-1">
        <Link href={back} aria-label={tx(prefs.locale, "返回圖鑑", "Back to the dex")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <Chevron />
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
          <p className="truncate text-xs text-muted">
            {setName} · {card.set.code} {card.collectorNumber}
          </p>
        </div>
        {owned ? (
          <Link href="/me?tab=box" aria-label={tx(prefs.locale, "已加入收藏", "In your collection")} className="grid h-11 w-11 place-items-center text-rose">
            <Heart filled />
          </Link>
        ) : (
          <form action={collectCatalogCard}>
            <input type="hidden" name="cardId" value={card.id} />
            <button type="submit" aria-label={tx(prefs.locale, "加入收藏", "Add to collection")} className="grid h-11 w-11 place-items-center">
              <Heart />
            </button>
          </form>
        )}
        <details className="relative">
          <summary aria-label={tx(prefs.locale, "更多", "More")} className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full text-lg font-bold [&::-webkit-details-marker]:hidden">
            ⋯
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-2xl bg-card p-1 shadow-card">
            <Link href={back} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold">
              {tx(prefs.locale, "返回系列", "Back to the set")}
            </Link>
          </div>
        </details>
      </header>

      <div className="mt-3 grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-start gap-3">
        <img src={catalogImageSrc(card.imageUrl)} alt={title} className="aspect-[63/88] w-full rounded-2xl bg-[#f4efe6] object-contain shadow-card" />
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>{tx(prefs.locale, "市場價", "Market")}</span>
            {grade ? <span className="rounded-md bg-ink px-1.5 py-0.5 font-semibold text-card">{grade}</span> : null}
          </div>
          {market.status === "ok" && market.price != null ? (
            <>
              <p className="price mt-1 text-3xl leading-none">
                {formatJpy(market.price)} <span className="text-sm font-semibold text-muted">JPY</span>
              </p>
              {allChange != null ? (
                <p className={`mt-1 text-sm font-semibold ${allChange >= 0 ? "text-ok" : "text-danger"}`}>
                  {formatPct(allChange)} ALL
                </p>
              ) : null}
              {market.saleCount > 0 && market.saleCount < 3 ? (
                <p className="mt-1 text-xs text-muted">{tx(prefs.locale, `信心度低：只有 ${market.saleCount} 宗成交`, `Low confidence: ${market.saleCount} sales`)}</p>
              ) : null}
              {market.recent.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-muted">{tx(prefs.locale, "最近成交", "Recent sales")}</p>
                  <ul className="mt-1 grid gap-1">
                    {market.recent.map((sale, index) => (
                      <li key={`${sale.date}-${sale.price}-${index}`} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-muted">
                          {localizeSnkrDate(sale.date, prefs.locale)}
                          <span className="ml-1 text-[11px]">JP</span>
                        </span>
                        <span className="price shrink-0">{formatJpy(sale.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-2 text-[11px] text-muted">SNKRDUNK · JPY</p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {market.status === "unavailable"
                ? tx(prefs.locale, "暫時無法讀取市場數據，請稍後再試。", "Market data is unavailable right now. Try again shortly.")
                : tx(prefs.locale, "暫未有市場數據", "No market data yet")}
            </p>
          )}
        </div>
      </div>

      {market.status === "ok" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="surface p-3">
            <p className="text-xs text-muted">{grade ? `ALL 成交 · ${grade}` : tx(prefs.locale, "ALL 成交", "All sales")}</p>
            <p className="price mt-1 text-lg leading-tight">{low != null && high != null ? `${formatJpy(low)}–${formatJpy(high)}` : "—"}</p>
            <p className="mt-1 text-xs text-muted">
              {market.saleCountCapped
                ? tx(prefs.locale, `${market.saleCount}+ 宗成交`, `${market.saleCount}+ sales`)
                : tx(prefs.locale, `${market.saleCount} 宗成交`, `${market.saleCount} sales`)}
            </p>
          </div>
          <div className={`p-3 ${market.premium != null ? "surface ring-2 ring-teal" : "surface"}`}>
            <p className="text-xs text-muted">{tx(prefs.locale, "PSA 10 對比 A 級", "PSA 10 vs grade A")}</p>
            <p className={`price mt-1 text-2xl leading-none ${market.premium != null ? "text-ok" : "text-muted"}`}>
              {market.premium != null ? `${market.premium.toFixed(1)}×` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">{market.premium != null ? tx(prefs.locale, "鑑定溢價", "Grading premium") : tx(prefs.locale, "未有對比", "No comparison")}</p>
          </div>
        </div>
      ) : null}

      <nav className="mt-5 flex border-b border-line" aria-label={tx(prefs.locale, "卡牌內容", "Card sections")}>
        {(
          [
            ["price", tx(prefs.locale, "價格", "Price")],
            ["data", tx(prefs.locale, "資料", "Details")],
            ["story", tx(prefs.locale, "背景故事", "Story")],
            ["sales", tx(prefs.locale, "放售", "For sale")],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={tabHref(card.id, key, range)} className={tabClass(tab === key)} aria-current={tab === key ? "page" : undefined}>
            {label}
            {key === "sales" && listings.length ? ` (${listings.length})` : ""}
          </Link>
        ))}
      </nav>

      {tab === "price" ? (
        <PriceTab locale={prefs.locale} market={market} range={range} cardId={card.id} grade={grade} stats={stats} shown={shown} />
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
        flavor ? (
          <p className="surface mt-4 whitespace-pre-wrap p-4 leading-relaxed">{flavor}</p>
        ) : (
          <p className="empty">{tx(prefs.locale, "暫未有背景故事。", "No flavor text yet.")}</p>
        )
      ) : null}
      {tab === "sales" ? (
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

function PriceTab({
  locale,
  market,
  range,
  cardId,
  grade,
  stats,
  shown,
}: {
  locale: Locale;
  market: SnkrMarket;
  range: TrendRange;
  cardId: string;
  grade: string | null;
  stats: ReturnType<typeof marketStats>;
  shown: { t: number; price: number }[];
}) {
  if (market.status !== "ok") {
    return (
      <p className="empty">
        {market.status === "unavailable"
          ? tx(locale, "暫時無法讀取市場數據，請稍後再試。", "Market data is unavailable right now. Try again shortly.")
          : tx(locale, "暫未有市場數據", "No market data yet")}
      </p>
    );
  }
  const change = stats?.changePct ?? null;
  return (
    <section className="mt-4" aria-labelledby="dex-trend">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dex-trend" className="text-lg font-bold">
          {tx(locale, "價格走勢", "Price trend")}
        </h2>
        <div className="flex gap-1" aria-label={tx(locale, "時段", "Range")}>
          {RANGES.map((key) => (
            <Link key={key} href={rangeHref(cardId, key)} className={rangeClass(range === key)} aria-current={range === key ? "page" : undefined}>
              {key === "all" ? "ALL" : key.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">
        {grade || tx(locale, "成交", "Sales")} · {range === "all" ? "ALL" : range.toUpperCase()}
      </p>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Stat label={tx(locale, "最高", "High")} value={stats ? formatJpy(stats.high) : "—"} />
        <Stat label={tx(locale, "最低", "Low")} value={stats ? formatJpy(stats.low) : "—"} />
        <Stat label={tx(locale, "差幅", "Spread")} value={stats ? formatJpy(stats.spread) : "—"} />
        <Stat label={tx(locale, "變動", "Change")} value={change != null ? formatPct(change) : "—"} tone={change == null ? undefined : change >= 0 ? "ok" : "danger"} />
      </dl>
      {shown.length >= 2 ? (
        <PriceChart points={shown} label={tx(locale, "價格走勢", "Price trend")} />
      ) : (
        <p className="mt-6 text-center text-sm text-muted">{tx(locale, "呢段時間未有成交。", "No sales in this range.")}</p>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`price truncate text-xs sm:text-sm ${tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}

function dexBack(game: ReturnType<typeof parseGame>, region: string, setId: string) {
  const resolved = game ?? "POKEMON";
  const params = new URLSearchParams();
  params.set("game", gameParam(resolved));
  if (resolved !== "RIFTBOUND" && (region === "JP" || region === "WEST")) params.set("region", region);
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

function rangeHref(id: string, range: TrendRange) {
  if (range === "all") return `/dex/${id}`;
  return `/dex/${id}?range=${range}`;
}

function tabClass(on: boolean) {
  return on
    ? "flex min-h-11 flex-1 items-center justify-center border-b-2 border-ink text-sm font-semibold"
    : "flex min-h-11 flex-1 items-center justify-center text-sm font-medium text-muted";
}

function rangeClass(on: boolean) {
  return on ? "rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-card" : "rounded-full px-2.5 py-1 text-xs font-semibold text-muted";
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14.5 6.5 8.5 12l6 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Heart({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 19.4s-6.6-4.1-6.6-8.2A3.4 3.4 0 0 1 12 8.6a3.4 3.4 0 0 1 6.6 2.6c0 4.1-6.6 8.2-6.6 8.2z" strokeLinejoin="round" />
    </svg>
  );
}
