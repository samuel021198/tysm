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
    <div>
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <h1 className="mb-2 text-2xl font-semibold">{tx(prefs.locale, "購物車", "Cart")}</h1>
      <p className="mb-4 text-sm text-muted">{tx(prefs.locale, "每位賣家會分開一張訂單。同一件貨品的運費只計一次，唔會因數量倍增，亦冇合併運費優惠。", "Each seller becomes a separate order. Shipping is charged once per listing, not multiplied by quantity, and is not combined.")}</p>
      {items.length === 0 ? <p>{tx(prefs.locale, "購物車是空的。", "Your cart is empty.")}</p> : null}
      {[...groups.entries()].map(([sellerId, rows]) => (
        <section key={sellerId} className="mb-6 rounded-2xl border border-line p-4">
          <h2 className="font-semibold"><Link href={`/shop/${sellerId}`}>{rows[0].listing.seller.nickname}</Link></h2>
          {rows.map((item) => (
            <div key={item.id} className="mt-3 flex gap-3 text-sm">
              <img src={item.listing.photos[0]?.url || "/demo/back.svg"} alt="" className="h-20 w-16 rounded-lg object-cover" />
              <div className="flex-1">
                <Link href={`/listing/${item.listingId}`}>{item.listing.title}</Link>
                <p>{formatHkd(item.listing.price ?? 0, prefs.locale)} × {item.quantity}</p>
                <p className="text-muted">{tx(prefs.locale, "運費", "Shipping")} {formatHkd(item.listing.shippingFee, prefs.locale)}</p>
                <form action={cartUpdate} className="mt-2 flex gap-2">
                  <input type="hidden" name="listingId" value={item.listingId} />
                  <input className="field w-20" type="number" name="quantity" min={1} max={item.listing.quantityAvailable} defaultValue={item.quantity} />
                  <button className="btn-ghost btn">{tx(prefs.locale, "更新", "Update")}</button>
                  <button className="btn-ghost btn" name="remove" value="1">{tx(prefs.locale, "移除", "Remove")}</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      ))}
      {items.length ? (
        <div className="flex items-center justify-between">
          <p>{tx(prefs.locale, "貨品", "Items")} {formatHkd(goods, prefs.locale)} + {tx(prefs.locale, "運費", "shipping")} {formatHkd(shipping, prefs.locale)}</p>
          <Link className="btn btn-primary" href="/checkout">{tx(prefs.locale, "結帳", "Checkout")}</Link>
        </div>
      ) : null}
    </div>
  );
}
