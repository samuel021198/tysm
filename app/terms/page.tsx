import { getPrefs } from "@/lib/auth";
import { tx } from "@/lib/i18n";

export default async function TermsPage() {
  const { locale } = await getPrefs();
  const en = locale === "en";
  return (
    <article className="prose max-w-3xl space-y-3 text-sm leading-6">
      <h1 className="page-title">{tx(locale, "條款及細則", "Terms of Service")}</h1>
      <p>{en ? "These placeholder terms govern use of TSM, a Hong Kong marketplace for collectible cards. They can be replaced by counsel before launch." : "以下是 TSM 香港卡牌市集的暫用條款，正式上線前應由法律顧問替換。"}</p>
      <p>{en ? "TSM provides a venue and escrow record. Sellers ship items themselves. TSM does not authenticate cards in v1." : "TSM 提供交易場所同託管紀錄。賣家自行寄貨。v1 不會代為鑑定卡牌。"}</p>
      <p>{en ? "Buyers pay the listed price. Platform shipping is HK$0: SF cash on delivery is paid to SF Express on arrival, and meet-up or store pickup has no platform fee. Commission is deducted from the seller's item proceeds, not added to the buyer." : "買家支付貨價。平台運費為 HK$0：順豐到付由買家收貨時向順豐支付；面交同店舖自取沒有平台運費。佣金從賣家貨款扣除，不會加在買家身上。"}</p>
      <p>{en ? "Auction winners must pay within 24 hours. Three consecutive unpaid wins can disable bidding until an admin restores it." : "拍賣得標須於 24 小時內付款。連續三次未付款可被禁止出價，直至管理員恢復。"}</p>
      <p>{en ? "Payments in this version are simulated. Do not send real money through the mock checkout." : "這一版付款是模擬的。請勿經模擬結帳支付真實款項。"}</p>
    </article>
  );
}
