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
  const lineOf = (
    listing: {
      sellerId: string;
      title: string;
      price: number | null;
      shipSfCod: boolean;
      shipMeetup: boolean;
      shipPickup: boolean;
      meetupDistrict: string | null;
      meetupWindow: string | null;
      meetupNotes: string | null;
      seller: { nickname: string; storeName: string | null; storeDistrict: string | null; storeLine1: string | null; storeHours: string | null };
    },
    quantity: number,
    image: string | null,
  ) => ({
    sellerId: listing.sellerId,
    title: listing.title,
    seller: listing.seller.nickname,
    quantity,
    price: listing.price ?? 0,
    image,
    shipSfCod: listing.shipSfCod,
    shipMeetup: listing.shipMeetup,
    shipPickup: listing.shipPickup,
    meetupDistrict: listing.meetupDistrict,
    meetupWindow: listing.meetupWindow,
    meetupNotes: listing.meetupNotes,
    storeName: listing.seller.storeName,
    storeDistrict: listing.seller.storeDistrict,
    storeLine1: listing.seller.storeLine1,
    storeHours: listing.seller.storeHours,
  });
  const lines = buy
    ? [lineOf(buy, Math.max(1, Number(sp.qty || 1)), buy.photos[0]?.url ?? null)]
    : cart.map((item) => lineOf(item.listing, item.quantity, item.listing.photos[0]?.url ?? null));

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <div>
        <h1 className="page-title">{tx(prefs.locale, "結帳", "Checkout")}</h1>
        <p className="text-sm text-muted">{tx(prefs.locale, "核對貨品同運送方式。平台運費 HK$0。確認後先至付款。", "Check the item and shipping method. Platform shipping is HK$0. Then pay.")}</p>
      </div>
      {lines.length === 0 ? <p className="empty">{tx(prefs.locale, "沒有可結帳的貨品。", "Nothing to check out.")}</p> : null}
      {lines.length ? (
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
