import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { DEAL_RISK } from "@/lib/deal-phase";
import { tx } from "@/lib/i18n";
import { hasStoreAddress, offeredMethods, shipMethodLabel } from "@/lib/shipping";
import { Flash } from "@/components/shell";
import { cartUpdate } from "@/actions/trade";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/cart");
  const items = await prisma.cartItem.findMany({
    where: { userId: viewer.id },
    include: { listing: { include: { seller: true, photos: { take: 1, orderBy: { position: "asc" } } } } },
  });
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = groups.get(item.listing.sellerId) ?? [];
    bucket.push(item);
    groups.set(item.listing.sellerId, bucket);
  }
  let goods = 0;
  for (const item of items) {
    goods += (item.listing.price ?? 0) * item.quantity;
  }

  return (
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <h1 className="page-title">{tx(prefs.locale, "購物車", "Cart")}</h1>
      <p className="mb-4 text-sm text-muted">{DEAL_RISK} {tx(prefs.locale, "要傾交收，請打開貨品頁。", "To arrange a handover, open the listing.")}</p>
      {items.length === 0 ? <p className="empty">{tx(prefs.locale, "購物車是空的。", "Your cart is empty.")}</p> : null}
      {[...groups.entries()].map(([sellerId, rows]) => (
        <section key={sellerId} className="surface mb-3 p-3">
          <h2 className="text-sm font-semibold"><Link href={`/shop/${sellerId}`}>{rows[0].listing.seller.nickname}</Link></h2>
          {rows.map((item) => (
            <div key={item.id} className="mt-3 flex items-start gap-3">
              <img src={item.listing.photos[0]?.url || "/demo/back.svg"} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-soft object-contain" />
              <div className="min-w-0 flex-1">
                <Link href={`/listing/${item.listingId}`} className="line-clamp-2 text-sm font-medium leading-snug">{item.listing.title}</Link>
                <p className="price mt-1 text-base leading-none">{formatHkd(item.listing.price ?? 0, prefs.locale)}</p>
                <p className="text-sm text-muted">
                  {offeredMethods(item.listing, hasStoreAddress(item.listing.seller)).map((method) => shipMethodLabel(method, prefs.locale)).join(" · ") || tx(prefs.locale, "未有運送方式", "No shipping method")}
                  {" · "}
                  {tx(prefs.locale, "交收方式", "Handover")}
                </p>
                <form action={cartUpdate} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="listingId" value={item.listingId} />
                  <input className="field w-24" type="number" name="quantity" min={1} max={item.listing.quantityAvailable} defaultValue={item.quantity} />
                  <button className="btn btn-ghost">{tx(prefs.locale, "更新", "Update")}</button>
                  <button className="btn btn-ghost" name="remove" value="1">{tx(prefs.locale, "移除", "Remove")}</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      ))}
      {items.length ? (
        <p className="text-sm">
          <span className="text-muted">{tx(prefs.locale, "貨品總額（只供顯示）", "Items (display only)")} </span>
          <span className="price">{formatHkd(goods, prefs.locale)}</span>
        </p>
      ) : null}
    </div>
  );
}
