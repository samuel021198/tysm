import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCommissionBps, getPrefs, getViewer } from "@/lib/auth";
import { bpsToPercentLabel } from "@/lib/rules";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { SellForm } from "@/components/sell-form";
import { PhoneForm } from "@/components/phone-form";

export default async function SellPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/sell");
  if (!viewer.phoneVerified) return <PhoneForm locale={prefs.locale} />;
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
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title mb-0">{tx(prefs.locale, "上架卡牌", "List a card")}</h1>
        <a className="text-sm text-link" href="/sell/bulk">{tx(prefs.locale, "CSV 批量", "CSV upload")}</a>
      </div>
      <p className="mb-4 text-sm text-muted">
        {tx(prefs.locale, "想快手直購，寫", "For a quick Buy It Now, write a ")}
        <Link className="text-link" href="/add?kind=post">{tx(prefs.locale, "貼子", "post")}</Link>
        {tx(prefs.locale, "然後剔「同時上架」。呢頁係進階上架：拍賣、面交、店舖自取。", " and tick “list it too”. This page is the advanced form: auctions, meet-up, and store pickup.")}
      </p>
      <SellForm
        locale={prefs.locale}
        percent={bpsToPercentLabel(bps)}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg", slug: cat.slug }))}
        hints={sold.map((item) => ({ title: item.title, price: formatHkd(item.unitPrice, prefs.locale) }))}
        storeReady={Boolean(viewer.storeDistrict?.trim() && viewer.storeLine1?.trim())}
        storeLabel={[viewer.storeName, viewer.storeDistrict, viewer.storeLine1].filter(Boolean).join(" ")}
      />
    </div>
  );
}
