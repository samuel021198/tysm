export type Locale = "zh-HK" | "en";

export function tx(locale: Locale, zh: string, en: string): string {
  return locale === "en" ? en : zh;
}

const ERR: Record<string, [string, string]> = {
  title: ["標題需要 2–80 字", "Title must be 2–80 characters"],
  description: ["描述最多 5000 字", "Description can be at most 5000 characters"],
  category: ["請選擇分類", "Choose a category"],
  photos: ["最少 1 張、最多 10 張相片", "Add 1 to 10 photos"],
  card_price: ["每張卡都要有價錢", "Each card needs a price"],
  preorder: ["預訂要揀今日或之後的出貨日期", "Preorder needs a ship date that is today or later"],
  ship_within: ["現貨請揀 3、7 或 30 日內出貨", "In-stock listings ship within 3, 7, or 30 days"],
  front_back: ["評級卡必須有正面同背面相片", "Graded cards need a front and a back photo"],
  photo_url: ["相片須為已上傳圖片、https，或站內示範圖", "Photos must be an upload, https, or a bundled demo image"],
  price: ["請填寫有效直購價", "Enter a valid Buy It Now price"],
  start: ["請填寫有效拍賣起標價", "Enter a valid auction start price"],
  auction_end: ["拍賣結束時間須為香港時間，並於刊登後 30 分鐘至 14 日內", "Auction end must be 30 minutes to 14 days after publish (Hong Kong time)"],
  both_price: ["直購價須高於起標價", "Buy It Now must be higher than the start price"],
  offer: ["最低接受價須大於 0 且低於直購價", "Minimum offer must be above 0 and below Buy It Now"],
  qty: ["數量須為 1–99；拍賣只可以 1 件", "Quantity must be 1–99. Auctions are quantity 1"],
  shipping: ["請至少選一種運送方式", "Choose at least one shipping method"],
  meetup: ["面交要揀香港地區，時段同備註請保持簡短", "Meet-up needs a Hong Kong district. Keep the time and note short"],
  store: ["店舖自取要用帳戶入面的固定店舖地址。請先到帳戶設定。", "Store pickup needs a shop address on your profile. Set it in your account."],
  store_unavailable: ["賣家的店舖地址暫時未能使用，請改選其他方式。", "That shop address is not available. Choose another method."],
  ship_mix: ["同一賣家的貨品沒有共同交收方式。", "These items from the same seller have no handover method in common."],
  ship_method: ["請選擇賣家有提供的運送方式", "Choose a shipping method this seller offers"],
  tcg: ["請填寫遊戲、系列、卡名同語言", "Game, set, card name, and language are required"],
  person: ["請填寫人物、賽季／年份同品牌系列", "Person, season/year, and brand/series are required"],
  grade: ["品相評級不正確", "Condition grade is invalid"],
  video: ["影片網址須為 https", "Video URL must be https"],
  schedule: ["預約時間須是未來的香港時間", "Schedule time must be in the future (Hong Kong time)"],
  forbidden: ["沒有權限", "You cannot do that"],
  phone: ["賣家必須先驗證香港電話", "Sellers need a verified Hong Kong phone"],
  banned: ["你已被禁止出價，請聯絡管理員", "Bidding is disabled on this account. Contact an admin"],
  own: ["唔可以買或出價自己的貨品", "You cannot buy or bid on your own listing"],
  unavailable: ["貨品已不可購買", "This listing is not available"],
  below_min: ["出價低於最低加價", "Bid is below the minimum increment"],
  below_start: ["出價低於起標價", "Bid is below the start price"],
  raise_max: ["最高出價必須高於你目前的最高價", "Raise your maximum above the current one"],
  ended: ["拍賣已結束", "The auction has ended"],
  locked: ["貨品暫時不能出價", "Bidding is paused on this listing"],
  rounds: ["每位買家對同一貨品最多 3 輪", "Maximum 3 rounds per buyer"],
  expired: ["已過期", "This has expired"],
  address: ["請先新增香港收貨地址", "Add a Hong Kong shipping address first"],
  stock: ["存貨不足", "Not enough quantity"],
  terms: ["請先同意條款同私隱政策", "Accept the Terms and Privacy Policy"],
  nickname: ["暱稱需要 2–24 字", "Nickname must be 2–24 characters"],
  bio: ["簡介最多 400 字", "Bio can be at most 400 characters"],
  username: ["用戶名稱要用 3–20 個小寫英文、數字或底線，並以英文字母開頭", "Username must be 3–20 characters: a letter, then letters, numbers, or _"],
  username_rate: ["30 日內最多改用戶名稱 2 次", "You can change your username twice every 30 days"],
  username_taken: ["這個用戶名稱已被使用", "That username is taken"],
  links: ["連結最多 3 個 https 網址，或地區／商場名稱", "Use up to 3 https links, or a district / mall name"],
  place: ["交收地區只可以填地區或商場，唔好填街號或門牌", "Handover area is a district or mall, not a street or door number"],
  tags: ["興趣話題最多 8 個", "Up to 8 interest tags"],
  target: ["請輸入電郵或 8 位香港電話", "Enter an email or an 8-digit Hong Kong phone"],
  code: ["驗證碼不正確或已過期", "Code is wrong or expired"],
  showcase: ["示範帳戶未建立，請先重新灌入示範資料", "Demo account is not seeded yet"],
  rate: ["請 30 秒後再索取驗證碼", "Wait 30 seconds before requesting another code"],
  taken: ["這個電話已被使用", "That phone is already in use"],
  dispute: ["而家不能開啟爭議", "A dispute cannot be opened now"],
  state: ["交收狀態不允許這個操作", "That action is not available for this handover"],
  reserved: ["此貨品已鎖定。", "This item is locked."],
  pending: ["已有一個要約，請先撤回或等對方回覆", "There is already an offer. Withdraw it or wait for a reply"],
  deal_ack: ["請先剔選私下交收風險", "Confirm the private handover risk first"],
  deal_price: ["請填最終價錢（HK$）", "Enter the final price in HK$"],
  offer_note: ["交收備註只可以一行，最多 80 字", "The handover note is one line, up to 80 characters"],
  login: ["請先登入", "Log in first"],
  blocked: ["你同對方已互相隱藏", "You and this member have blocked each other"],
  report: ["請揀一個原因", "Pick a reason"],
  review: ["而家不能評價", "A review is not available"],
  not_done: ["交收未完成，未可以評分", "You can rate after the handover is done"],
  once: ["已經評過分", "You already rated this handover"],
  stars: ["請揀 1 至 5 星", "Pick 1 to 5 stars"],
  rating_comment: ["評語只可以一行，最多 80 字", "The note is one line, up to 80 characters"],
  csv: ["CSV 有錯誤，整批都未匯入", "The CSV has errors. Nothing was imported"],
  empty: ["沒有可匯入的資料列", "The CSV has no data rows"],
  post: ["寫幾隻字或者加一張相", "Add a few words or a photo"],
  story_photo: ["請先影相或由相簿揀一張相", "Take a photo or choose one from your album"],
  comment: ["留言要 1–300 字，或加相／GIF", "Comment needs 1–300 characters, or a photo or GIF"],
  payfail: ["平台唔會代收款。", "The platform does not take payment."],
  verify_track: ["請揀誠信或商戶", "Choose trusted or merchant"],
  verify_reason: ["原因要 1–200 字", "Reason must be 1–200 characters"],
  verify_photo: ["請上傳 JPG 或 PNG 文件", "Upload a JPG or PNG document"],
  verify_store: ["文件暫時上傳唔到，請稍後再試。", "Could not store the document. Try again shortly."],
  verify_pending: ["審核中，暫時唔使再交", "Already in review"],
};

export function errText(locale: Locale, code: string): string {
  const row = ERR[code];
  if (!row) return code;
  return locale === "en" ? row[1] : row[0];
}

export function navLabels(locale: Locale) {
  const en = locale === "en";
  return {
    search: en ? "Market" : "賣場",
    dex: en ? "Dex" : "圖鑑",
    news: en ? "News" : "新聞",
    rank: en ? "Rank" : "排行",
    sell: en ? "Add" : "新增",
    cart: en ? "Cart" : "購物車",
    orders: en ? "Handovers" : "交收",
    messages: en ? "Chat" : "聊天",
    login: en ? "Log in" : "登入",
    logout: en ? "Log out" : "登出",
    admin: en ? "Admin" : "管理",
    profile: en ? "Profile" : "個人",
    favorites: en ? "Favorites" : "收藏",
    bids: en ? "Bids" : "出價",
    notifications: en ? "Notifications" : "通知",
    feed: en ? "Feed" : "動態",
  };
}

export function offerStatusLabel(locale: Locale, status: string): string {
  const zh: Record<string, string> = {
    PENDING: "待賣家回覆",
    COUNTERED: "賣家已還價",
    ACCEPTED: "已接受",
    DECLINED: "已拒絕",
    EXPIRED: "已過期",
    CANCELLED: "已取消",
  };
  const en: Record<string, string> = {
    PENDING: "Waiting on seller",
    COUNTERED: "Seller countered",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
  };
  return (locale === "en" ? en : zh)[status] ?? status;
}

export function orderStatusLabel(locale: Locale, status: string): string {
  const zh: Record<string, string> = {
    PENDING_PAYMENT: "要約中",
    IN_ESCROW: "待交收",
    AWAITING_SHIP: "待交收",
    SHIPPED: "待交收",
    COMPLETED: "已完成",
    DISPUTED: "已取消",
    CANCELLED: "已取消",
    REFUNDED: "已取消",
  };
  const en: Record<string, string> = {
    PENDING_PAYMENT: "Offer",
    IN_ESCROW: "To hand over",
    AWAITING_SHIP: "To hand over",
    SHIPPED: "To hand over",
    COMPLETED: "Completed",
    DISPUTED: "Cancelled",
    CANCELLED: "Cancelled",
    REFUNDED: "Cancelled",
  };
  return (locale === "en" ? en : zh)[status] ?? status;
}

export function listingStatusLabel(locale: Locale, status: string): string {
  const zh: Record<string, string> = {
    DRAFT: "草稿",
    SCHEDULED: "已排程",
    ACTIVE: "刊登中",
    UNLISTED: "已下架",
    ENDED: "已結束",
    SOLD: "已售出",
  };
  const en: Record<string, string> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    ACTIVE: "Active",
    UNLISTED: "Unlisted",
    ENDED: "Ended",
    SOLD: "Sold",
  };
  return (locale === "en" ? en : zh)[status] ?? status;
}
