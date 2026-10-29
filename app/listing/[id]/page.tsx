import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT, anonBidder, toHkDate } from "@/lib/format";
import { activityLine } from "@/lib/time";
import { activeWhere, cardInclude } from "@/lib/feed";
import { RESERVE_BADGE } from "@/lib/deal-phase";
import { tx, listingStatusLabel, offerStatusLabel } from "@/lib/i18n";
import { followedSellerIds, hiddenUserIds } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { loadComps } from "@/lib/comps";
import { conditionLabel, minimumNextBid } from "@/lib/rules";
import { hasStoreAddress, offeredMethods, onTimePercent, shipMethodLabel } from "@/lib/shipping";
import { Flash } from "@/components/shell";
import { Gallery } from "@/components/gallery";
import { Icon } from "@/components/icons";
import { RichText } from "@/components/rich-text";
import { ListingCard } from "@/components/listing-card";
import { PurchasePanel } from "@/components/purchase-panel";
import { Sparkline } from "@/components/sparkline";
import { ViewPing } from "@/components/pings";
import { offerRespondAction, deleteDraftAction, relistAction, unlistAction } from "@/actions/trade";
import { toggleFavorite, toggleFollow } from "@/actions/social";
import { PersonMenu } from "@/components/safety-menu";
import { RatingPill } from "@/components/profile-header";
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
    description: listing.description.slice(0, 160),
    openGraph: listing.photos[0] ? { images: [listing.photos[0].url] } : undefined,
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
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
        bidEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    }),
  ]);
  if (!listing) notFound();
  const owner = viewer?.id === listing.sellerId;
  const visible = ["ACTIVE", "ENDED", "SOLD"].includes(listing.status) || owner || viewer?.role === "ADMIN";
  if (!visible) notFound();
  const hidden = viewer ? await hiddenUserIds(viewer.id) : [];
  if (viewer && !owner && hidden.includes(listing.sellerId)) notFound();

  const hasAuction = listing.saleType !== "BUY_NOW" && !listing.bidsVoided && listing.auctionEndsAt != null;
  const live = Boolean(hasAuction && !listing.auctionSettled && listing.auctionEndsAt && listing.auctionEndsAt > new Date());
  const [mine, bidCount, offers, similar, sales, comps, favored, following, follows] = await Promise.all([
    viewer ? prisma.proxyBid.findUnique({ where: { listingId_bidderId: { listingId: id, bidderId: viewer.id } } }) : null,
    prisma.proxyBid.count({ where: { listingId: id } }),
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
      include: cardInclude,
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
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: listing.sellerId } } }) : null,
    followedSellerIds(viewer?.id ?? null),
  ]);
  const minBid = minimumNextBid(listing.startPrice ?? 0, listing.currentBid, bidCount > 0);
  const locale = prefs.locale;
  const listed = activityLine(listing.createdAt, listing.updatedAt, new Date(), locale);
  const [sellerRatingRow, sellerShipped, sellerSales] = await Promise.all([
    prisma.dealRating.aggregate({ where: { subjectId: listing.sellerId }, _avg: { stars: true }, _count: true }),
    prisma.order.findMany({ where: { sellerId: listing.sellerId, shippedAt: { not: null } }, select: { shippedAt: true, shipBy: true } }),
    prisma.order.count({ where: { sellerId: listing.sellerId, status: "COMPLETED" } }),
  ]);
  const sellerOnTime = onTimePercent(sellerShipped);
  const sellerRating = ratingFromAggregate(sellerRatingRow._avg.stars, sellerRatingRow._count);
  const methods = offeredMethods(listing, hasStoreAddress(listing.seller));
  const showHandover = !owner && listing.status === "ACTIVE" && listing.quantityAvailable > 0;
  const showBid = Boolean(live && viewer && !owner && !viewer.bidBanned);

  return (
    <div className={`grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 ${!owner && (live || showHandover) ? "max-md:pb-36" : ""}`}>
      <ViewPing id={id} />
      <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
        <Flash locale={locale} ok={sp.ok} err={sp.err} />
        <Gallery photos={listing.photos.map((photo) => ({ url: photo.url, role: photo.role }))} alt={listing.title} locale={locale} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{conditionLabel(listing)}</span>
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{listingStatusLabel(locale, listing.status)}</span>
          {listing.binLockOrderId ? <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{tx(locale, RESERVE_BADGE, "Reserved")}</span> : null}
          {listing.certNumber ? <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">#{listing.certNumber}</span> : null}
        </div>
        <h1 className="mt-2 text-[1.3rem] font-bold leading-tight">{listing.title}</h1>
        {listing.items.length ? (
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {listing.items.map((item) => (
              <li key={item.id}>
                {item.catalogTitle || item.cardName || tx(locale, "未填卡名", "No card name")}
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
          <RichText text={listing.description} />
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
            <h2 className="font-semibold">{tx(locale, "出價紀錄", "Bid history")}</h2>
            <p className="text-sm text-muted">{tx(locale, "最高出價只有出價者自己可見。最後 2 分鐘出價會延長 2 分鐘。", "Maximum bids stay private. A bid in the final 2 minutes extends the auction by 2 minutes.")}</p>
            {listing.bidEvents.length === 0 ? <p className="text-sm">{tx(locale, "未有出價。", "No bids yet.")}</p> : null}
            <ul className="mt-2 text-sm">
              {listing.bidEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 border-b border-black/5 py-2 last:border-0">
                  <span>
                    <span className="font-medium">{anonBidder(event.bidderId, locale)}</span>
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
                {offer.status === "PENDING" && owner ? (
                  <form action={offerRespondAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="listingId" value={id} />
                    <button className="btn btn-primary" name="act" value="accept">{tx(locale, "接受", "Accept")}</button>
                    <button className="btn-ghost btn" name="act" value="decline">{tx(locale, "拒絕", "Decline")}</button>
                    <input className="field w-full sm:max-w-40" name="counter" placeholder="HKD" />
                    <button className="btn-ghost btn" name="act" value="counter">{tx(locale, "還價", "Counter")}</button>
                  </form>
                ) : null}
                {offer.status === "COUNTERED" && viewer?.id === offer.buyerId ? (
                  <form action={offerRespondAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="listingId" value={id} />
                    <button className="btn btn-primary" name="act" value="accept">{tx(locale, "接受還價", "Accept counter")}</button>
                    <button className="btn-ghost btn" name="act" value="decline">{tx(locale, "拒絕", "Decline")}</button>
                  </form>
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
          yourMax={mine?.maxAmount ?? null}
          isLeader={Boolean(mine && viewer?.id === listing.leaderId)}
          live={live}
          endsAt={hasAuction && listing.auctionEndsAt ? listing.auctionEndsAt.toISOString() : null}
          endsText={hasAuction && listing.auctionEndsAt ? formatHKT(listing.auctionEndsAt, locale) : null}
          showBid={showBid}
          bidBanned={Boolean(viewer?.bidBanned)}
          showHandover={showHandover}
          loggedIn={Boolean(viewer)}
          bidsVoided={listing.bidsVoided}
          ownerNote={null}
          timeLabel={listed.text}
          timeAt={listed.at.toISOString()}
        />
        <form action={toggleFavorite} className="text-sm">
          <input type="hidden" name="listingId" value={id} />
          <input type="hidden" name="next" value={`/listing/${id}`} />
          <button className="btn btn-ghost w-full gap-1.5" aria-pressed={Boolean(favored)}>
            <Icon name="bookmark" className="h-5 w-5" strokeWidth={2.25} filled={Boolean(favored)} />
            {tx(locale, "收藏", "Favorite")}
          </button>
        </form>
        <div className="text-sm">
          <div className="flex items-start justify-between gap-2">
          <Link href={`/shop/${listing.sellerId}`} className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-bold text-white">
              {listing.seller.nickname.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate font-medium">{listing.seller.nickname}</span>
                {sellerRating ? <RatingPill locale={locale} average={sellerRating.average} count={sellerRating.count} /> : null}
              </span>
              <span className="text-xs text-muted">
                {tx(locale, "賣家", "Seller")}
                {` · ${tx(locale, "完成", "Sold")} ${sellerSales}`}
                {sellerOnTime != null ? ` · ${tx(locale, "準時寄出", "On time")} ${sellerOnTime}%` : ""}
              </span>
            </span>
          </Link>
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
          {!owner && viewer ? (
            <form action={toggleFollow} className="mt-3">
              <input type="hidden" name="sellerId" value={listing.sellerId} />
              <button className="btn btn-ghost">{following ? tx(locale, "取消關注", "Unfollow") : tx(locale, "關注賣家", "Follow seller")}</button>
            </form>
          ) : null}
        </div>
        {owner ? (
          <div className="flex flex-wrap gap-2">
            <Link className="btn-ghost btn" href={`/sell/${id}`}>{tx(locale, "編輯", "Edit")}</Link>
            <form action={unlistAction}><input type="hidden" name="listingId" value={id} /><button className="btn-ghost btn">{tx(locale, "下架", "Unlist")}</button></form>
            {listing.status === "UNLISTED" ? <form action={relistAction}><input type="hidden" name="listingId" value={id} /><button className="btn-ghost btn">{tx(locale, "重新上架", "Relist")}</button></form> : null}
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
