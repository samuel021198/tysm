import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { listingCatalogPrefill } from "@/lib/catalog-suggest";
import { formatGradeValue } from "@/lib/rules";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { getDexCard } from "@/lib/dex-query";
import { SellForm, type SellInitial } from "@/components/sell-form";
import { PhoneForm } from "@/components/phone-form";

function applyCollection(
  initial: SellInitial | undefined,
  collection: {
    id: string;
    title: string;
    note: string;
    cardName: string | null;
    catalogCardId: string | null;
    conditionTrack: "RAW" | "GRADED";
    rawGrade: string | null;
    grader: string | null;
    gradeValue: number | null;
    photos: { url: string; role: "FRONT" | "BACK" | "GALLERY"; position: number }[];
  } | null,
): SellInitial | undefined {
  if (!collection) return initial;
  const photos = collection.photos.map((photo, position) => ({
    url: photo.url,
    role: photo.role === "BACK" ? ("BACK" as const) : position === 0 ? ("FRONT" as const) : ("GALLERY" as const),
  }));
  const gradeScore = collection.gradeValue != null ? formatGradeValue(collection.gradeValue) : "";
  const cardName = collection.cardName || collection.title;
  const base: SellInitial = initial ?? {
    categoryId: "",
    title: "",
    description: "",
    saleType: "BUY_NOW",
    price: "",
    startPrice: "",
    auctionEndsAt: "",
    offersEnabled: false,
    minOffer: "",
    shippingDays: 3,
    shipSfCod: true,
    shipMeetup: false,
    shipPickup: false,
    meetupDistrict: "",
    meetupWindow: "",
    meetupNotes: "",
    quantity: 1,
    game: "",
    setName: "",
    cardName: "",
    cardNumber: "",
    rarity: "",
    language: "",
    personName: "",
    seasonYear: "",
    brandSeries: "",
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: "PSA",
    gradeScore: "",
    certNumber: "",
    videoUrl: "",
    publishAt: "",
    photos: [],
    locked: false,
  };
  const card = base.cards?.[0];
  return {
    ...base,
    collectionItemId: collection.id,
    title: collection.title || base.title,
    description: collection.note || base.description,
    cardName: cardName || base.cardName,
    conditionTrack: collection.conditionTrack,
    rawGrade: collection.rawGrade || base.rawGrade,
    grader: collection.grader || base.grader,
    gradeScore: gradeScore || base.gradeScore,
    photos: photos.length ? photos : base.photos,
    catalogCardId: base.catalogCardId || collection.catalogCardId || "",
    cards: [
      {
        name: cardName || card?.name || "",
        catalogId: card?.catalogId || collection.catalogCardId || "",
        catalogTitle: card?.catalogTitle || "",
        year: card?.year || base.seasonYear,
        setName: card?.setName || base.setName,
        setCode: card?.setCode || "",
        number: card?.number || base.cardNumber,
        rarity: card?.rarity || base.rarity,
        language: card?.language || base.language,
        game: card?.game || base.game,
        price: card?.price || "",
        track: collection.conditionTrack,
        rawGrade: collection.rawGrade || card?.rawGrade || "A",
        grader: collection.grader || card?.grader || "PSA",
        gradeScore: gradeScore || card?.gradeScore || "",
        certNumber: card?.certNumber || "",
      },
    ],
  };
}

function catalogCardParam(value: string | undefined) {
  const id = (value || "").trim();
  return /^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : "";
}

export default async function SellPage({ searchParams }: { searchParams: Promise<{ catalogCardId?: string; collectionItemId?: string; sale?: string }> }) {
  const sp = await searchParams;
  const requestedCatalogId = catalogCardParam(sp.catalogCardId);
  const collectionItemId = catalogCardParam(sp.collectionItemId);
  const nextParams = new URLSearchParams();
  if (requestedCatalogId) nextParams.set("catalogCardId", requestedCatalogId);
  if (collectionItemId) nextParams.set("collectionItemId", collectionItemId);
  const nextPath = nextParams.size ? `/sell?${nextParams}` : "/sell";
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!viewer.phoneVerified) return <PhoneForm locale={prefs.locale} next={nextParams.size ? nextPath : undefined} />;
  const [categories, sold, collection] = await Promise.all([
    prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } }),
    prisma.orderItem.findMany({
      where: { order: { status: "COMPLETED" } },
      include: { order: { select: { completedAt: true } } },
      orderBy: { order: { completedAt: "desc" } },
      take: 3,
    }),
    collectionItemId
      ? prisma.collectionItem.findFirst({
          where: { id: collectionItemId, ownerId: viewer.id },
          include: { photos: { orderBy: { position: "asc" } } },
        })
      : Promise.resolve(null),
  ]);
  if (collection?.listingId) redirect(`/sell/${collection.listingId}`);
  const catalogCardId = catalogCardParam(collection?.catalogCardId || requestedCatalogId);
  const linked = catalogCardId ? await getDexCard(catalogCardId) : null;
  const prefill = linked
    ? listingCatalogPrefill({
        id: linked.id,
        nameEn: linked.nameEn,
        nameJa: linked.nameJa,
        collectorNumber: linked.collectorNumber,
        numberKey: linked.numberKey,
        printRegion: linked.printRegion,
        rarity: linked.rarity,
        finish: linked.finish,
        listingCount: 0,
        setNameEn: linked.set.nameEn,
        setNameJa: linked.set.nameJa,
        setCode: linked.set.code,
        series: linked.set.series,
        releaseDate: linked.set.releaseDate,
        game: linked.game,
      })
    : null;
  const categoryId = prefill ? categories.find((cat) => cat.slug === prefill.categorySlug)?.id || "" : "";
  const linkedId = prefill?.catalogCardId || "";
  const initial: SellInitial | undefined = prefill
      ? {
          categoryId,
          title: "",
          description: "",
          saleType: "BUY_NOW",
          price: "",
          startPrice: "",
          auctionEndsAt: "",
          offersEnabled: false,
          minOffer: "",
          shippingDays: 3,
          shipSfCod: true,
          shipMeetup: false,
          shipPickup: false,
          meetupDistrict: "",
          meetupWindow: "",
          meetupNotes: "",
          quantity: 1,
          game: prefill.game,
          setName: prefill.setName,
          cardName: prefill.cardName,
          cardNumber: prefill.collectorNumber,
          rarity: prefill.rarity,
          language: prefill.language,
          personName: "",
          seasonYear: prefill.year,
          brandSeries: "",
          conditionTrack: "RAW",
          rawGrade: "A",
          grader: "PSA",
          gradeScore: "",
          certNumber: "",
          videoUrl: "",
          publishAt: "",
          photos: [],
          locked: false,
          catalogCardId: linkedId,
          cards: [
            {
              name: prefill.cardName,
              catalogId: linkedId,
              catalogTitle: linkedId ? prefill.catalogTitle : "",
              year: prefill.year,
              setName: prefill.setName,
              setCode: prefill.setCode,
              number: prefill.collectorNumber,
              rarity: prefill.rarity,
              language: prefill.language,
              game: prefill.game,
              price: "",
              track: "RAW",
              rawGrade: "A",
              grader: "PSA",
              gradeScore: "",
              certNumber: "",
            },
          ],
        }
      : undefined;
  const initialWithCollection = applyCollection(initial, collection);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title mb-0">{tx(prefs.locale, "上架卡牌", "List a card")}</h1>
        <a className="text-sm text-link" href="/sell/bulk">{tx(prefs.locale, "CSV 批量", "CSV upload")}</a>
      </div>
      <p className="mb-4 text-sm text-muted">
        {tx(prefs.locale, "四步就可以發布。寫", "Four steps, then publish. A ")}
        <Link className="text-link" href="/add?kind=post">{tx(prefs.locale, "貼子", "post")}</Link>
        {tx(prefs.locale, "時剔「同時上架」，會用同一張表，並帶入標題同相片。", " can tick “list it too” and opens this same form with the title and photos filled in.")}
      </p>
      <SellForm
        locale={prefs.locale}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg", slug: cat.slug }))}
        hints={sold.map((item) => ({ title: item.title, price: formatHkd(item.unitPrice, prefs.locale) }))}
        storeReady={Boolean(viewer.storeDistrict?.trim() && viewer.storeLine1?.trim())}
        storeLabel={[viewer.storeName, viewer.storeDistrict, viewer.storeLine1].filter(Boolean).join(" ")}
        initial={initialWithCollection}
        preferAuction={sp.sale === "auction"}
      />
    </div>
  );
}
