import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { canOfferFromMenu, dealBlocked, dealEventCopy, dealPhase, latestOpenOfferMessage, readDealEvent, readDealMeta } from "@/lib/deal-phase";
import { loadShareCards, sellerPayment } from "@/lib/deals";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { shareTarget } from "@/lib/share";
import { isBlocked } from "@/lib/social";
import { DealStream } from "@/components/deal-panel";
import { ListingChatBar } from "@/components/listing-chat-bar";
import { ReadPing } from "@/components/pings";
import { Flash } from "@/components/shell";
import { MessageComposer } from "@/components/message-composer";
import { PersonMenu } from "@/components/safety-menu";
import { ThreadScroll } from "@/components/thread-scroll";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string; compose?: string; offer?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/messages/${id}`);
  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { sender: true } },
      buyer: true,
      seller: true,
      listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } },
    },
  });
  if (!thread || (thread.buyerId !== viewer.id && thread.sellerId !== viewer.id)) notFound();
  const otherId = thread.buyerId === viewer.id ? thread.sellerId : thread.buyerId;
  if (await isBlocked(viewer.id, otherId)) notFound();
  const other = thread.buyerId === viewer.id ? thread.seller : thread.buyer;
  const paths = thread.messages.map((message) => shareTarget(message.body)).filter((path): path is string => Boolean(path));
  const [cards, orders] = await Promise.all([
    loadShareCards(paths),
    thread.listingId
      ? prisma.order.findMany({
          where: {
            buyerId: thread.buyerId,
            sellerId: thread.sellerId,
            items: { some: { listingId: thread.listingId } },
          },
          include: {
            items: { include: { listing: true } },
            ratings: { select: { authorId: true, stars: true, comment: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);
  const open = orders.find((order) => {
    const phase = dealPhase(order);
    return phase !== "CANCELLED" && phase !== "DONE";
  });
  const order = open ?? orders.find((row) => dealPhase(row) === "DONE") ?? orders[0] ?? null;
  const phase = order ? dealPhase(order) : null;
  const offer = order ? readDealMeta(order.fulfillment).offer : null;
  const pendingOffer = offer?.status === "PENDING" ? offer : null;
  const pending = Boolean(pendingOffer);
  const blocked = order
    ? order.items.some((item) => dealBlocked(dealPhase(order), item.listing.status, item.listing.binLockOrderId, order.id))
    : Boolean(thread.listing?.binLockOrderId);
  const listingClosed = Boolean(thread.listing && thread.listing.status !== "ACTIVE");
  const canOffer = canOfferFromMenu(phase, pending, blocked || listingClosed, pendingOffer?.by === viewer.id, offer?.status === "ACCEPTED");
  const liveOfferId = pending ? latestOpenOfferMessage(thread.messages)?.id ?? null : null;
  const reviseItem = order?.items[0];
  const listPrice = thread.listing ? (thread.listing.price ?? thread.listing.currentBid ?? thread.listing.startPrice) : null;
  const bound = thread.listing ? { id: thread.listing.id, title: thread.listing.title, priceCents: listPrice, cover: null as string | null } : null;
  // ponytail: 30 newest unlocked listings. A paged sheet is the upgrade if a shop has more.
  const choices = !thread.listingId && canOffer
    ? (
        await prisma.listing.findMany({
          where: { sellerId: otherId, status: "ACTIVE", quantityAvailable: { gte: 1 } },
          include: { photos: { take: 1, orderBy: { position: "asc" } } },
          orderBy: { updatedAt: "desc" },
          take: 30,
        })
      ).map((listing) => ({
        id: listing.id,
        title: listing.title,
        priceCents: listing.price ?? listing.currentBid ?? listing.startPrice,
        cover: listing.photos[0]?.url ?? null,
      }))
    : [];
  return (
    <div className="thread-fit">
      <ReadPing id={id} />
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h1 className="min-w-0 truncate text-[1.3rem] font-bold leading-tight">{other.nickname}</h1>
        <PersonMenu
          locale={prefs.locale}
          userId={otherId}
          reportType="THREAD"
          reportId={id}
          next={`/messages/${id}`}
          away="/messages"
        />
      </div>
      <ThreadScroll>
        {thread.listing ? (
          <ListingChatBar
            locale={prefs.locale}
            threadId={id}
            listingId={thread.listing.id}
            title={thread.listing.title}
            priceCents={listPrice}
            cover={thread.listing.photos[0]?.url ?? null}
            openOffer={sp.offer === "1"}
            riskAcked={Boolean(viewer.p2pRiskAckAt)}
          />
        ) : null}
        <div className="grid gap-2.5">
        <ol className="grid content-start gap-2.5">
          {thread.messages.map((message) => {
            const event = readDealEvent(message.body);
            if (event?.kind === "offer" && event.superseded) {
              const copy = dealEventCopy(prefs.locale, event);
              return (
                <li key={message.id} className="mx-auto grid w-full max-w-[18rem] justify-items-center gap-0.5 rounded-2xl border border-line bg-soft px-3 py-2 text-center text-xs text-muted">
                  <p className="font-semibold">{tx(prefs.locale, "已取代", "Superseded")}</p>
                  <p>{copy.text}</p>
                  {copy.note ? <p>{copy.note}</p> : null}
                </li>
              );
            }
            if (event?.kind === "offer" && message.id === liveOfferId) return null;
            if (event) {
              const copy = dealEventCopy(prefs.locale, event);
              return (
                <li key={message.id} className="mx-auto grid max-w-[18rem] justify-items-center gap-0.5 px-3 py-1 text-center text-xs text-muted">
                  <p>{copy.text}</p>
                  {copy.note ? <p>{copy.note}</p> : null}
                </li>
              );
            }
            const mine = message.senderId === viewer.id;
            const linked = shareTarget(message.body);
            const card = linked ? cards.get(linked) : undefined;
            return (
              <li key={message.id} className={mine ? "ml-10 rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-3" : "surface mr-10 rounded-2xl rounded-bl-md px-3.5 py-3"}>
                {card ? (
                  <Link href={card.href} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                    <img src={message.imageUrl || card.cover || "/demo/back.svg"} alt="" className="h-24 w-[4.5rem] rounded-xl bg-soft object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{card.title}</span>
                      {card.caption ? <span className="mt-0.5 block line-clamp-2 text-xs text-muted">{card.caption}</span> : null}
                      {card.priceCents != null ? <span className="price mt-1 block text-sm">{formatHkd(card.priceCents, prefs.locale)}</span> : null}
                    </span>
                  </Link>
                ) : (
                  <p className="text-[15px] leading-6">{message.body}</p>
                )}
                {!card && message.imageUrl ? <img src={message.imageUrl} alt="" className="mt-2 max-h-48 rounded-xl" /> : null}
                <p className="mt-1 text-[11px] text-muted">
                  {formatHKT(message.createdAt, prefs.locale)} · {mine ? (message.readAt ? tx(prefs.locale, "已讀", "Read") : tx(prefs.locale, "已送出", "Sent")) : message.sender.nickname}
                </p>
              </li>
            );
          })}
          {order ? (
            <li>
              <DealStream
                locale={prefs.locale}
                viewerId={viewer.id}
                next={`/messages/${id}`}
                rating={order.ratings.find((row) => row.authorId === viewer.id) ?? null}
                payment={sellerPayment(thread.seller)}
                names={{ buyer: thread.buyer.nickname, seller: thread.seller.nickname }}
                revise={
                  pendingOffer && pendingOffer.by !== viewer.id && reviseItem
                    ? {
                        threadId: id,
                        riskAcked: Boolean(viewer.p2pRiskAckAt),
                        priceCents: pendingOffer.amount,
                        note: pendingOffer.note,
                        listing: {
                          id: reviseItem.listingId,
                          title: reviseItem.title,
                          priceCents: reviseItem.unitPrice,
                          cover: null,
                        },
                      }
                    : null
                }
                order={order}
              />
            </li>
          ) : null}
        </ol>
        </div>
      </ThreadScroll>
      <MessageComposer
        locale={prefs.locale}
        threadId={id}
        focus={sp.compose === "1"}
        canOffer={canOffer}
        bound={bound}
        choices={choices}
        riskAcked={Boolean(viewer.p2pRiskAckAt)}
        offerPrefill={
          pendingOffer && pendingOffer.by === viewer.id
            ? { priceCents: pendingOffer.amount, note: pendingOffer.note }
            : null
        }
      />
    </div>
  );
}
