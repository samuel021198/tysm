import { getPrefs } from "@/lib/auth";

const qa = [
  ["點樣登入？", "How do I log in?", "輸入電郵或 8 位香港電話，畫面上會顯示 6 位驗證碼。新用戶要同意條款。", "Enter an email or 8-digit Hong Kong phone. The 6-digit code appears on screen. New accounts accept the terms."],
  ["點樣賣卡？", "How do I sell?", "必須先驗證電話。跟住逐步填；下一步未會公開，最後按「刊登」先會上架。每張刊登最少兩張相片；評級卡要有正面同背面。", "Verify your phone first. Next does not publish. Publish on the last step makes it live. Listings need at least two photos. Graded cards need front and back."],
  ["拍賣點計？", "How do auctions work?", "你輸入最高出價，系統會代理加價。最高價不公開。最後 2 分鐘有人出價會再延長 2 分鐘。沒有底價，起標價就是底價。", "Enter a maximum and the system proxy-bids. The maximum stays private. A bid in the final 2 minutes extends the end by 2 minutes. There is no reserve; the start price is the floor."],
  ["價錢點傾？", "How do we agree a price?", "喺貼文或貨品頁按勾號「傾交收」，會打開同賣家的對話，並帶上呢張貨。價錢喺聊天度傾。", "Tap the check 「傾交收」 on the post or listing. It opens the seller thread with this item. You agree the price in chat."],
  ["點送貨？", "How does shipping work?", "賣家上架時至少選一種：順豐到付（平台運費 HK$0，貨到先付順豐）、面交（要填地區），或店舖自取（用賣家帳戶的固定店舖地址）。買家只可以揀賣家開咗的方式。平台唔會逐件加運費。", "Sellers pick at least one method: SF cash on delivery (platform fee HK$0, pay SF on arrival), meet-up (a district is required), or store pickup (the shop address on the seller's profile). Buyers only see those methods. The platform does not add a fee per item."],
  ["交收點運作？", "How does a handover work?", "傾交收之後可以約定面交。賣家按確認交易，件貨先至保留。買家先上傳付款證明，賣家按已收款，買家再按已收貨。雙方都確認之後先可以評價。平台唔代收、唔擔保。", "After you start a handover you can set a meetup. The seller confirms the deal and the item is reserved. The buyer then uploads payment proof, the seller confirms payment, and the buyer confirms the item. Ratings open after both confirm. The platform does not take payment."],
  ["爭議點處理？", "How do disputes work?", "平台只提供配對同聊天紀錄；付款方式、交收、真偽同爭議由買賣雙方自行負責。", "The platform only matches people and keeps the chat. Payment, handover, authenticity, and disputes stay with the buyer and seller."],
] as const;

export default async function FaqPage() {
  const { locale } = await getPrefs();
  const en = locale === "en";
  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="page-title">FAQ</h1>
      {qa.map(([zhQ, enQ, zhA, enA]) => (
        <section key={zhQ}>
          <h2 className="font-semibold">{en ? enQ : zhQ}</h2>
          <p className="text-sm leading-6">{en ? enA : zhA}</p>
        </section>
      ))}
    </div>
  );
}
