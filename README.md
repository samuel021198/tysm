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

圖鑑收三款遊戲：**寶可夢**（日文同英文）、**海賊王 / One Piece**（日文同英文）、**Riftbound**（而家只有英文）。可以按卡名或卡號搜，打字時會出圖鑑建議，而且只限而家選的遊戲同語言。左邊一欄先揀遊戲，再開該遊戲的系列；寶可夢同海賊王仲可以篩日文／英文。卡牌頁有「價格」「資料」「背景故事」「放售」（放售連住現有刊登），以及「加入收藏」。寶可夢如果對到 SNKRDUNK，價格用日圓成交；對唔到、或者唔係寶可夢，價格頁顯示「暫未有市場數據」。背景故事用 TCGdex 的 flavor text，冇就留空。圖片用來源的 HTTPS 網址，未有 R2 鏡像（R2 仍然只會鏡像寶可夢，而且要齊環境變數先會做）。

目錄來自免費 [TCGdex](https://tcgdex.dev/)（`https://api.tcgdex.net/v2/ja` 同 `/v2/en`），基本目錄唔使 API key。同步會走每個語言可用的實體系列：跳過 Pocket、名稱帶 promo／プロモ、`official` 係 0、或者 `total` 唔喺 1–400 的系列（`usableSetResume`）。以 2026-10 的 TCGdex 計，可用系列約英文 192 個、日文 181 個，卡牌數量級約 **3.7 萬**（英約 2.0 萬、日約 1.7 萬；個別系列有列出但沒有卡，會標記之後跳過）。日文同英文名、卡圖、系列、卡號同 finish 都寫入 `CatalogCard`。有齊 R2 變數就會把 `assets.tcgdex.net` 的圖鏡像到 bucket `dex/pokemon/`，`CatalogCard.imageUrl` 存公開網址；否則用 TCGdex 的 HTTPS 圖址。圖片二進位不會寫入 Postgres。市場價唔寫入資料庫，卡牌頁即場向 SNKRDUNK 讀。

### 市場價（SNKRDUNK）

只查寶可夢。伺服器打 SNKRDUNK 自己賣場頁用緊的公開 JSON（冇 API key）：`/en/v1/search` 搵卡，`/v1/apparels/{id}/sales-chart/used` 攞走勢，`/v1/apparels/{id}/sales-history` 攞最近成交。價錢係日圓，唔會換成英鎊。每次請求之間會停一停；對到的結果喺呢個 instance 記 30 分鐘，SNKRDUNK 暫時讀唔到就記 2 分鐘，頁面仍然開到。

配對用系列代碼加卡號，再對卡名同語言。日文代碼（例如 `M6a`、`SV2a`）同 SNKRDUNK 標題入面的 `[M6a 137/103]` 對得上。英文代碼對唔上時，會再用卡名加系列名加卡號搜一次（例如 `Charizard Base Set 4` 對到 `[4/102][EN]`）。對唔到就顯示「暫未有市場數據」，資料、背景故事同放售照用。已知對唔到的情況：英文 TCGdex 代碼 `sv03.5` 唔等於 SNKRDUNK 的 `MEW`，而且系列名「151」太短，唔會靠系列名硬碰；同一卡號的 Mirror／Master Ball 如果打和就唔會硬揀一張；海賊王同 Riftbound 唔查。走勢點係 SNKRDUNK 的序列（成交密的日子會係當日一個點），唔係每一單。成交日期多數係「1 小時前」這類相對字，唔係精確時間。鑑定溢價係 PSA 10 同 A 級成交價的中位數之比，兩邊都要有成交先顯示。

Vercel 這條路由 `maxDuration` 係 300 秒（Pro）。軟性 deadline 係 240 秒，會停手先回 JSON。單次只開幾個系列（預設 4 個，`sets` 可設 1–25），時間不夠會停喺系列中間並回 `cursor`，包括今次第一個系列。重複 POST 到 `done` 係 `true` 就係可用系列走完。目錄未走完的批次唔會掃全部卡去連結刊登；走完而且仲有時間，先至 backfill 英文名同連結刊登。如果完成嗰次已經貼近 deadline、`listingsLinked` 係 0，再 POST 一次就會補連結（系列已經入齊，呢次好快入到 post-step）。Upsert 用 `externalId`，重複呼叫安全。已經入齊卡的系列會跳過；唔帶 cursor 再打一次，會由資料庫裡面未完成的系列繼續。

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

圖鑑畫面同由圖鑑帶出的刊登標題格式係 `{year} {Game} {setCode} {JP|EN} #{number} {Card Name} {Rarity}`。遊戲字係 `Pokemon`、`One Piece` 或 `Riftbound`。例子：`2023 Pokemon SV2a JP #193 Mew ex Super Rare`、`One Piece OP-01 EN #OP01-001 Roronoa Zoro L`、`2025 Riftbound OGN EN #007a Fury Rune Showcase`。年份、系列代碼、語言、卡號、卡名、罕貴有先至寫。Riftbound 只有英文，語言位會寫 `EN`。系列用資料庫入面的 set `code`，唔用系列全名。`JP` 係日文印刷，`EN` 係西方／英文。罕貴用 Title Case；空值或 `None` 就唔寫；海賊王嘅短代碼（`L`、`SR`、`SEC`）保持原樣。Finish（Holo、Reverse Foil）只留來搜尋，唔再出現喺標題。`CatalogCard` 本身冇 `title` 欄，畫面係用卡同系列欄位現計。搜尋同標題建議會同時對卡名、系列全名、系列代碼、卡號、罕貴、finish、語言同年份，而且會跟住選定的遊戲。上架時，寶可夢、海賊王、Riftbound 先會出圖鑑建議；其他分類仍然自己填。

### 海賊王同 Riftbound 點同步

同一條 `POST /api/internal/ingest-dex`，加 `game`。密鑰同寶可夢一樣，`Authorization: Bearer $BOOTSTRAP_SECRET`。`maxDuration` 仍然係 300 秒，軟性 deadline 240 秒。重複 POST，把上一次的 `cursor` 傳回去，直到 `done` 係 `true`。Upsert 用 `externalId`，重複呼叫安全。未完成的系列會再入；已經寫低 `total` 而且卡數夠的系列會跳過。目錄未走完唔會做刊登連結。

| `game` | 來源 | 語言 |
| --- | --- | --- |
| `pokemon`（預設） | [TCGdex](https://tcgdex.dev/) | `lang=en`、`ja` 或 `all` |
| `one-piece` | 英文：[OPTCG API](https://optcgapi.com/)（`/api/allSets/`、`/api/sets/{id}/`、starter、`/api/allPromos/`、`/api/allDonCards/`）。日文：官方卡表 [`onepiece-cardgame.com/cardlist/`](https://www.onepiece-cardgame.com/cardlist/)，每個系列一頁 HTML。 | `lang=en`、`ja` 或 `all`（預設英文先，再日文） |
| `riftbound` | [RiftHunt](https://rifthunt.com/api/) `GET https://api.rifthunt.com/bulk/cards` | 只有英文。`lang=ja` 會回 `400` |

OPTCG 係免費、唔使 key，但最新系列可能未有。以 2026-10-25 對照：英文約 59 組、5,479 張（PROMO 1,082、DON 187），官方日文卡表 63 個系列、5,058 張。OPTCG 未見日文先出的 EB-04、EB-05、ST-29；英文有合併商品（例如 OP15-EB04），日文則分開列。OPTCG 沒有發行日，標題多數沒有年份。日文沒有對等的 keyless JSON，所以 v1 讀官方卡表：每個系列一次請求，帶識別用的 User-Agent，系列之間會停一停。卡表 HTML 若沒有 `id="series"`，該系列會當失敗重試，唔會寫成空系列。日文卡名配對英文，用同一個卡號（`OP01-001`）；英文未入之前，日文列的英文名會暫時等於日文名，之後再 POST 一次（`done` 之後的 post-step）會補。Riftbound bulk 約 10 個系列、1,702 張印刷，一次下載再按系列分批 upsert。圖片都係來源 URL（Riftbound 多數係 Riot CDN），呢兩款唔會寫入 R2。官方日文圖帶 `Cross-Origin-Resource-Policy: same-site`，瀏覽器唔會喺 TYSM 顯示，所以畫面經 `GET /api/catalog/image` 代取，只允許 `https://www.onepiece-cardgame.com/images/cardlist/` 的圖檔。資料庫仍然存官方網址。

上架的 Riftbound 分類要靠 seed／reseed 先會出現（`cat_riftbound`）。已經上線的資料庫，部署 migration 之後打一次 reseed，或者本地 `npm run db:seed`。

```bash
npm run dex:ingest -- --game=one-piece --lang=en --sets=3
npm run dex:ingest -- --game=one-piece --lang=ja --sets=2
npm run dex:ingest -- --game=riftbound --sets=4
```

```bash
# 正式環境。一直打到 done 係 true。
curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"game":"one-piece","lang":"en","sets":3}'

curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"game":"one-piece","lang":"ja","sets":2,"cursor":"ja:550117#40"}'

curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"game":"riftbound","sets":4}'
```

`game` 唔係 `pokemon`／`one-piece`／`riftbound` 會回 `400` `invalid_game`。Cursor 格式同寶可夢一樣：`en:OP-01`、`en:PROMO#200`、`ja:550117#40`、`en:OGN#80`。`#` 放 query 要寫成 `%23`。

已經抄咗舊標題的刊登同收藏，要在部署之後回填，唔使再下載 TCGdex。只會改寫仍然等於舊公式的 `Listing.title` 同 `CollectionItem.title`，賣家自己改過的標題會留低。路由 `maxDuration` 係 300 秒，軟性 deadline 係 240 秒。重複 POST，直到 `done` 係 `true`。`cursor` 係上一批最後一張 `CatalogCard.id`。

```bash
curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"backfillTitles":true}'

curl -sS -X POST "https://你的網域/api/internal/ingest-dex" \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"backfillTitles":true,"cursor":"上一批回傳的 cursor"}'
```

成功回 `200`：`mode` 係 `backfillTitles`、`done`、`cursor`（走完係 `null`）、`scanned`、`listings`、`collectionItems`。本地可以 `npx tsx scripts/ingest-dex.ts --backfill-titles`。`backfillTitles` 唔係 true／false 會回 `400` `invalid_backfill`。回填的 `cursor` 如果唔係卡牌 id 會回 `400` `invalid_cursor`。

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
