import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCommissionBps, getPrefs, getViewer } from "@/lib/auth";
import { centsToInput, toHkInput } from "@/lib/format";
import { bpsToPercentLabel, formatGradeValue } from "@/lib/rules";
import { SellForm } from "@/components/sell-form";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/sell/${id}`);
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" } }, category: true },
  });
  if (!listing || listing.sellerId !== viewer.id) notFound();
  const [categories, bps, bids] = await Promise.all([
    prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } }),
    getCommissionBps(),
    prisma.proxyBid.count({ where: { listingId: id } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">{prefs.locale === "en" ? "Edit listing" : "編輯刊登"}</h1>
      <SellForm
        locale={prefs.locale}
        percent={bpsToPercentLabel(bps)}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg" }))}
        initial={{
          listingId: listing.id,
          categoryId: listing.categoryId,
          title: listing.title,
          description: listing.description,
          saleType: listing.saleType,
          price: centsToInput(listing.price),
          startPrice: centsToInput(listing.startPrice),
          auctionEndsAt: listing.auctionEndsAt ? toHkInput(listing.auctionEndsAt) : "",
          offersEnabled: listing.offersEnabled,
          minOffer: centsToInput(listing.minOffer),
          shippingDays: listing.shippingDays,
          shipSfCod: listing.shipSfCod,
          shipMeetup: listing.shipMeetup,
          shipPickup: listing.shipPickup,
          meetupDistrict: listing.meetupDistrict || "",
          meetupWindow: listing.meetupWindow || "",
          meetupNotes: listing.meetupNotes || "",
          quantity: listing.quantity,
          game: listing.game || "",
          setName: listing.setName || "",
          cardName: listing.cardName || "",
          cardNumber: listing.cardNumber || "",
          rarity: listing.rarity || "",
          language: listing.language || "",
          personName: listing.personName || "",
          seasonYear: listing.seasonYear || "",
          brandSeries: listing.brandSeries || "",
          conditionTrack: listing.conditionTrack,
          rawGrade: listing.rawGrade || "",
          grader: listing.grader || "",
          gradeScore: listing.gradeValue != null ? formatGradeValue(listing.gradeValue) : "",
          certNumber: listing.certNumber || "",
          videoUrl: listing.videoUrl || "",
          publishAt: listing.publishAt ? toHkInput(listing.publishAt) : "",
          photos: listing.photos.map((photo) => ({ url: photo.url, role: photo.role })),
          locked: bids > 0,
        }}
        storeReady={Boolean(viewer.storeDistrict?.trim() && viewer.storeLine1?.trim())}
        storeLabel={[viewer.storeName, viewer.storeDistrict, viewer.storeLine1].filter(Boolean).join(" ")}
      />
    </div>
  );
}
