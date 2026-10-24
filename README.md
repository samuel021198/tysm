# TYSM

香港卡牌市集。直購、拍賣、議價、模擬付款託管。預設繁體中文（香港），可切換英文；價錢只用 HKD；時間顯示為 `Asia/Hong_Kong`。

## 本地跑起來

需要 Node.js 20+ 同 PostgreSQL。

```bash
cp .env.example .env
# 把 DATABASE_URL 改成你的 Postgres，例如：
# postgresql://tysm:tysm@127.0.0.1:5432/tysm?schema=public

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

打開 `NEXT_PUBLIC_APP_URL`（本地是 http://localhost:3000）。

`npm test` 檢查拍賣代理出價、防狙击、評級同佣金。`npm run smoke` 會在已 seed 的資料庫跑一條直購託管同拍賣出價。

## 示範登入

登入頁輸入電郵或 8 位香港電話，按索取驗證碼。**驗證碼會直接顯示在畫面上**（v1 模擬 OTP，不是正式短信）。

| 帳戶 | 登入 | 可以做 |
| --- | --- | --- |
| 買家 | `mei@tysm.hk` | 購物車有皮卡丘同美斯；已關注卡牌阿明 |
| 買家 | `alex@tysm.hk` | 多場拍賣的出價；一張示範爭議單 |
| 買家 | `yuki@tysm.hk` | 購物車有 IU 同索隆；有訊息 |
| 買家 | `ho@tysm.hk` 或 `98888888` | 購物車有沙拿同林俊傑；未驗證電話，不能上架 |
| 買家 | `oscar@tysm.hk` | 收藏同出價，購物車有卓奧特 |
| 賣家 | `91111111` 或 `ming@tysm.hk` | 卡牌阿明，已驗證電話 |
| 賣家 | `92222222` 或 `star@tysm.hk` | 星光收藏 |
| 賣家 | `94444444` 或 `ken@tysm.hk` | 旺角卡舖 |
| 賣家 | `95555555` 或 `wai@tysm.hk` | 維港球星 |
| 賣家 | `96666666` 或 `lam@tysm.hk` | 林小姐 |
| 管理員 | `admin@tysm.hk` | 佣金、分類、用戶、爭議、檢舉 |

新用戶必須勾選條款。賣家未驗證電話不能上架。

## 模擬付款同託管

結帳後到付款頁。畫面上是轉數快、PayMe 或信用卡，但仍然是模擬，不會真正扣款：

- **確認付款**：訂單進入「已託管」。賣家再標記「待寄出」→「確認寄出」（可填快遞同運單）。買家確認收貨即完成；寄出後 7 日未確認會自動完成。
- **付款未完成**：維持「待付款」。
- **這筆交易有問題**：直接進入爭議，等管理員裁定。

買家只可以在「待付款」取消。超過 24 小時未付會自動取消。拍賣得標未付款會計一次；連續 3 次會禁止出價，直至管理員在 `/admin?tab=users` 解除。

佣金由管理員設定（預設 8%），只在貨價扣除，運費全數歸賣家。已建立的訂單會記住當時的佣金。

## 拍賣同議價

- 最高出價只有出價者自己看得到，系統會代理加到領先所需的價格。
- 公開紀錄只顯示金額同匿名買家。
- 最後 **2 分鐘**內出價，結束時間會延長 **2 分鐘**。
- 沒有底價。起標價就是底價。
- 加價：HK$50 以下 $1；HK$200 以下 $5；HK$500 以下 $10；HK$1,000 以下 $20；HK$2,500 以下 $50；HK$5,000 以下 $100；之後 $200。
- 拍賣開始後（或已有出價）不能下架。有出價之後只可以改描述同加相片。
- 拍賣中途直購成功，要等付款成功才會結束拍賣並使出價作廢。未付款取消會還原拍賣。
- 議價：同一買家對同一貨品最多 3 輪，每輪 24 小時。低於賣家最低接受價會被拒絕。

直購運費按「每件刊登計一次」，不會乘數量，也不會合併運費。多個賣家會拆成多張訂單。

## 環境變數

| 變數 | 必須 | 說明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | 執行時連線。Neon Marketplace 注入的是 pooled URL。本地可與下面同一條 direct URL。 |
| `DATABASE_URL_UNPOOLED` | 是 | Prisma `directUrl`，給 migrate 用的 direct／非 pooled 網址。Neon Marketplace 會注入。本地設成同 `DATABASE_URL`。 |
| `ADMIN_EMAIL` | 是 | 首次管理員電郵。登入這個電郵會被升為管理員。可用逗號分隔多於一個。 |
| `ADMIN_PHONE` | 是 | 管理員香港電話，例如 `+85260000000`。 |
| `NEXT_PUBLIC_APP_URL` | 是 | 網站來源，**不要**結尾斜線。本地 `http://localhost:3000`，正式環境 `https://你的網域`。 |
| `SESSION_SECRET` | 正式環境必須 | 用來簽 session cookie。請換一條長隨機字串。 |
| `BOOTSTRAP_SECRET` | 重新灌示範資料或同步圖鑑時必須 | 保護 `POST /api/internal/reseed` 同 `POST /api/internal/ingest-dex`。請用另一條長隨機字串，不要同 `SESSION_SECRET` 一樣。 |
| `R2_ACCOUNT_ID` | 否 | Cloudflare R2 account id。未設定時圖鑑用 TCGdex 圖片網址，不把圖檔寫入 Postgres。 |
| `R2_ACCESS_KEY_ID` | 否 | R2 S3 access key。 |
| `R2_SECRET_ACCESS_KEY` | 否 | R2 S3 secret。 |
| `R2_BUCKET` | 否 | R2 bucket 名稱。 |
| `R2_PUBLIC_BASE_URL` | 否 | 公開讀取網址，https，不要結尾斜線。例如 `https://cards.example.com`。 |

不要提交 `.env`。

## 圖鑑

底欄第二個分頁係圖鑑（`/dex`），唔再係賣場。賣場仍然係 `/market`，卡牌頁「放售」的「睇全部放售」會去現有搜尋。

圖鑑只收寶可夢，日文同英文名、卡圖、系列同卡號。可以按卡名（中、日、英）或卡號搜。卡牌頁有「資料」同「放售」（連住現有刊登），以及「加入收藏」。v1 沒有價錢走勢或背景故事。

目錄來自免費 [TCGdex](https://tcgdex.dev/)（`https://api.tcgdex.net/v2/ja` 同 `/v2/en`），基本目錄唔使 API key。同步會走每個語言可用的實體系列：跳過 Pocket、名稱帶 promo／プロモ、`official` 係 0、或者 `total` 唔喺 1–400 的系列（`usableSetResume`）。以 2026-10 的 TCGdex 計，可用系列約英文 192 個、日文 181 個，卡牌數量級約 **3.7 萬**（英約 2.0 萬、日約 1.7 萬；個別系列有列出但沒有卡，會標記之後跳過）。日文同英文名、卡圖、系列、卡號同 finish 都寫入 `CatalogCard`。有齊 R2 變數就會把 `assets.tcgdex.net` 的圖鏡像到 bucket `dex/pokemon/`，`CatalogCard.imageUrl` 存公開網址；否則用 TCGdex 的 HTTPS 圖址。圖片二進位不會寫入 Postgres。v1 唔用 Scrydex；之後如果要加價錢先至考慮。

Vercel 這條路由 `maxDuration` 係 60 秒，單次只開幾個系列（預設 4 個，`sets` 可設 1–25），時間不夠會停喺系列中間並回 `cursor`。重複 POST 到 `done` 係 `true` 就係可用系列走完。Upsert 用 `externalId`，重複呼叫安全。已經入齊卡的系列會跳過；唔帶 cursor 再打一次，會由資料庫裡面未完成的系列繼續。

唔好並行打幾次。每次請求自己會以大約 4 路並行讀 TCGdex，遇到 429／503 會退避重試幾次。每張卡要另打一次先有英文名同 finish，所以成個目錄大概要幾十次呼叫。

```bash
npm run dex:ingest
```

本地腳本會自己循環，直到 `done`。可以加 `--sets=6`、`--cursor=ja:SV10#80`、`--lang=en` 或 `--lang=ja`。

正式環境用同一條 bearer。Body 同 query 都可以，body 優先。`#` 放 query 要寫成 `%23`。

```bash
# 一直打到 done 係 true。sets 係今次最多開幾個系列。
curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sets":4}'

# 用上次回傳的 cursor 續跑。系列中途會係 "ja:SV10#80"。
curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"cursor":"ja:SV10#80","sets":4}'

# 只補英文，或者只補日文。Cursor 要同呢次的 lang 一齊用。
curl -sS -X POST "https://你的網域/api/internal/ingest-dex?lang=en&sets=4" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET"
```

成功回 `200`：`done`、`cursor`（走完係 `null`）、`remainingSets`、`processedSetIds`、`counts`。`done: true` 表示今次語言範圍裡面的可用系列已經走完。R2 開住而且 `counts.imagesPending > 0` 時，可以再打同一條（即使 `done` 已經係 true）補鏡像；未鏡像的圖會留低 TCGdex 網址。沒有 `BOOTSTRAP_SECRET` 會回 `503`。密鑰不對會回 `401`。`sets`、`cursor` 或 `lang` 唔合法會回 `400`。`npm run db:seed` / reseed 如果圖鑑已經有卡，會把示範寶可夢刊登連去最吻合的卡。

## 部署到 Vercel + Postgres

1. 用 Vercel 上的 Neon Marketplace。它會注入 `DATABASE_URL`（pooled）同 `DATABASE_URL_UNPOOLED`（direct，主機名不要用 `-pooler`）。
2. 把這個 repo 的 `main` 匯入 Vercel。Framework 選 Next.js。
3. 在 Vercel 專案的 Environment Variables 設定上表的變數，再加上 `SESSION_SECRET`。`DATABASE_URL` 同 `DATABASE_URL_UNPOOLED` 要在 **Production、Preview、Build** 都有。
4. Deploy。Vercel 建置會跑 `prisma migrate deploy`（需要 Build 環境有 `DATABASE_URL` 同 `DATABASE_URL_UNPOOLED`）。第一次部署後灌示範資料：

```bash
npm run db:seed
```

Seed 可以只跑一次。之後的示範目錄更新用下面的 reseed。

5. Vercel Cron 每日 00:00（香港時間，`0 16 * * *`）打 `/api/cron/sweep`，用來上架預約刊登、結束拍賣、取消逾時未付款、寄出滿 7 日自動完成託管。頁面開啟時亦會做同樣的掃瞄。

## 重新灌示範資料

`POST /api/internal/reseed` 用正式環境的 `DATABASE_URL` 再跑一次 seed。所有示範列都以固定 id upsert，重複呼叫是安全的。它會把示範刊登的庫存、拍賣結束時間同出價回復到目錄；示範 id 以外的用戶同刊登不會刪除。已截標、仍待付款、而且貨品全部來自示範拍賣的訂單會清走，避免拍賣被重新打開之後仲掛住一張過期得標單。

請求要帶 `Authorization: Bearer <BOOTSTRAP_SECRET>`。沒有設定 `BOOTSTRAP_SECRET` 會回 `503`。密鑰不對會回 `401`。成功回 `200` 同各表筆數。

```bash
curl -sS -X POST "https://tysm-livid.vercel.app/api/internal/reseed" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET"
```

本地如果資料庫已經指住 `.env` 的 `DATABASE_URL`，用 `npm run db:seed` 就得，不必打呢條路由。

## 之後要接上的東西

- 真正收款（FPS / PayMe / 卡）時，換成付款 provider，但訂單狀態機可以留住。
- 相片而家接受 `https` 網址同站內 `/demo` 圖。正式上傳要接 Vercel Blob 之類的儲存，Vercel 檔案系統不能當上傳目錄。
- 電郵同 push 而家只寫入 `OutboundStub`，未有真正發送。
