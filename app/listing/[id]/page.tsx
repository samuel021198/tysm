import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCommissionBps, getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT, anonBidder, centsToInput } from "@/lib/format";
import { activeWhere, cardInclude } from "@/lib/feed";
import { tx, listingStatusLabel } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { sweep } from "@/lib/orders";
import { bpsToPercentLabel, conditionLabel, minimumNextBid } from "@/lib/rules";
import { Flash } from "@/components/shell";
import { Gallery } from "@/components/gallery";
import { Countdown } from "@/components/countdown";
import { RichText } from "@/components/rich-text";
import { ListingCard } from "@/components/listing-card";
import { BuyDock } from "@/components/buy-dock";
import { ViewPing } from "@/components/pings";
import { Submit } from "@/components/submit";
import { bidAction, cartAdd, offerAction, offerRespondAction, deleteDraftAction, relistAction, unlistAction } from "@/actions/trade";
import { openThread, reportAction, toggleFavorite, toggleFollow } from "@/actions/social";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!listing) return { title: "TYSM" };
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
  if (viewer && !owner && (await isBlocked(viewer.id, listing.sellerId))) notFound();

  const hasAuction = listing.saleType !== "BUY_NOW" && !listing.bidsVoided && listing.auctionEndsAt != null;
  const live = Boolean(hasAuction && !listing.auctionSettled && listing.auctionEndsAt && listing.auctionEndsAt > new Date());
  const [mine, bidCount, offers, similar, sales, comps, favored, following, bps] = await Promise.all([
    viewer ? prisma.proxyBid.findUnique({ where: { listingId_bidderId: { listingId: id, bidderId: viewer.id } } }) : null,
    prisma.proxyBid.count({ where: { listingId: id } }),
    viewer
      ? prisma.offer.findMany({
          where: {
            listingId: id,
            ...(owner ? {} : { buyerId: viewer.id }),
            status: { in: ["PENDING", "COUNTERED", "ACCEPTED"] },
          },
          include: { buyer: { select: { nickname: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.listing.findMany({
      where: { ...activeWhere([]), categoryId: listing.categoryId, id: { not: id }, sellerId: { not: listing.sellerId } },
      include: cardInclude,
      take: 4,
    }),
    prisma.orderItem.findMany({
      where: { listingId: id, order: { status: "COMPLETED" } },
      include: { order: true },
      orderBy: { order: { completedAt: "desc" } },
      take: 5,
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: "COMPLETED" },
        listingId: { not: id },
        ...(listing.cardName || listing.personName
          ? {
              OR: [
                ...(listing.cardName ? [{ cardName: listing.cardName }] : []),
                ...(listing.personName ? [{ personName: listing.personName }] : []),
              ],
            }
          : { id: "__none" }),
      },
      include: { order: true },
      orderBy: { order: { completedAt: "desc" } },
      take: 5,
    }),
    viewer ? prisma.favorite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: id } } }) : null,
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: listing.sellerId } } }) : null,
    getCommissionBps(),
  ]);
  const minBid = minimumNextBid(listing.startPrice ?? 0, listing.currentBid, bidCount > 0);
  const quote = listing.price != null ? Math.round((listing.price * bps) / 10000) : 0;
  const locale = prefs.locale;
  const showCart = listing.status === "ACTIVE" && listing.saleType !== "AUCTION" && listing.price != null && listing.quantityAvailable > 0 && !listing.binLockOrderId && !owner;
  const showBid = Boolean(live && viewer && !owner && !viewer.bidBanned);
  const dockPrice = showCart || listing.saleType !== "AUCTION" ? formatHkd(listing.price ?? 0, locale) : formatHkd(listing.currentBid ?? listing.startPrice ?? 0, locale);

  return (
    <div className={`grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 ${!owner && (live || showCart) ? "max-md:pb-36" : ""}`}>
      <ViewPing id={id} />
      <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
        <Flash locale={locale} ok={sp.ok} err={sp.err} />
        <Gallery urls={listing.photos.map((photo) => photo.url)} alt={listing.title} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{conditionLabel(listing)}</span>
          <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">{listingStatusLabel(locale, listing.status)}</span>
          {listing.certNumber ? <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-xs font-medium">#{listing.certNumber}</span> : null}
        </div>
        <h1 className="mt-3 text-[1.65rem] font-bold leading-tight">{listing.title}</h1>
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
          <div><dt className="text-muted">{tx(locale, "運費", "Shipping")}</dt><dd>{formatHkd(listing.shippingFee, locale)}</dd></div>
          <div><dt className="text-muted">{tx(locale, "寄出", "Ships in")}</dt><dd>{listing.shippingDays} {tx(locale, "日", "days")}</dd></div>
          <div><dt className="text-muted">{tx(locale, "存貨", "Stock")}</dt><dd>{listing.quantityAvailable}</dd></div>
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
        {comps.length ? (
          <section className="mt-6">
            <h2 className="font-semibold">{tx(locale, "站內相近成交", "Sold on TYSM")}</h2>
            <ul className="mt-2 text-sm">
              {comps.map((item) => (
                <li key={item.id}>{item.title} · {formatHkd(item.unitPrice, locale)} · {item.order.completedAt ? formatHKT(item.order.completedAt, locale, false) : ""}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {hasAuction ? (
          <section className="mt-6">
            <h2 className="font-semibold">{tx(locale, "出價紀錄", "Bid history")}</h2>
            <p className="text-sm text-muted">{tx(locale, "最高出價只有出價者自己可見。最後 2 分鐘出價會延長 2 分鐘。", "Maximum bids stay private. A bid in the final 2 minutes extends the auction by 2 minutes.")}</p>
            {listing.bidEvents.length === 0 ? <p className="text-sm">{tx(locale, "未有出價。", "No bids yet.")}</p> : null}
            <ul className="mt-2 text-sm">
              {listing.bidEvents.map((event) => (
                <li key={event.id}>{anonBidder(event.bidderId, locale)} · {formatHkd(event.publicAmount, locale)} · {formatHKT(event.createdAt, locale)}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {offers.length ? (
          <section className="mt-6 grid gap-3">
            <h2 className="font-semibold">{tx(locale, "議價", "Offers")}</h2>
            {offers.map((offer) => (
              <div key={offer.id} className="surface p-4 text-sm">
                <p>
                  {owner ? offer.buyer.nickname : tx(locale, "你的議價", "Your offer")} · {tx(locale, "第", "Round")} {offer.round}/3 · {offer.status}
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
                    {offer.round < 3 ? (
                      <>
                        <input className="field w-full sm:max-w-40" name="counter" placeholder="HKD" />
                        <button className="btn-ghost btn" name="act" value="counter">{tx(locale, "再議價", "Offer again")}</button>
                      </>
                    ) : null}
                  </form>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
      <aside id="purchase" className="surface panel order-2 grid h-fit min-w-0 gap-4 p-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:p-5">
        {listing.price != null && listing.saleType !== "AUCTION" ? <p className="price text-3xl">{formatHkd(listing.price, locale)}</p> : null}
        {hasAuction ? (
          <>
            <p className="price text-2xl">{tx(locale, "目前", "Current")} {formatHkd(listing.currentBid ?? listing.startPrice ?? 0, locale)}</p>
            {live ? (
              <p><Countdown endsAt={listing.auctionEndsAt!.toISOString()} locale={locale} /> · {formatHKT(listing.auctionEndsAt!, locale)}</p>
            ) : (
              <p>{tx(locale, "拍賣已結束", "Auction ended")} · {formatHKT(listing.auctionEndsAt!, locale)}</p>
            )}
            {live ? (
              <>
                <p className="text-sm text-muted">{tx(locale, "最低出價", "Minimum bid")} {formatHkd(mine && viewer?.id === listing.leaderId ? (mine.maxAmount + 1) : minBid, locale)}</p>
                {mine ? <p className="text-sm">{tx(locale, "你的最高出價（只有你可見）", "Your maximum (only you can see this)")} {formatHkd(mine.maxAmount, locale)}</p> : null}
                {viewer && !owner && !viewer.bidBanned ? (
                  <form id="bid-form" action={bidAction} className="grid gap-2">
                    <input type="hidden" name="listingId" value={id} />
                    <input className="field" name="max" inputMode="decimal" placeholder={centsToInput(minBid)} required />
                    <Submit label={tx(locale, "出價", "Place bid")} pendingLabel="…" />
                  </form>
                ) : null}
                {viewer?.bidBanned ? <p className="text-sm text-danger">{tx(locale, "你已被禁止出價。", "Bidding is disabled on your account.")}</p> : null}
              </>
            ) : null}
          </>
        ) : null}
        {listing.bidsVoided ? <p className="text-sm">{tx(locale, "直購已成交，所有出價作廢。", "Buy It Now ended the auction. Bids are void.")}</p> : null}
        {showCart ? (
          <form id="cart-form" action={cartAdd} className="grid gap-2">
            <input type="hidden" name="listingId" value={id} />
            <label className="text-sm">
              {tx(locale, "數量", "Quantity")}
              <input className="field" type="number" name="quantity" min={1} max={listing.quantityAvailable} defaultValue={1} />
            </label>
            <Submit label={tx(locale, "加入購物車", "Add to cart")} pendingLabel="…" />
            <Link className="btn btn-ghost w-full" href={`/checkout?buy=${id}&qty=1`}>{tx(locale, "立即購買", "Buy now")}</Link>
          </form>
        ) : null}
        {listing.binLockOrderId ? <p className="text-sm">{tx(locale, "有買家正在結帳。", "A buyer is checking out.")}</p> : null}
        {listing.offersEnabled && listing.minOffer && viewer && !owner ? (
          <form action={offerAction} className="grid gap-2">
            <input type="hidden" name="listingId" value={id} />
            <p className="text-sm text-muted">{tx(locale, "最低接受價", "Minimum offer")} {formatHkd(listing.minOffer, locale)} · {tx(locale, "最多 3 輪，24 小時有效", "3 rounds, valid for 24 hours")}</p>
            <input className="field" name="amount" inputMode="decimal" required />
            <Submit label={tx(locale, "議價", "Make offer")} pendingLabel="…" />
          </form>
        ) : null}
        {owner ? (
          <p className="text-sm text-muted">
            {tx(locale, "估計佣金", "Estimated commission")} {bpsToPercentLabel(bps)}%
            {listing.price != null ? ` · ${formatHkd(quote, locale)}` : ""}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <form action={toggleFavorite}>
            <input type="hidden" name="listingId" value={id} />
            <input type="hidden" name="next" value={`/listing/${id}`} />
            <button className="btn btn-ghost w-full">{favored ? "♥" : "♡"} {tx(locale, "收藏", "Favorite")}</button>
          </form>
          {!owner ? (
            <form action={openThread}>
              <input type="hidden" name="listingId" value={id} />
              <button className="btn btn-ghost w-full">{tx(locale, "聯絡賣家", "Contact seller")}</button>
            </form>
          ) : null}
        </div>
        <div className="text-sm">
          <Link href={`/shop/${listing.sellerId}`} className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-rose to-teal text-sm font-bold text-[#1b1418]">
              {listing.seller.nickname.slice(0, 1)}
            </span>
            <span>
              <span className="block font-medium">{listing.seller.nickname}</span>
              <span className="text-xs text-muted">{tx(locale, "賣家", "Seller")}</span>
            </span>
          </Link>
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
        {viewer && !owner ? (
          <form action={reportAction} className="grid gap-2">
            <input type="hidden" name="targetType" value="LISTING" />
            <input type="hidden" name="targetId" value={id} />
            <textarea className="field" name="reason" placeholder={tx(locale, "檢舉原因", "Report reason")} />
            <button className="text-left text-sm underline">{tx(locale, "檢舉刊登", "Report listing")}</button>
          </form>
        ) : null}
        {!viewer ? <p className="text-sm"><Link className="text-link" href={`/login?next=/listing/${id}`}>{tx(locale, "登入後先可以購買、出價、收藏或傳訊息。", "Log in to buy, bid, favorite, or message.")}</Link></p> : null}
      </aside>
      {!owner && live ? (
        <BuyDock
          watchId="purchase"
          label={showCart ? tx(locale, "直購價", "Buy now") : tx(locale, "目前出價", "Current bid")}
          price={showCart ? formatHkd(listing.price ?? 0, locale) : formatHkd(listing.currentBid ?? listing.startPrice ?? 0, locale)}
          note={
            <>
              {showCart ? <span>{tx(locale, "目前", "Bid")} {formatHkd(listing.currentBid ?? listing.startPrice ?? 0, locale)} · </span> : null}
              <Countdown endsAt={listing.auctionEndsAt!.toISOString()} locale={locale} />
            </>
          }
        >
          {showBid ? (
            <button form="bid-form" className="btn btn-primary shrink-0 px-4">{tx(locale, "出價", "Place bid")}</button>
          ) : !viewer ? (
            <Link href={`/login?next=/listing/${id}`} className="btn btn-primary shrink-0 px-4">{tx(locale, "登入出價", "Log in to bid")}</Link>
          ) : null}
          {showCart ? (
            <button form="cart-form" className={`btn shrink-0 px-4 ${showBid || !viewer ? "btn-ghost" : "btn-primary"}`}>{tx(locale, "加入購物車", "Add to cart")}</button>
          ) : null}
        </BuyDock>
      ) : showCart ? (
        <BuyDock watchId="purchase" label={tx(locale, "直購價", "Buy now")} price={dockPrice}>
          <button form="cart-form" className="btn btn-primary shrink-0">{tx(locale, "加入購物車", "Add to cart")}</button>
        </BuyDock>
      ) : null}
      {similar.length ? (
        <section className="order-4 lg:col-span-2 lg:col-start-1 lg:row-start-3">
          <h2 className="mb-3 text-lg font-bold">{tx(locale, "相似貨品", "Similar items")}</h2>
          <div className="feed">
            {similar.map((item) => (
              <ListingCard key={item.id} listing={item} locale={locale} favorited={false} followed={false} next={`/listing/${id}`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
