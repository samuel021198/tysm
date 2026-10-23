import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { CheckoutForm } from "@/components/checkout-form";

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
    ? await prisma.listing.findUnique({
        where: { id: sp.buy },
        include: { seller: true, photos: { orderBy: { position: "asc" }, take: 1 } },
      })
    : null;
  const cart = buy
    ? []
    : await prisma.cartItem.findMany({
        where: { userId: viewer.id },
        include: { listing: { include: { seller: true, photos: { orderBy: { position: "asc" }, take: 1 } } } },
      });
  const lines = buy
    ? [{
        title: buy.title,
        seller: buy.seller.nickname,
        quantity: Math.max(1, Number(sp.qty || 1)),
        price: buy.price ?? 0,
        image: buy.photos[0]?.url ?? null,
        sf: buy.shippingFee,
        locker: buy.shipLockerFee,
        meet: buy.shipMeetFee,
      }]
    : cart.map((item) => ({
        title: item.listing.title,
        seller: item.listing.seller.nickname,
        quantity: item.quantity,
        price: item.listing.price ?? 0,
        image: item.listing.photos[0]?.url ?? null,
        sf: item.listing.shippingFee,
        locker: item.listing.shipLockerFee,
        meet: item.listing.shipMeetFee,
      }));

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div>
        <h1 className="page-title">{tx(prefs.locale, "結帳", "Checkout")}</h1>
        <p className="text-sm text-muted">{tx(prefs.locale, "核對貨品、運費同付款方式。確認後先至付款。", "Check the item, shipping, and payment method before you pay.")}</p>
      </div>
      {lines.length === 0 ? <p className="empty">{tx(prefs.locale, "沒有可結帳的貨品。", "Nothing to check out.")}</p> : null}
      {addresses.length === 0 ? (
        <p><a className="text-link" href="/me">{tx(prefs.locale, "請先在帳戶新增香港地址。", "Add a Hong Kong address in your account first.")}</a></p>
      ) : lines.length ? (
        <CheckoutForm
          locale={prefs.locale}
          mode={buy ? "buy" : "cart"}
          listingId={buy?.id}
          quantity={buy ? Math.max(1, Number(sp.qty || 1)) : undefined}
          lines={lines}
          addresses={addresses}
        />
      ) : null}
    </div>
  );
}
