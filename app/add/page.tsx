import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { CollectForm } from "@/components/collect-form";

export default async function AddPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(sp.kind === "post" ? "/add?kind=post" : "/add")}`);
  const mode = sp.kind === "post" ? "post" : "collection";
  const categories = await prisma.category.findMany({ where: { level: "LEAF" }, orderBy: { sort: "asc" } });
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="page-title mb-0">{mode === "post" ? tx(prefs.locale, "貼子", "New post") : tx(prefs.locale, "加入收藏", "Add to collection")}</h1>
        {mode === "collection" ? (
          <Link href="/sell" className="text-sm text-link">{tx(prefs.locale, "進階上架", "Advanced")}</Link>
        ) : null}
      </div>
      <CollectForm
        locale={prefs.locale}
        mode={mode}
        phoneVerified={viewer.phoneVerified}
        categories={categories.map((cat) => ({ id: cat.id, nameZh: cat.nameZh, nameEn: cat.nameEn, groupKey: cat.groupKey || "tcg", slug: cat.slug }))}
      />
    </div>
  );
}
