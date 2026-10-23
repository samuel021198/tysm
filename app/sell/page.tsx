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
      <SellForm
        locale={prefs.locale}
        percent={bpsToPercentLabel(bps)}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg" }))}
        hints={sold.map((item) => ({ title: item.title, price: formatHkd(item.unitPrice, prefs.locale) }))}
      />
    </div>
  );
}
