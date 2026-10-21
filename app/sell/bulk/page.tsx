import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { CsvForm } from "@/components/csv-form";
import { PhoneForm } from "@/components/phone-form";

export default async function BulkPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/sell/bulk");
  if (!viewer.phoneVerified) return <PhoneForm locale={prefs.locale} />;
  const categories = await prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } });
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">{tx(prefs.locale, "CSV 批量上架", "CSV upload")}</h1>
      <CsvForm
        locale={prefs.locale}
        categories={categories.map((cat) => ({
          id: cat.id,
          name: prefs.locale === "en" ? cat.nameEn : cat.nameZh,
          kind: cat.groupKey || "tcg",
        }))}
      />
    </div>
  );
}
