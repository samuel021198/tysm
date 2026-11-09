import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { ListCreateForm } from "@/components/list-create-form";
import { PhoneForm } from "@/components/phone-form";

export default async function AddPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  if (sp.kind) redirect("/add");
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/add")}`);
  if (!viewer.phoneVerified) return <PhoneForm locale={prefs.locale} next="/add" />;
  const categories = await prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } });
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="page-title mb-0">{tx(prefs.locale, "上架", "List")}</h1>
        <Link href="/sell" className="text-sm text-link">{tx(prefs.locale, "進階上架", "Advanced")}</Link>
      </div>
      <ListCreateForm
        locale={prefs.locale}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn }))}
      />
    </div>
  );
}
