import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { catalogImageSrc } from "@/lib/catalog-image";
import { demoTrades, usesSampleMarket } from "@/lib/demo-dex";
import { salesForCard } from "@/lib/dex-query";
import { catalogFlavor } from "@/lib/flavor";
import { formatHkd, formatJpy } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { conditionLabel } from "@/lib/rules";
import { displayPhoto } from "@/lib/demo-covers";
import { Countdown } from "./countdown";
import { hiddenUserIds } from "@/lib/social";
import {
  formatPct,
  gradeLabel,
  loadSnkrMarket,
  localizeSnkrDate,
  marketStats,
  slicePoints,
  type SnkrCardRef,
  type SnkrMarket,
  type TrendRange,
} from "@/lib/snkrdunk";
import { PriceChart } from "./price-chart";

const RANGES: TrendRange[] = ["1w", "1m", "3m", "all"];

function ask(listing: { saleType: string; auctionSettled: boolean; auctionEndsAt: Date | null; currentBid: number | null; startPrice: number | null; price: number | null }) {
  const auction = listing.saleType !== "BUY_NOW" && !listing.auctionSettled;
  if (auction) return listing.currentBid ?? listing.startPrice ?? 0;
  return listing.price ?? listing.currentBid ?? 0;
}

const GAME_MARKET_ZH = "呢個遊戲暫時未有行情。價格、走勢同最近成交稍後先會有。";
const GAME_MARKET_EN = "Market data isn't available for this game yet.";

/** Non-Pokémon games never call SNKRDUNK. The copy is intentional, not a failed load. */
export function GameMarketNotice({ locale }: { locale: Locale }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{tx(locale, "市場價", "Market")}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{tx(locale, GAME_MARKET_ZH, GAME_MARKET_EN)}</p>
    </div>
  );
}

export function GameMarketPanel({ locale }: { locale: Locale }) {
  return <p className="empty">{tx(locale, GAME_MARKET_ZH, GAME_MARKET_EN)}</p>;
}

export function MarketSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden>
      <div className="h-3 w-16 rounded bg-soft" />
      <div className="h-8 w-28 rounded bg-soft" />
      <div className="h-3 w-24 rounded bg-soft" />
    </div>
  );
}

export function MarketAside({ locale, market, sample }: { locale: Locale; market: SnkrMarket; sample: boolean }) {
  const grade = market.grade ? gradeLabel(market.grade === "PSA10" ? "PSA10" : "A", locale) : null;
  const allChange = marketStats(market.points)?.changePct ?? null;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{tx(locale, "市場價", "Market")}</span>
        {grade ? <span className="rounded-md bg-ink px-1.5 py-0.5 font-semibold text-card">{grade}</span> : null}
      </div>
      {market.status === "ok" && market.price != null ? (
        <>
          <p className="price mt-1 text-2xl leading-none">
            {formatJpy(market.price)} <span className="text-sm font-semibold text-muted">JPY</span>
          </p>
          {allChange != null ? (
            <p className={`mt-1 text-sm font-semibold ${allChange >= 0 ? "text-ok" : "text-danger"}`}>
              {formatPct(allChange)} ALL
            </p>
          ) : null}
          {market.saleCount > 0 && market.saleCount < 3 ? (
            <p className="mt-1 text-xs text-muted">{tx(locale, `信心度低：只有 ${market.saleCount} 宗成交`, `Low confidence: ${market.saleCount} sales`)}</p>
          ) : null}
          {market.recent.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted">{tx(locale, "最近成交", "Recent sales")}</p>
              <ul className="mt-1 grid gap-1">
                {market.recent.map((sale, index) => (
                  <li key={`${sale.date}-${sale.price}-${index}`} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-muted">
                      {localizeSnkrDate(sale.date, locale)}
                      <span className="ml-1 text-[11px]">JP</span>
                    </span>
                    <span className="price shrink-0">{formatJpy(sale.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-muted">{sample ? tx(locale, "示範行情，唔係真實成交", "Sample prices, not live sales") : "SNKRDUNK · JPY"}</p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {market.status === "unavailable"
            ? tx(locale, "暫時無法讀取市場數據，請稍後再試。", "Market data is unavailable right now. Try again shortly.")
            : tx(locale, "暫未有市場數據", "No market data yet")}
        </p>
      )}
    </div>
  );
}

export function PricePanel({
  locale,
  market,
  range,
  cardId,
  sample,
}: {
  locale: Locale;
  market: SnkrMarket;
  range: TrendRange;
  cardId: string;
  sample: boolean;
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
  const shown = slicePoints(market.points, range, Date.now());
  const stats = marketStats(shown);
  const change = stats?.changePct ?? null;
  const grade = market.grade ? gradeLabel(market.grade === "PSA10" ? "PSA10" : "A", locale) : null;
  return (
    <>
      <section className="mt-4" aria-labelledby="dex-trend">
        <div className="flex items-center justify-between gap-2">
          <h2 id="dex-trend" className="text-base font-semibold">
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
          {sample ? ` · ${tx(locale, "示範", "Sample")}` : ""}
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
    </>
  );
}

export function MarketFacts({ locale, market }: { locale: Locale; market: SnkrMarket }) {
  if (market.status !== "ok") return null;
  const grade = market.grade ? gradeLabel(market.grade === "PSA10" ? "PSA10" : "A", locale) : null;
  const low = market.rangeLow ?? marketStats(market.points)?.low ?? null;
  const high = market.rangeHigh ?? marketStats(market.points)?.high ?? null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="surface p-3">
        <p className="text-xs text-muted">{grade ? `ALL 成交 · ${grade}` : tx(locale, "ALL 成交", "All sales")}</p>
        <p className="price mt-1 text-lg leading-tight">{low != null && high != null ? `${formatJpy(low)}–${formatJpy(high)}` : "—"}</p>
        <p className="mt-1 text-xs text-muted">
          {market.saleCountCapped
            ? tx(locale, `${market.saleCount}+ 宗成交`, `${market.saleCount}+ sales`)
            : tx(locale, `${market.saleCount} 宗成交`, `${market.saleCount} sales`)}
        </p>
      </div>
      <div className={`p-3 ${market.premium != null ? "surface ring-2 ring-accent" : "surface"}`}>
        <p className="text-xs text-muted">{tx(locale, "PSA 10 對比 A 級", "PSA 10 vs grade A")}</p>
        <p className={`price mt-1 text-xl leading-none ${market.premium != null ? "text-ok" : "text-muted"}`}>
          {market.premium != null ? `${market.premium.toFixed(1)}×` : "—"}
        </p>
        <p className="mt-1 text-xs text-muted">{market.premium != null ? tx(locale, "鑑定溢價", "Grading premium") : tx(locale, "未有對比", "No comparison")}</p>
      </div>
    </div>
  );
}

export async function LiveMarketAside({ card, locale }: { card: SnkrCardRef; locale: Locale }) {
  const market = await loadSnkrMarket(card);
  return <MarketAside locale={locale} market={market} sample={false} />;
}

export async function LiveMarketFacts({ card, locale }: { card: SnkrCardRef; locale: Locale }) {
  const market = await loadSnkrMarket(card);
  return <MarketFacts locale={locale} market={market} />;
}

export async function LivePricePanel({ card, locale, range, cardId }: { card: SnkrCardRef; locale: Locale; range: TrendRange; cardId: string }) {
  const market = await loadSnkrMarket(card);
  return <PricePanel locale={locale} market={market} range={range} cardId={cardId} sample={false} />;
}

export async function DexStory({ externalId, game, locale }: { externalId: string; game: string; locale: Locale }) {
  const flavor = usesSampleMarket(game) ? null : await catalogFlavor(externalId, game);
  return flavor ? (
    <p className="surface mt-4 whitespace-pre-wrap p-4 leading-relaxed">{flavor}</p>
  ) : (
    <p className="empty">{tx(locale, "暫未有背景故事。", "No flavor text yet.")}</p>
  );
}

export async function DexSales({
  cardId,
  game,
  locale,
  nameEn,
  imageUrl,
}: {
  cardId: string;
  game: string;
  locale: Locale;
  nameEn: string;
  imageUrl: string;
}) {
  const viewer = await getViewer();
  const hidden = await hiddenUserIds(viewer?.id ?? null);
  const listings = await salesForCard(cardId, hidden);
  const samples = usesSampleMarket(game) && listings.length === 0 ? demoTrades(cardId) : [];
  const sellHref = `/sell?catalogCardId=${encodeURIComponent(cardId)}`;
  const few = listings.length <= 2;
  return (
    <section className="mt-4" aria-labelledby="dex-sales">
      <h2 id="dex-sales" className="sr-only">
        {tx(locale, "放售", "For sale")}
      </h2>
      {listings.length === 0 && samples.length === 0 ? <p className="empty">{tx(locale, "暫時未有放售。", "Nothing for sale yet.")}</p> : null}
      <ul className="grid gap-3">
        {listings.map((listing) => (
          <li key={listing.id}>
            <div className="surface flex min-h-[5.5rem] items-center gap-3 p-3">
              <Link href={`/listing/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <img src={displayPhoto(listing.photos[0]?.url)} alt="" loading="lazy" decoding="async" className="h-20 w-16 shrink-0 rounded-xl bg-soft object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block font-semibold">{listing.title}</span>
                  <span className="text-sm text-muted">
                    {conditionLabel(listing)} · {listing.seller.nickname}
                  </span>
                  {listing.saleType !== "BUY_NOW" && !listing.auctionSettled && listing.auctionEndsAt ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-muted"><Countdown endsAt={listing.auctionEndsAt.toISOString()} locale={locale} /></span>
                  ) : null}
                </span>
              </Link>
              <span className="price shrink-0 text-right text-lg">
                <Link href={`/listing/${listing.id}`}>{formatHkd(ask(listing), locale)}</Link>
                {listing.saleType !== "BUY_NOW" && !listing.auctionSettled ? (
                  <Link href="/auction" className="mt-1 block text-[11px] font-semibold">{tx(locale, "拍賣", "Auction")}</Link>
                ) : null}
              </span>
            </div>
          </li>
        ))}
        {samples.map((trade) => (
          <li key={`${trade.seller}-${trade.grade}`}>
            <div className="surface flex min-h-[5.5rem] items-center gap-3 p-3">
              <img src={catalogImageSrc(imageUrl)} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-soft object-contain" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block font-semibold">{nameEn}</span>
                <span className="text-sm text-muted">
                  {trade.grade} · {trade.seller} · {tx(locale, "示範放售", "Sample listing")}
                </span>
              </span>
              <span className="price shrink-0 text-lg">{formatHkd(trade.hkd * 100, locale)}</span>
            </div>
          </li>
        ))}
      </ul>
      {few ? (
        <Link href={sellHref} className="btn btn-primary mt-4 w-full">
          {tx(locale, "我要放售呢張", "List this card")}
        </Link>
      ) : (
        <Link href={sellHref} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link">
          {tx(locale, "我要放售呢張", "List this card")}
        </Link>
      )}
      <Link href={`/search?q=${encodeURIComponent(nameEn)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-link">
        {tx(locale, "睇全部放售", "See all for sale")}
      </Link>
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

function rangeHref(id: string, range: TrendRange) {
  if (range === "all") return `/dex/${id}`;
  return `/dex/${id}?range=${range}`;
}

function rangeClass(on: boolean) {
  return on ? "rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-card" : "rounded-full px-2.5 py-1 text-xs font-semibold text-muted";
}
