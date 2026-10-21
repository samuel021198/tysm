import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { Submit } from "@/components/submit";
import { checkoutAction } from "@/actions/trade";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; buy?: string; qty?: string }>;
}) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/checkout${sp.buy ? `?buy=${sp.buy}` : ""}`);
  const addresses = await prisma.address.findMany({ where: { userId: viewer.id }, orderBy: { isDefault: "desc" } });
  const buy = sp.buy
    ? await prisma.listing.findUnique({ where: { id: sp.buy }, include: { seller: true } })
    : null;
  const cart = buy
    ? []
    : await prisma.cartItem.findMany({ where: { userId: viewer.id }, include: { listing: { include: { seller: true } } } });
  const lines = buy
    ? [{ title: buy.title, seller: buy.seller.nickname, quantity: Number(sp.qty || 1), price: buy.price ?? 0, shipping: buy.shippingFee }]
    : cart.map((item) => ({
        title: item.listing.title,
        seller: item.listing.seller.nickname,
        quantity: item.quantity,
        price: item.listing.price ?? 0,
        shipping: item.listing.shippingFee,
      }));

  return (
    <div className="grid gap-4">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <h1 className="text-2xl font-semibold">{tx(prefs.locale, "結帳", "Checkout")}</h1>
      {lines.length === 0 ? <p>{tx(prefs.locale, "沒有可結帳的貨品。", "Nothing to check out.")}</p> : null}
      {lines.map((line, index) => (
        <p key={index} className="text-sm">
          {line.seller} · {line.title} × {line.quantity} · {formatHkd(line.price * line.quantity + line.shipping, prefs.locale)}
        </p>
      ))}
      {addresses.length === 0 ? (
        <p><a className="text-link" href="/me">{tx(prefs.locale, "請先在帳戶新增香港地址。", "Add a Hong Kong address in your account first.")}</a></p>
      ) : lines.length ? (
        <form action={checkoutAction} className="grid max-w-lg gap-3">
          <input type="hidden" name="mode" value={buy ? "buy" : "cart"} />
          {buy ? <input type="hidden" name="listingId" value={buy.id} /> : null}
          {buy ? <input type="hidden" name="quantity" value={String(Math.max(1, Number(sp.qty || 1)))} /> : null}
          {addresses.map((address) => (
            <label key={address.id} className="flex gap-2 rounded-xl border border-line p-3 text-sm">
              <input type="radio" name="addressId" value={address.id} defaultChecked={address.isDefault} required />
              <span>{address.recipient} · {address.phone}<br />{address.district} {address.line1}</span>
            </label>
          ))}
          <Submit label={tx(prefs.locale, "建立訂單", "Place orders")} pendingLabel="…" />
        </form>
      ) : null}
    </div>
  );
}
