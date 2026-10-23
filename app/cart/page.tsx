import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
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
  let shipping = 0;
  for (const item of items) {
    goods += (item.listing.price ?? 0) * item.quantity;
    shipping += item.listing.shippingFee;
  }

  return (
    <div className={items.length ? "pb-24 md:pb-0" : undefined}>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <h1 className="page-title">{tx(prefs.locale, "購物車", "Cart")}</h1>
      <p className="mb-4 text-sm text-muted">{tx(prefs.locale, "每位賣家會分開一張訂單。同一件貨品的運費只計一次，唔會因數量倍增，亦冇合併運費優惠。", "Each seller becomes a separate order. Shipping is charged once per listing, not multiplied by quantity, and is not combined.")}</p>
      {items.length === 0 ? <p className="empty">{tx(prefs.locale, "購物車是空的。", "Your cart is empty.")}</p> : null}
      {[...groups.entries()].map(([sellerId, rows]) => (
        <section key={sellerId} className="surface mb-4 p-4">
          <h2 className="font-bold"><Link href={`/shop/${sellerId}`}>{rows[0].listing.seller.nickname}</Link></h2>
          {rows.map((item) => (
            <div key={item.id} className="mt-4 flex gap-3">
              <img src={item.listing.photos[0]?.url || "/demo/back.svg"} alt="" className="h-24 w-20 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <Link href={`/listing/${item.listingId}`} className="line-clamp-2 font-medium leading-snug">{item.listing.title}</Link>
                <p className="price mt-1 text-lg">{formatHkd(item.listing.price ?? 0, prefs.locale)}</p>
                <p className="text-sm text-muted">{tx(prefs.locale, "運費", "Shipping")} {formatHkd(item.listing.shippingFee, prefs.locale)} · × {item.quantity}</p>
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
        <div
          className="fixed inset-x-0 z-30 flex items-center gap-3 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgba(34,24,32,0.06)] backdrop-blur-xl md:static md:bg-transparent md:px-0 md:py-0 md:shadow-none"
          style={{ bottom: "var(--tab-h)" }}
        >
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="block text-muted">{tx(prefs.locale, "貨品", "Items")} + {tx(prefs.locale, "運費", "shipping")}</span>
            <span className="price text-xl">{formatHkd(goods + shipping, prefs.locale)}</span>
          </p>
          <Link className="btn btn-primary shrink-0" href="/checkout">{tx(prefs.locale, "結帳", "Checkout")}</Link>
        </div>
      ) : null}
    </div>
  );
}
