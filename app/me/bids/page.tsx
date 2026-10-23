import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { offerStatusLabel, orderStatusLabel, tx } from "@/lib/i18n";
import { resolveAuction } from "@/lib/rules";

export default async function BidsPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/bids");
  const proxies = await prisma.proxyBid.findMany({
    where: { bidderId: viewer.id },
    include: { listing: true },
    orderBy: { updatedAt: "desc" },
  });
  const active = [];
  for (const proxy of proxies) {
    if (proxy.listing.auctionSettled || proxy.listing.status !== "ACTIVE") continue;
    const all = await prisma.proxyBid.findMany({ where: { listingId: proxy.listingId } });
    const resolved = resolveAuction(proxy.listing.startPrice ?? 0, all);
    active.push({ proxy, leading: resolved.leaderId === viewer.id, price: resolved.price });
  }
  const won = await prisma.order.findMany({
    where: { buyerId: viewer.id, source: "AUCTION" },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  const offers = await prisma.offer.findMany({
    where: { buyerId: viewer.id },
    include: { listing: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const locale = prefs.locale;
  return (
    <div className="grid gap-8">
      <section>
        <h1 className="mb-3 text-2xl font-semibold">{tx(locale, "進行中", "In progress")}</h1>
        {active.filter((row) => row.leading).length === 0 ? <p>{tx(locale, "未有領先出價。", "You are not leading any auction.")}</p> : null}
        {active.filter((row) => row.leading).map((row) => (
          <p key={row.proxy.id}><Link href={`/listing/${row.proxy.listingId}`}>{row.proxy.listing.title}</Link> · {formatHkd(row.price, locale)} · {tx(locale, "你的最高", "Your max")} {formatHkd(row.proxy.maxAmount, locale)}</p>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{tx(locale, "已被超價", "Outbid")}</h2>
        {active.filter((row) => !row.leading).length === 0 ? <p>{tx(locale, "沒有被超價的拍賣。", "No outbid auctions.")}</p> : null}
        {active.filter((row) => !row.leading).map((row) => (
          <p key={row.proxy.id}><Link href={`/listing/${row.proxy.listingId}`}>{row.proxy.listing.title}</Link> · {formatHkd(row.price, locale)}</p>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{tx(locale, "贏得", "Won")}</h2>
        {won.length === 0 ? <p>{tx(locale, "未有得標訂單。", "No auction wins.")}</p> : null}
        {won.map((order) => (
          <p key={order.id}><Link href={`/orders/${order.id}`}>{order.items[0]?.title}</Link> · {formatHkd(order.total, locale)} · {orderStatusLabel(locale, order.status)}</p>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{tx(locale, "我的議價", "My offers")}</h2>
        {offers.length === 0 ? <p>{tx(locale, "未有議價。", "No offers.")}</p> : null}
        {offers.map((offer) => (
          <p key={offer.id}><Link href={`/listing/${offer.listingId}`}>{offer.listing.title}</Link> · {formatHkd(offer.amount, locale)} · {offerStatusLabel(locale, offer.status)} · {tx(locale, "第", "Round")} {offer.round}/3</p>
        ))}
      </section>
    </div>
  );
}
