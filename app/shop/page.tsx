import { getPrefs } from "@/lib/auth";
import { tx } from "@/lib/i18n";

/** Shop tab stub. Seller profiles stay at /shop/[id]. No catalog yet. */
export default async function ShopPage() {
  const { locale } = await getPrefs();
  return (
    <div className="mx-auto grid max-w-lg gap-2">
      <h1 className="page-title">{tx(locale, "商店", "Shop")}</h1>
      <p className="text-sm text-muted">{tx(locale, "商店目錄稍後在這裡。", "The shop catalog will live here.")}</p>
    </div>
  );
}
