import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT, anonBidder, toHkDate } from "@/lib/format";
import { activityLine } from "@/lib/time";
import { activeWhere, publicCardSelect } from "@/lib/feed";
import { dealPhase, directBuyBlocked, offersClosed, readDealMeta } from "@/lib/deal-phase";
import { shopPill, shopPillLabel } from "@/lib/shop-inventory";
import { tx, listingStatusLabel, offerStatusLabel } from "@/lib/i18n";
import { followedSellerIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { loadComps } from "@/lib/comps";
import { publicMinimumBid, shownReserveCents } from "@/lib/auction";
import { buyerDescription, displayPhoto } from "@/lib/demo-covers";
import { cardDisplayName } from "@/lib/posts";
import { conditionLabel } from "@/lib/rules";
import { hasStoreAddress, offeredMethods, onTimePercent, shipMethodLabel } from "@/lib/shipping";
import { Flash } from "@/components/shell";
import { Gallery } from "@/components/gallery";
import { Icon } from "@/components/icons";
import { RichText } from "@/components/rich-text";
import { ListingCard } from "@/components/listing-card";
import { PurchasePanel } from "@/components/purchase-panel";
import { Sparkline } from "@/components/sparkline";
import { ViewPing } from "@/components/pings";
import { deleteDraftAction, relistAction, relistFixedAction, unlistAction } from "@/actions/trade";
import { toggleFavorite } from "@/actions/social";
import { PersonMenu } from "@/components/safety-menu";
import { NameLine } from "@/components/profile-header";
import { ratingFromAggregate } from "@/lib/ratings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!listing) return { title: "TSM" };
  return {
    title: listing.title,
    description: buyerDescription(listing.description).slice(0, 160),
    openGraph: listing.photos[0] ? { images: [displayPhoto(listing.photos[0].url)] } : undefined,
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; min?: string }>;
}) {
  await sweep();
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, listing] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        items: { orderBy: { position: "asc" } },
        seller: true,
        category: { include: { parent: true } },
        bidEvents: { orderBy: { createdAt: "desc" }, take: 20, include: { bidder: { select: { nickname: true, verificationTier: true } } } },
      },
    }),
  ]);
  if (!listing) notFound();
  const owner = viewer?.id === listing.sellerId;
  const reserveCents = shownReserveCents(listing.reservePrice, viewer?.id, listing.sellerId);
  const visible = ["ACTIVE", "ENDED", "SOLD"].includes(listing.status) || owner || viewer?.role === "ADMIN";
  if (!visible) notFound();
  const hidden = viewer ? await hiddenUserIds(viewer.id) : [];
  if (viewer && !owner && hidden.includes(listing.sellerId)) notFound();

  const hasAuction = listing.saleType !== "BUY_NOW" && !listing.bidsVoided && listing.auctionEndsAt != null;
  const live = Boolean(hasAuction && !listing.auctionSettled && listing.auctionEndsAt && listing.auctionEndsAt > new Date());
  const hasBids = listing.currentBid != null && listing.leaderId != null;
  const [offers, similar, sales, comps, favored, follows, buyerOrders] = await Promise.all([
    viewer
      ? prisma.offer.findMany({
          where: {
            listingId: id,
            ...(owner ? (hidden.length ? { buyerId: { notIn: hidden } } : {}) : { buyerId: viewer.id }),
            status: { in: ["PENDING", "COUNTERED", "ACCEPTED"] },
          },
          include: { buyer: { select: { nickname: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.listing.findMany({
      where: { ...activeWhere(hidden), categoryId: listing.categoryId, id: { not: id }, sellerId: { not: listing.sellerId } },
      select: publicCardSelect,
      take: 4,
    }),
    prisma.orderItem.findMany({
      where: { listingId: id, order: { status: "COMPLETED" } },
      include: { order: true },
      orderBy: { order: { completedAt: "desc" } },
      take: 5,
    }),
    loadComps(listing),
    viewer ? prisma.favorite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: id } } }) : null,
    followedSellerIds(viewer?.id ?? null),
    viewer
      ? prisma.order.findMany({
          where: { buyerId: viewer.id, items: { some: { listingId: id } } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { status: true, fulfillment: true },
        })
      : Promise.resolve([]),
  ]);
  const minBid = publicMinimumBid(listing.startPrice ?? 0, listing.currentBid, hasBids);
  const locale = prefs.locale;
  const listed = activityLine(listing.createdAt, listing.updatedAt, new Date(), locale);
  const [sellerRatingRow, sellerShipped, sellerSales] = await Promise.all([
    prisma.dealRating.aggregate({ where: { subjectId: listing.sellerId }, _avg: { stars: true }, _count: true }),
    prisma.order.findMany({ where: { sellerId: listing.sellerId, shippedAt: { not: null } }, select: { shippedAt: true, shipBy: true } }),
    prisma.order.count({ where: { sellerId: listing.sellerId, status: "COMPLETED" } }),
  ]);
  const sellerOnTime = onTimePercent(sellerShipped);
  const sellerRating = ratingFromAggregate(sellerRatingRow._avg.stars, sellerRatingRow._count);
  const offerThreads = offers.length
    ? await prisma.messageThread.findMany({
        where: { listingId: id, sellerId: listing.sellerId, buyerId: { in: offers.map((offer) => offer.buyerId) } },
        select: { id: true, buyerId: true },
      })
    : [];
  const threadByBuyer = new Map(offerThreads.map((thread) => [thread.buyerId, thread.id]));
  const methods = offeredMethods(listing, hasStoreAddress(listing.seller));
  const offerClosed = offersClosed(listing.status, listing.binLockOrderId);
  const fixed = listing.saleType === "BUY_NOW";
  const showHandover = !owner && fixed && ((listing.status === "ACTIVE" && listing.quantityAvailable > 0) || offerClosed);
  const buyClosed = buyerOrders.some((order) => {
    const offer = readDealMeta(order.fulfillment).offer?.status;
    return directBuyBlocked(dealPhase(order), offer === "PENDING" || offer === "ACCEPTED" ? offer : null);
  });
  const minRaw = Number(sp.min);
  const minCents = Number.isSafeInteger(minRaw) && minRaw > 0 ? minRaw : null;
  const showBin = Boolean(!owner && !fixed && listing.price != null && live && !listing.binLockOrderId);
  const reserved = shopPill(listing) === "RESERVED";
  const showBid = Boolean(live && viewer && !owner && !viewer.bidBanned);

  return (
    <div className={`grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 ${!owner && (live || showHandover) ? "max-md:pb-36" : ""}`}>
      <ViewPing id={id} />
      <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
        <Flash locale={locale} ok={sp.ok} err={sp.err} minCents={minCents} />
        <Gallery photos={listing.photos.map((photo) => ({ url: displayPhoto(photo.url), role: photo.role }))} alt={listing.title} locale={locale} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{conditionLabel(listing)}</span>
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{listing.auctionPassed ? tx(locale, "流標", "Passed") : reserved ? shopPillLabel(locale, "RESERVED") : listingStatusLabel(locale, listing.status)}</span>
          {listing.certNumber ? <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">#{listing.certNumber}</span> : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-[1.3rem] font-bold leading-tight">{listing.title}</h1>
          <form action={toggleFavorite} className="shrink-0">
            <input type="hidden" name="listingId" value={id} />
            <input type="hidden" name="next" value={`/listing/${id}`} />
            <button
              type="submit"
              className={`grid h-10 w-10 place-items-center ${favored ? "text-accent" : "text-ink"}`}
              aria-label={tx(locale, "收藏", "Favorite")}
              title={tx(locale, "收藏", "Favorite")}
              aria-pressed={Boolean(favored)}
            >
              <Icon name="bookmark" className="h-5 w-5" strokeWidth={2.25} filled={Boolean(favored)} />
            </button>
          </form>
        </div>
        {listing.items.length ? (
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {listing.items.map((item) => (
              <li key={item.id}>
                {cardDisplayName({ catalogTitle: item.catalogTitle, cardName: item.cardName, title: listing.title }) || tx(locale, "未填卡名", "No card name")}
                {listing.items.length > 1 && item.price != null ? ` · ${formatHkd(item.price, locale)}` : ""}
                {` · ${conditionLabel(item)}`}
              </li>
            ))}
          </ul>
        ) : listing.cardName ? (
          <p className="mt-1 text-sm text-muted">{listing.cardName}</p>
        ) : null}
        <p className="mt-1 text-sm text-muted">
          {locale === "en" ? listing.category.nameEn : listing.category.nameZh}
          {listing.language ? ` · ${listing.language}` : ""} · {tx(locale, "瀏覽", "Views")} {listing.viewCount} · {tx(locale, "收藏", "Favorites")} {listing.favoriteCount}
        </p>
      </div>
      <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
        <div>
          <RichText text={buyerDescription(listing.description)} />
        </div>
        <dl className="surface mt-4 grid grid-cols-2 gap-x-3 gap-y-3 p-4 text-sm">
          {listing.game ? <div><dt className="text-muted">{tx(locale, "遊戲", "Game")}</dt><dd>{listing.game}</dd></div> : null}
          {listing.setName ? <div><dt className="text-muted">{tx(locale, "系列", "Set")}</dt><dd>{listing.setName}</dd></div> : null}
          {listing.cardName ? <div><dt className="text-muted">{tx(locale, "卡名", "Card")}</dt><dd>{listing.cardName}</dd></div> : null}
          {listing.personName ? <div><dt className="text-muted">{tx(locale, "人物", "Person")}</dt><dd>{listing.personName}</dd></div> : null}
          {listing.seasonYear ? <div><dt className="text-muted">{tx(locale, "賽季／年份", "Season")}</dt><dd>{listing.seasonYear}</dd></div> : null}
          {listing.brandSeries ? <div><dt className="text-muted">{tx(locale, "品牌", "Brand")}</dt><dd>{listing.brandSeries}</dd></div> : null}
          {listing.cardNumber ? <div><dt className="text-muted">{tx(locale, "卡號", "Number")}</dt><dd>{listing.cardNumber}</dd></div> : null}
          {listing.rarity ? <div><dt className="text-muted">{tx(locale, "稀有度", "Rarity")}</dt><dd>{listing.rarity}</dd></div> : null}
          {methods.length === 0 ? (
            <div>
              <dt className="text-muted">{tx(locale, "交收", "Handover")}</dt>
              <dd>{tx(locale, "賣家未填交收方式", "No handover method yet")}</dd>
            </div>
          ) : methods.map((method) => (
            <div key={method}>
              <dt className="text-muted">{shipMethodLabel(method, locale)}</dt>
              <dd>
                {method === "SF_COD" ? tx(locale, "到付，買家付順豐", "Buyer pays SF on delivery") : null}
                {method === "MEET" ? [listing.meetupDistrict, listing.meetupWindow, listing.meetupNotes].filter(Boolean).join(" · ") : null}
                {method === "PICKUP" ? [listing.seller.storeName, listing.seller.storeDistrict, listing.seller.storeLine1, listing.seller.storeHours].filter(Boolean).join(" ") : null}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-muted">{tx(locale, "貨況", "Stock")}</dt>
            <dd>
              {listing.stockType === "PREORDER"
                ? tx(locale, `預訂${listing.preorderShipDate ? ` · ${toHkDate(listing.preorderShipDate)} 出貨` : ""}`, `Preorder${listing.preorderShipDate ? ` · ships ${toHkDate(listing.preorderShipDate)}` : ""}`)
                : tx(locale, `現貨 · ${listing.shipWithinDays || listing.shippingDays} 日內出貨`, `In stock · ships within ${listing.shipWithinDays || listing.shippingDays} days`)}
            </dd>
          </div>
          <div><dt className="text-muted">{tx(locale, "存貨", "Quantity")}</dt><dd>{listing.quantityAvailable}</dd></div>
        </dl>
        {listing.videoUrl ? (
          <video className="mt-4 w-full rounded-xl" controls preload="metadata" src={listing.videoUrl} />
        ) : null}
        {sales.length ? (
          <section className="mt-6">
            <h2 className="font-semibold">{tx(locale, "成交紀錄", "Sold")}</h2>
            <ul className="mt-2 text-sm">
              {sales.map((item) => (
                <li key={item.id}>{formatHkd(item.unitPrice, locale)} · {item.order.completedAt ? formatHKT(item.order.completedAt, locale, false) : ""}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {comps.matched.length || comps.others.length ? (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-semibold">{tx(locale, "行情成交", "Sold comps")}</h2>
              <Sparkline values={[...comps.matched].reverse().map((item) => item.unitPrice)} />
            </div>
            <p className="text-sm text-muted">
              {comps.matched.length
                ? tx(locale, "同一品相的站內成交", "Sold on TSM at the same grade")
                : tx(locale, "同卡其他品相", "Same card, other grades")}
            </p>
            <ul className="mt-2 grid gap-2 text-sm">
              {(comps.matched.length ? comps.matched : comps.others).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2">
                  <span>
                    <span className="block font-medium">{conditionLabel(item)}</span>
                    <span className="text-xs text-muted">{item.completedAt ? formatHKT(item.completedAt, locale, false) : ""}</span>
                  </span>
                  <span className="price">{formatHkd(item.unitPrice, locale)}</span>
                </li>
              ))}
            </ul>
            {comps.matched.length && comps.others.length ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted">{tx(locale, "其他品相", "Other grades")}</summary>
                <ul className="mt-2 grid gap-2">
                  {comps.others.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <span>{conditionLabel(item)} · {item.completedAt ? formatHKT(item.completedAt, locale, false) : ""}</span>
                      <span>{formatHkd(item.unitPrice, locale)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}
        {hasAuction ? (
          <section className="mt-6">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="font-semibold">{tx(locale, "出價紀錄", "Bid history")}</h2>
              <p className="text-sm text-muted">{tx(locale, "出價是公開金額。加價取 HK$10 或目前出價的 5%（較高者）。", "Bids are public. The raise is HK$10 or 5% of the current bid, whichever is higher.")}</p>
            </div>
            {listing.bidEvents.length === 0 ? <p className="text-sm">{tx(locale, "未有出價。", "No bids yet.")}</p> : null}
            <ul className="mt-2 text-sm">
              {listing.bidEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 border-b border-black/5 py-2 last:border-0">
                  <span>
                    <NameLine
                      name={<span className="font-medium">{event.bidder.nickname.trim() || anonBidder(event.bidderId, locale)}</span>}
                      tier={event.bidder.verificationTier}
                      locale={locale}
                    />
                    {event.id === listing.bidEvents[0]?.id ? <span className="ml-2 rounded-full bg-soft px-2 py-0.5 text-xs">{tx(locale, "目前領先", "Leading")}</span> : null}
                  </span>
                  <span className="text-right">
                    <span className="block font-medium">{formatHkd(event.publicAmount, locale)}</span>
                    <span className="text-xs text-muted">{formatHKT(event.createdAt, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {offers.length ? (
          <section className="mt-6 grid gap-3">
            <h2 className="font-semibold">{tx(locale, "傾交收", "Handover")}</h2>
            {offers.map((offer) => (
              <div key={offer.id} className="surface p-4 text-sm">
                <p>
                  {owner ? offer.buyer.nickname : tx(locale, "傾交收", "Handover")} · {tx(locale, "第", "Round")} {offer.round}/3 · {offerStatusLabel(locale, offer.status)}
                </p>
                <p>{formatHkd(offer.amount, locale)}{offer.counterAmount ? ` → ${formatHkd(offer.counterAmount, locale)}` : ""}</p>
                <p className="text-muted">{tx(locale, "到期", "Expires")} {formatHKT(offer.expiresAt, locale)}</p>
                {threadByBuyer.get(offer.buyerId) ? (
                  <Link className="mt-2 inline-flex text-sm font-semibold text-link" href={`/messages/${threadByBuyer.get(offer.buyerId)}`}>{tx(locale, "打開聊天", "Open chat")}</Link>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
      <aside id="purchase" className="surface panel order-2 grid h-fit min-w-0 gap-4 p-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:p-5">
        <PurchasePanel
          locale={locale}
          id={id}
          price={listing.price}
          currentBid={listing.currentBid}
          startPrice={listing.startPrice}
          minBid={minBid}
          showBin={showBin}
          live={live}
          endsAt={hasAuction && listing.auctionEndsAt ? listing.auctionEndsAt.toISOString() : null}
          endsText={hasAuction && listing.auctionEndsAt ? formatHKT(listing.auctionEndsAt, locale) : null}
          showBid={showBid}
          bidBanned={Boolean(viewer?.bidBanned)}
          showHandover={showHandover}
          offerClosed={offerClosed}
          buyClosed={buyClosed}
          hasBids={hasBids}
          loggedIn={Boolean(viewer)}
          bidsVoided={listing.bidsVoided}
          ownerNote={
            reserveCents != null
              ? tx(locale, `底價 ${formatHkd(reserveCents, locale)}`, `Reserve ${formatHkd(reserveCents, locale)}`)
              : owner && listing.auctionPassed
                ? tx(locale, "未達底價或無人出價。可以改做固定價再賣。", "Reserve was not met, or there were no bids. Relist at a fixed price.")
                : null
          }
          timeLabel={listed.text}
          timeAt={listed.at.toISOString()}
        />
        <div className="text-sm">
          <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/u/${listing.sellerId}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
              {listing.seller.nickname.slice(0, 1)}
            </Link>
            <span className="min-w-0">
              <NameLine
                name={<Link href={`/u/${listing.sellerId}`} className="font-medium">{listing.seller.nickname}</Link>}
                nameClassName="truncate"
                tier={listing.seller.verificationTier}
                locale={locale}
                rating={sellerRating}
              />
              <Link href={`/u/${listing.sellerId}`} className="mt-0.5 block text-xs text-muted">
                {tx(locale, "賣家", "Seller")}
                {` · ${tx(locale, "完成", "Sold")} ${sellerSales}`}
                {sellerOnTime != null ? ` · ${tx(locale, "準時寄出", "On time")} ${sellerOnTime}%` : ""}
              </Link>
            </span>
          </div>
          {viewer && !owner ? (
            <PersonMenu
              locale={locale}
              userId={listing.sellerId}
              reportType="LISTING"
              reportId={id}
              next={`/listing/${id}`}
              away="/"
            />
          ) : null}
          </div>
        </div>
        {owner ? (
          <div className="flex flex-wrap gap-2">
            <Link className="btn-ghost btn" href={`/sell/${id}`}>{tx(locale, "編輯", "Edit")}</Link>
            <form action={unlistAction}><input type="hidden" name="listingId" value={id} /><button className="btn-ghost btn">{tx(locale, "下架", "Unlist")}</button></form>
            {listing.status === "UNLISTED" ? <form action={relistAction}><input type="hidden" name="listingId" value={id} /><button className="btn-ghost btn">{tx(locale, "重新上架", "Relist")}</button></form> : null}
            {listing.auctionPassed ? (
              <form action={relistFixedAction} className="flex w-full items-center gap-2">
                <input type="hidden" name="listingId" value={id} />
                <label className="grid min-w-0 flex-1 gap-1 text-sm">
                  {tx(locale, "固定價 HKD", "Fixed price HKD")}
                  <input className="field" name="price" inputMode="decimal" required placeholder="280" />
                </label>
                <button className="btn btn-primary shrink-0">{tx(locale, "改固定價", "Relist fixed")}</button>
              </form>
            ) : null}
            {listing.status === "DRAFT" ? <form action={deleteDraftAction}><input type="hidden" name="listingId" value={id} /><button className="btn-ghost btn">{tx(locale, "刪除草稿", "Delete draft")}</button></form> : null}
          </div>
        ) : null}
        {!viewer ? <p className="text-sm"><Link className="text-link" href={`/login?next=/listing/${id}`}>{tx(locale, "登入後先可以購買、出價、收藏或傳訊息。", "Log in to buy, bid, favorite, or message.")}</Link></p> : null}
      </aside>
      {similar.length ? (
        <section className="order-4 lg:col-span-2 lg:col-start-1 lg:row-start-3">
          <h2 className="mb-2 text-base font-semibold">{tx(locale, "相似貨品", "Similar items")}</h2>
          <div className="feed">
            {similar.map((item) => (
              <ListingCard key={item.id} listing={item} locale={locale} favorited={false} followed={follows.has(item.sellerId)} next={`/listing/${id}`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
