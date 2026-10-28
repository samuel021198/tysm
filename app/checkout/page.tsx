import Link from "next/link";
import { getPrefs } from "@/lib/auth";
import { DEAL_RISK } from "@/lib/deal-phase";
import { tx } from "@/lib/i18n";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ buy?: string }>;
}) {
  const sp = await searchParams;
  const { locale } = await getPrefs();
  const back = sp.buy ? `/listing/${sp.buy}` : "/";
  return (
    <div className="mx-auto grid max-w-xl gap-3">
      <h1 className="page-title">{tx(locale, "交收", "Handover")}</h1>
      <p className="text-sm leading-6">{DEAL_RISK}</p>
      <p className="text-sm text-muted">{tx(locale, "平台唔代收、唔擔保。請喺貨品頁按「傾交收」。", "The platform does not take payment. Open the listing and arrange a handover.")}</p>
      <Link className="btn btn-primary w-fit" href={back}>{tx(locale, "返回貨品", "Back to the item")}</Link>
    </div>
  );
}
