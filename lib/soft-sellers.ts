/** Wave-1 soft-seed sellers. Seed upserts these; the Front rank row reads the same order. */
export const SOFT_SELLERS: { persona: string; handle: string; district: string; bio: string }[] = [
  { persona: "HKCardKing", handle: "hkcardking", district: "中西區", bio: "軟啟動示範。遊戲王同高達都放。" },
  { persona: "TyuDemo", handle: "tyudemo", district: "油尖旺", bio: "軟啟動示範。旺角交收，遊戲王為主。" },
  { persona: "MarsPacks", handle: "marspacks", district: "油尖旺", bio: "軟啟動示範。開包同單卡都影低先放。" },
  { persona: "KowloonBinder", handle: "kowloonbinder", district: "九龍城", bio: "軟啟動示範。九龍卡冊，黑白雙翼同高達。" },
  { persona: "CausewayPulls", handle: "causewaypulls", district: "灣仔", bio: "軟啟動示範。銅鑼灣，遊戲王同高達。" },
  { persona: "MongKokMint", handle: "mongkokmint", district: "油尖旺", bio: "軟啟動示範。旺角，魔法風雲會同 Lorcana。" },
  { persona: "ShatinSlabs", handle: "shatinslabs", district: "沙田", bio: "軟啟動示範。沙田，評級同裸卡都收。" },
  { persona: "TsuenWanTCG", handle: "tsuenwantcg", district: "荃灣", bio: "軟啟動示範。荃灣，Flesh and Blood 同數碼暴龍。" },
  { persona: "YuenLongOpens", handle: "yuenlongopens", district: "元朗", bio: "軟啟動示範。元朗開盒，魔法同黑白雙翼。" },
  { persona: "IslandBinder", handle: "islandbinder", district: "中西區", bio: "軟啟動示範。港島卡冊，Lorcana 同 FAB。" },
  { persona: "LabubuCards", handle: "labubucards", district: "油尖旺", bio: "軟啟動示範。尖沙咀，黑白雙翼同數碼暴龍。" },
  { persona: "NeonDeck", handle: "neondeck", district: "觀塘", bio: "軟啟動示範。觀塘組牌，遊戲王同 FAB。" },
];

export function softSellerId(handle: string) {
  return `user_soft_${handle}`;
}

export const SOFT_SELLER_IDS = SOFT_SELLERS.map((row) => softSellerId(row.handle));
