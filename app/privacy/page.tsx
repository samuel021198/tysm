import { getPrefs } from "@/lib/auth";
import { tx } from "@/lib/i18n";

export default async function PrivacyPage() {
  const { locale } = await getPrefs();
  const en = locale === "en";
  return (
    <article className="max-w-3xl space-y-3 text-sm leading-6">
      <h1 className="text-2xl font-semibold">{tx(locale, "私隱政策", "Privacy Policy")}</h1>
      <p>{en ? "TYSM stores your nickname, email or phone, delivery addresses, shop address, payout details, messages, and order history so the marketplace can function." : "TYSM 會儲存暱稱、電郵或電話、收貨地址、店舖地址、收款資料、訊息同訂單，以便市集運作。"}</p>
      <p>{en ? "Bid maximums are shown only to the bidder. Public bid history uses an anonymous label." : "最高出價只顯示給出價者。公開出價紀錄使用匿名標籤。"}</p>
      <p>{en ? "v1 does not offer self-serve deletion or export. Contact the admin address in your account settings." : "v1 未有自助刪除或匯出。請用帳戶頁的管理員電郵聯絡我們。"}</p>
      <p>{en ? "OTP codes in this demo are displayed on screen and are not a production authentication system." : "示範環境的驗證碼會顯示在畫面上，並不是正式的登入系統。"}</p>
    </article>
  );
}
