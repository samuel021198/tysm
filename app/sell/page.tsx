import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCommissionBps, getPrefs, getViewer } from "@/lib/auth";
import { listingCatalogPrefill } from "@/lib/catalog-suggest";
import { bpsToPercentLabel } from "@/lib/rules";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { getDexCard } from "@/lib/dex-query";
import { SellForm, type SellInitial } from "@/components/sell-form";
import { PhoneForm } from "@/components/phone-form";

function catalogCardParam(value: string | undefined) {
  const id = (value || "").trim();
  return /^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : "";
}

export default async function SellPage({ searchParams }: { searchParams: Promise<{ catalogCardId?: string }> }) {
  const catalogCardId = catalogCardParam((await searchParams).catalogCardId);
  const nextPath = catalogCardId ? `/sell?catalogCardId=${encodeURIComponent(catalogCardId)}` : "/sell";
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!viewer.phoneVerified) return <PhoneForm locale={prefs.locale} next={catalogCardId ? nextPath : undefined} />;
  const [categories, bps, sold] = await Promise.all([
    prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } }),
    getCommissionBps(),
    prisma.orderItem.findMany({
      where: { order: { status: "COMPLETED" } },
      include: { order: { select: { completedAt: true } } },
      orderBy: { order: { completedAt: "desc" } },
      take: 3,
    }),
  ]);
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
  const linkedId = categoryId ? prefill?.catalogCardId || "" : "";
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
        percent={bpsToPercentLabel(bps)}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg", slug: cat.slug }))}
        hints={sold.map((item) => ({ title: item.title, price: formatHkd(item.unitPrice, prefs.locale) }))}
        storeReady={Boolean(viewer.storeDistrict?.trim() && viewer.storeLine1?.trim())}
        storeLabel={[viewer.storeName, viewer.storeDistrict, viewer.storeLine1].filter(Boolean).join(" ")}
        initial={initial}
      />
    </div>
  );
}
