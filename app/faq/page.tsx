import { getPrefs } from "@/lib/auth";

const qa = [
  ["點樣登入？", "How do I log in?", "輸入電郵或 8 位香港電話，畫面上會顯示 6 位驗證碼。新用戶要同意條款。", "Enter an email or 8-digit Hong Kong phone. The 6-digit code appears on screen. New accounts accept the terms."],
  ["點樣賣卡？", "How do I sell?", "必須先驗證電話。跟住逐步填；下一步未會公開，最後按「刊登」先會上架。每張刊登最少兩張相片；評級卡要有正面同背面。", "Verify your phone first. Next does not publish. Publish on the last step makes it live. Listings need at least two photos. Graded cards need front and back."],
  ["拍賣點計？", "How do auctions work?", "你輸入最高出價，系統會代理加價。最高價不公開。最後 2 分鐘有人出價會再延長 2 分鐘。沒有底價，起標價就是底價。", "Enter a maximum and the system proxy-bids. The maximum stays private. A bid in the final 2 minutes extends the end by 2 minutes. There is no reserve; the start price is the floor."],
  ["議價有幾多輪？", "How many offer rounds?", "同一買家對同一貨品最多 3 次出價。每次 24 小時內要回覆。低於賣家最低價會被拒絕。", "Three buyer rounds per listing. Each step expires in 24 hours. Offers under the seller minimum are rejected."],
  ["點送貨？", "How does shipping work?", "賣家上架時至少選一種：順豐到付（平台運費 HK$0，貨到先付順豐）、面交（要填地區），或店舖自取（用賣家帳戶的固定店舖地址）。買家只可以揀賣家開咗的方式。平台唔會逐件加運費。", "Sellers pick at least one method: SF cash on delivery (platform fee HK$0, pay SF on arrival), meet-up (a district is required), or store pickup (the shop address on the seller's profile). Buyers only see those methods. The platform does not add a fee per item."],
  ["託管點運作？", "How does escrow work?", "模擬付款成功後：已託管 → 待寄出 → 已寄出。買家確認，或寄出後 7 日自動完成。佣金從賣家貨款扣除。", "After a successful mock payment: escrow, awaiting shipment, shipped. The buyer confirms, or escrow auto-releases 7 days after shipping. Commission comes out of the seller's item price."],
  ["爭議點處理？", "How do disputes work?", "買家可開啟爭議，管理員裁定。輸的一方可以上訴一次。買家勝訴時，賣家要付退回運費。", "Buyers can open a dispute and an admin decides. The losing side may appeal once. If the buyer wins, the seller pays return shipping."],
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
