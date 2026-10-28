import { getPrefs } from "@/lib/auth";
import { DEAL_RISK } from "@/lib/deal-phase";
import { tx } from "@/lib/i18n";

export default async function TermsPage() {
  const { locale } = await getPrefs();
  const en = locale === "en";
  return (
    <article className="prose max-w-3xl space-y-3 text-sm leading-6">
      <h1 className="page-title">{tx(locale, "條款及細則", "Terms of Service")}</h1>
      <p>{en ? "These placeholder terms govern use of TSM, a Hong Kong marketplace for collectible cards. They can be replaced by counsel before launch." : "以下是 TSM 香港卡牌市集的暫用條款，正式上線前應由法律顧問替換。"}</p>
      <p>{en ? "TSM only matches people and keeps the chat record. Payment, handover, authenticity, and disputes stay with the buyer and seller." : DEAL_RISK}</p>
      <p>{en ? "Buyers and sellers arrange the handover themselves. Meet-up notes on a listing are a suggestion, not a platform charge." : "買賣雙方自行約定交收。貨品上的面交備註只係提示，唔係平台收費。"}</p>
    </article>
  );
}
