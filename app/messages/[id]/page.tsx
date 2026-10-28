import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { dealPhase } from "@/lib/deal-phase";
import { loadShareCards, sellerPayment } from "@/lib/deals";
import { formatHkd, formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { shareTarget } from "@/lib/share";
import { isBlocked } from "@/lib/social";
import { DealStream } from "@/components/deal-panel";
import { ReadPing } from "@/components/pings";
import { Flash } from "@/components/shell";
import { MessageComposer } from "@/components/message-composer";
import { ThreadScroll } from "@/components/thread-scroll";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; compose?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/messages/${id}`);
  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { sender: true } }, buyer: true, seller: true, listing: true },
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
          include: { items: { include: { listing: true } }, reviews: { select: { authorId: true } } },
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
  return (
    <div className="thread-fit">
      <ReadPing id={id} />
      <Flash locale={prefs.locale} err={sp.err} />
      <ThreadScroll>
        <div className="grid gap-2.5">
        <h1 className="text-[1.3rem] font-bold leading-tight">{other.nickname}</h1>
        {thread.listing ? <p className="text-sm text-muted">{thread.listing.title}</p> : null}
        <ol className="grid content-start gap-2.5">
          {thread.messages.map((message) => {
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
                reviewed={order.reviews.some((review) => review.authorId === viewer.id)}
                payment={sellerPayment(thread.seller)}
                order={order}
              />
            </li>
          ) : null}
        </ol>
        </div>
      </ThreadScroll>
      <MessageComposer locale={prefs.locale} threadId={id} focus={sp.compose === "1"} />
    </div>
  );
}
