import { resolveAuction } from "../lib/rules";

const hk = (dollars: number) => Math.round(dollars * 100);

type SellerShip = {
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
  meetupDistrict: string | null;
  meetupWindow: string | null;
  meetupNotes: string | null;
};

const SELLER_SHIP: Record<string, SellerShip> = {
  user_ming: { shipSfCod: true, shipMeetup: true, shipPickup: false, meetupDistrict: "油尖旺", meetupWindow: "週末 14:00–18:00", meetupNotes: "旺角站附近，請先傳訊息。" },
  user_ken: { shipSfCod: true, shipMeetup: false, shipPickup: true, meetupDistrict: null, meetupWindow: null, meetupNotes: null },
  user_star: { shipSfCod: false, shipMeetup: true, shipPickup: false, meetupDistrict: "灣仔", meetupWindow: "平日晚上", meetupNotes: "銅鑼灣站，先約時間。" },
  user_wai: { shipSfCod: true, shipMeetup: true, shipPickup: false, meetupDistrict: "中西區", meetupWindow: null, meetupNotes: "中環站附近。" },
  user_lam: { shipSfCod: true, shipMeetup: true, shipPickup: false, meetupDistrict: "沙田", meetupWindow: "週日下午", meetupNotes: null },
};

function sellerShip(sellerId: string): SellerShip {
  return SELLER_SHIP[sellerId] ?? { shipSfCod: true, shipMeetup: false, shipPickup: false, meetupDistrict: null, meetupWindow: null, meetupNotes: null };
}

type GradeName = "PSA" | "BGS" | "CGC" | "TAG";
type RawName = "A" | "B" | "C" | "D";

type BidInput = { bidderId: string; max: number; at: string };

type CardInput = {
  id: string;
  sellerId: string;
  categoryId: string;
  zh: string;
  en: string;
  line: string;
  title?: string;
  notes?: string[];
  status?: "ACTIVE" | "SOLD";
  saleType?: "BUY_NOW" | "AUCTION" | "BOTH";
  price?: number;
  start?: number;
  hours?: number;
  offerMin?: number;
  qty?: number;
  ship?: number;
  days?: number;
  kind: "TCG" | "ATHLETE" | "CELEBRITY";
  game?: string;
  setName?: string;
  language?: string;
  season?: string;
  brand?: string;
  raw?: RawName;
  grader?: GradeName;
  score?: number;
  cert?: string;
  views?: number;
  number?: string;
  rarity?: string;
  locker?: number;
  meet?: number;
  bids?: BidInput[];
};

export type DemoListing = {
  id: string;
  sellerId: string;
  categoryId: string;
  status: "ACTIVE" | "SOLD";
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  title: string;
  description: string;
  zh: string;
  en: string;
  line: string;
  quantity: number;
  quantityAvailable: number;
  shippingFee: number;
  shippingDays: number;
  shipLockerFee: number;
  shipMeetFee: number;
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
  meetupDistrict: string | null;
  meetupWindow: string | null;
  meetupNotes: string | null;
  cardNumber: string;
  rarity: string;
  price: number | null;
  offersEnabled: boolean;
  minOffer: number | null;
  startPrice: number | null;
  auctionHours: number | null;
  cardKind: "TCG" | "ATHLETE" | "CELEBRITY";
  game: string | null;
  setName: string | null;
  cardName: string | null;
  language: string | null;
  personName: string | null;
  seasonYear: string | null;
  brandSeries: string | null;
  conditionTrack: "RAW" | "GRADED";
  rawGrade: RawName | null;
  grader: GradeName | null;
  gradeValue: number | null;
  certNumber: string | null;
  viewCount: number;
  photos: { id: string; url: string; role: "FRONT" | "BACK"; position: number }[];
  bids: { id: string; bidderId: string; maxAmount: number; at: string }[];
};

function gradeValue(grader: GradeName, score: number): number {
  const doubled = Math.round(score * 2);
  if (Math.abs(doubled - score * 2) > 1e-6) throw new Error(`${grader} score ${score} is not a half step`);
  if (grader === "PSA") {
    if (!Number.isInteger(score) || score < 1 || score > 10) throw new Error(`PSA ${score}`);
  } else if (grader === "BGS") {
    if (score < 1 || score > 10.5) throw new Error(`BGS ${score}`);
  } else if (score < 1 || score > 10) throw new Error(`${grader} ${score}`);
  return doubled * 5;
}

function card(input: CardInput): DemoListing {
  const status = input.status ?? "ACTIVE";
  const saleType = input.saleType ?? "BUY_NOW";
  const quantity = input.qty ?? 1;
  if ((input.raw == null) === (input.grader == null)) throw new Error(`${input.id} needs one condition`);
  if (input.grader && input.score == null) throw new Error(`${input.id} needs a score`);
  if (input.kind === "TCG" && (!input.game || !input.language)) throw new Error(`${input.id} needs game and language`);
  if (input.kind !== "TCG" && !input.season) throw new Error(`${input.id} needs a season`);
  if (saleType !== "AUCTION" && input.price == null) throw new Error(`${input.id} needs a price`);
  if (saleType !== "BUY_NOW" && (input.start == null || input.hours == null || input.hours <= 0)) {
    throw new Error(`${input.id} needs a live auction`);
  }
  if (saleType === "AUCTION" && input.offerMin != null) throw new Error(`${input.id} auction cannot take offers`);
  if (input.offerMin != null && (input.price == null || input.offerMin >= input.price)) {
    throw new Error(`${input.id} min offer must be below the price`);
  }
  const bids = input.bids ?? [];
  if (status === "ACTIVE" && saleType !== "BUY_NOW" && bids.length < 2) throw new Error(`${input.id} needs bids`);
  if (bids.some((bid) => bid.bidderId === input.sellerId)) throw new Error(`${input.id} seller is bidding`);
  if (new Set(bids.map((bid) => bid.bidderId)).size !== bids.length) throw new Error(`${input.id} duplicate bidder`);
  const startPrice = input.start != null ? hk(input.start) : null;
  const pricedBids = bids.map((bid, index) => ({
    id: `${input.id}_proxy_${bid.bidderId}`,
    bidderId: bid.bidderId,
    maxAmount: hk(bid.max),
    at: bid.at,
  }));
  if (startPrice != null && pricedBids.some((bid) => bid.maxAmount < startPrice)) {
    throw new Error(`${input.id} bid is below the start`);
  }
  if (pricedBids.length) {
    const resolved = resolveAuction(
      startPrice ?? 0,
      pricedBids.map((bid) => ({ bidderId: bid.bidderId, maxAmount: bid.maxAmount, updatedAt: new Date(bid.at) })),
    );
    if (!resolved.leaderId || resolved.price < (startPrice ?? 0)) throw new Error(`${input.id} auction did not resolve`);
    const leaderMax = pricedBids.find((bid) => bid.bidderId === resolved.leaderId)?.maxAmount ?? 0;
    if (resolved.price > leaderMax) throw new Error(`${input.id} public bid exceeds the leader max`);
    if (input.price != null && saleType === "BOTH" && resolved.price >= hk(input.price)) {
      throw new Error(`${input.id} bid has reached Buy Now`);
    }
  }
  const value = input.grader && input.score != null ? gradeValue(input.grader, input.score) : null;
  const title = input.title ?? `${input.zh} ${input.en}`;
  const description = [`**${input.zh} ${input.en}**`, input.line, ...(input.notes ?? []).map((note) => `- ${note}`)].join("\n");
  let serial = 0;
  for (const char of input.id) serial = (serial + char.charCodeAt(0) * 17) % 186;
  const cardNumber = input.number ?? (input.kind === "TCG" ? `${String(serial + 1).padStart(3, "0")}/185` : `No.${serial + 1}`);
  const rarity = input.rarity ?? (input.grader ? "GEM" : input.kind === "TCG" ? "RR" : "BASE");
  return {
    id: input.id,
    sellerId: input.sellerId,
    categoryId: input.categoryId,
    status,
    saleType,
    title,
    description,
    zh: input.zh,
    en: input.en,
    line: input.line,
    quantity,
    quantityAvailable: status === "SOLD" ? 0 : quantity,
    // Prepaid SF / locker / meetup amounts on the card input are retired. Platform fee is HK$0.
    shippingFee: 0,
    shippingDays: input.days ?? 3,
    shipLockerFee: 0,
    shipMeetFee: 0,
    ...sellerShip(input.sellerId),
    cardNumber,
    rarity,
    price: input.price != null ? hk(input.price) : null,
    offersEnabled: input.offerMin != null,
    minOffer: input.offerMin != null ? hk(input.offerMin) : null,
    startPrice,
    auctionHours: input.hours ?? null,
    cardKind: input.kind,
    game: input.game ?? null,
    setName: input.setName ?? null,
    cardName: input.kind === "TCG" ? input.zh : null,
    language: input.language ?? null,
    personName: input.kind === "TCG" ? null : input.zh,
    seasonYear: input.season ?? null,
    brandSeries: input.brand ?? null,
    conditionTrack: input.raw ? "RAW" : "GRADED",
    rawGrade: input.raw ?? null,
    grader: input.grader ?? null,
    gradeValue: value,
    certNumber: input.cert ?? null,
    viewCount: input.views ?? 24,
    photos: [
      { id: `${input.id}_front`, url: `/demo/cards/${input.id}.svg`, role: "FRONT", position: 0 },
      { id: `${input.id}_back`, url: `/demo/cards/${input.id}-back.svg`, role: "BACK", position: 1 },
    ],
    bids: pricedBids,
  };
}

const tcg = "TCG" as const;
const athlete = "ATHLETE" as const;
const celeb = "CELEBRITY" as const;
const auction = "AUCTION" as const;
const both = "BOTH" as const;

const A = "user_alex";
const M = "user_mei";
const Y = "user_yuki";
const H = "user_ho";
const O = "user_oscar";

const t0 = "2026-10-20T02:00:00Z";
const t1 = "2026-10-20T08:00:00Z";
const t2 = "2026-10-21T03:00:00Z";

export const demoListings: DemoListing[] = [
  card({
    id: "seed_charizard", sellerId: "user_ming", categoryId: "cat_pokemon",
    zh: "噴火龍", en: "Charizard", line: "VMAX · 仰天峰 · 日文",
    title: "噴火龍 VMAX Charizard", price: 1280, offerMin: 1000, qty: 2, ship: 20,
    number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A", views: 128,
    notes: ["卡面乾淨，四角尖", "兩張庫存，接受議價"],
  }),
  card({
    id: "seed_pikachu", sellerId: "user_ming", categoryId: "cat_pokemon",
    zh: "皮卡丘", en: "Pikachu", line: "25th Anniversary · PSA 10",
    title: "皮卡丘 Pikachu PSA 10", price: 880, ship: 15, days: 2,
    kind: tcg, game: "Pokémon", setName: "25th Anniversary", language: "日文",
    grader: "PSA", score: 10, cert: "88412031", views: 96,
    notes: ["居中靚，表面無花"],
  }),
  card({
    id: "seed_psyduck", sellerId: "user_ming", categoryId: "cat_pokemon",
    zh: "可達鴨", en: "Psyduck", line: "Base · 英文",
    title: "可達鴨 Psyduck", price: 180, ship: 12,
    kind: tcg, game: "Pokémon", setName: "Base", language: "英文", raw: "A", views: 34,
    notes: ["英文原盒拆出", "適合入門收藏"],
  }),
  card({
    id: "seed_mewtwo", sellerId: "user_ken", categoryId: "cat_pokemon",
    zh: "超夢", en: "Mewtwo", line: "傳說交鋒 · BGS 9.5",
    saleType: auction, start: 800, hours: 14, ship: 25,
    kind: tcg, game: "Pokémon", setName: "傳說交鋒", language: "日文",
    grader: "BGS", score: 9.5, cert: "001584221", views: 74,
    bids: [{ bidderId: M, max: 1200, at: t0 }, { bidderId: A, max: 2000, at: t1 }],
    notes: ["金標副分齊", "拍賣進行中"],
  }),
  card({
    id: "seed_gengar", sellerId: "user_ken", categoryId: "cat_pokemon",
    zh: "耿鬼", en: "Gengar", line: "無印 · Raw B",
    price: 260, offerMin: 180, ship: 18,
    kind: tcg, game: "Pokémon", setName: "無印", language: "日文", raw: "B", views: 41,
    notes: ["卡角有少少白", "可以議價"],
  }),
  card({
    id: "seed_umbreon", sellerId: "user_ming", categoryId: "cat_pokemon",
    zh: "月亮伊布", en: "Umbreon", line: "漆黑高斯 · Raw C",
    saleType: both, price: 980, start: 200, hours: 8, ship: 20,
    kind: tcg, game: "Pokémon", setName: "漆黑高斯", language: "日文", raw: "C", views: 63,
    bids: [{ bidderId: Y, max: 350, at: t0 }, { bidderId: H, max: 600, at: t2 }],
    notes: ["直購或者繼續拍", "背面有一條幼花"],
  }),
  card({
    id: "seed_lugia", sellerId: "user_ken", categoryId: "cat_pokemon",
    zh: "洛奇亞", en: "Lugia", line: "Neo Genesis · CGC 10",
    price: 2460, ship: 30, days: 2,
    kind: tcg, game: "Pokémon", setName: "Neo Genesis", language: "英文",
    grader: "CGC", score: 10, cert: "440218819", views: 110,
    notes: ["完美分", "英文老卡"],
  }),
  card({
    id: "seed_rayquaza", sellerId: "user_ken", categoryId: "cat_pokemon",
    zh: "烈空坐", en: "Rayquaza", line: "蒼空烈流 · Raw A",
    saleType: auction, start: 600, hours: 30, ship: 22,
    kind: tcg, game: "Pokémon", setName: "蒼空烈流", language: "日文", raw: "A", views: 58,
    bids: [{ bidderId: O, max: 900, at: t0 }, { bidderId: M, max: 1600, at: t1 }],
    notes: ["全日文", "卡面新淨"],
  }),
  card({
    id: "seed_eevee", sellerId: "user_lam", categoryId: "cat_pokemon",
    zh: "伊布", en: "Eevee", line: "151 · Raw D",
    price: 80, ship: 10, days: 4, qty: 3,
    kind: tcg, game: "Pokémon", setName: "151", language: "繁中", raw: "D", views: 19,
    notes: ["玩過，有白邊", "平價入門"],
  }),
  card({
    id: "seed_sold_zard", sellerId: "user_ming", categoryId: "cat_pokemon",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · 已售",
    title: "噴火龍 已售示範 Charizard", status: "SOLD", price: 3000, ship: 20,
    number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A", views: 240,
    notes: ["用來展示站內成交價"],
  }),

  card({
    id: "seed_luffy", sellerId: "user_ming", categoryId: "cat_onepiece",
    zh: "路飛", en: "Luffy", line: "Romance Dawn · BGS 9.5",
    title: "路飛 Luffy 漫畫背景",
    saleType: auction, start: 500, hours: 36, ship: 25,
    kind: tcg, game: "One Piece", setName: "Romance Dawn", language: "日文",
    grader: "BGS", score: 9.5, cert: "001602118", views: 150,
    bids: [{ bidderId: A, max: 800, at: "2026-10-01T00:00:00Z" }, { bidderId: M, max: 1200, at: "2026-10-01T01:00:00Z" }],
    notes: ["漫畫背景領袖卡", "代理出價示範"],
  }),
  card({
    id: "seed_nami", sellerId: "user_star", categoryId: "cat_onepiece",
    zh: "娜美", en: "Nami", line: "OP-01 · Raw B",
    saleType: both, price: 2200, start: 300, hours: 2, ship: 20, days: 4,
    kind: tcg, game: "One Piece", setName: "OP-01", language: "日文", raw: "B", views: 88,
    bids: [{ bidderId: O, max: 450, at: t0 }, { bidderId: A, max: 700, at: t2 }],
    notes: ["就快截標", "亦可以直購"],
  }),
  card({
    id: "seed_zoro", sellerId: "user_ken", categoryId: "cat_onepiece",
    zh: "索隆", en: "Zoro", line: "OP-06 · PSA 10",
    price: 1880, offerMin: 1400, ship: 25, number: "118/106", rarity: "SEC",
    kind: tcg, game: "One Piece", setName: "OP-06", language: "日文",
    grader: "PSA", score: 10, cert: "91220018", views: 77,
    notes: ["三刀流 SEC", "接受議價"],
  }),
  card({
    id: "seed_ace", sellerId: "user_ken", categoryId: "cat_onepiece",
    zh: "艾斯", en: "Ace", line: "頂上決戰 · Raw A",
    saleType: auction, start: 400, hours: 18, ship: 20,
    kind: tcg, game: "One Piece", setName: "頂上決戰", language: "日文", raw: "A", views: 46,
    bids: [{ bidderId: H, max: 700, at: t0 }, { bidderId: Y, max: 1100, at: t1 }],
    notes: ["火拳", "卡面乾淨"],
  }),
  card({
    id: "seed_shanks", sellerId: "user_ming", categoryId: "cat_onepiece",
    zh: "香克斯", en: "Shanks", line: "OP-09 · TAG 9",
    price: 760, ship: 18,
    kind: tcg, game: "One Piece", setName: "OP-09", language: "日文",
    grader: "TAG", score: 9, cert: "TAG-22091", views: 52,
    notes: ["紅髮", "TAG 殼"],
  }),
  card({
    id: "seed_law", sellerId: "user_star", categoryId: "cat_onepiece",
    zh: "羅", en: "Law", line: "OP-05 · Raw C",
    title: "羅 Law", price: 240, offerMin: 160, ship: 16,
    kind: tcg, game: "One Piece", setName: "OP-05", language: "日文", raw: "C", views: 29,
    notes: ["有輕微白邊", "歡迎議價"],
  }),
  card({
    id: "seed_boa", sellerId: "user_lam", categoryId: "cat_onepiece",
    zh: "漢考克", en: "Boa Hancock", line: "OP-07 · CGC 9.5",
    saleType: auction, start: 500, hours: 10, ship: 22,
    kind: tcg, game: "One Piece", setName: "OP-07", language: "日文",
    grader: "CGC", score: 9.5, cert: "448100221", views: 69,
    bids: [{ bidderId: M, max: 800, at: t0 }, { bidderId: O, max: 1400, at: t2 }],
    notes: ["女帝", "評級殼"],
  }),
  card({
    id: "seed_sanji", sellerId: "user_wai", categoryId: "cat_onepiece",
    zh: "山治", en: "Sanji", line: "OP-02 · Raw D",
    price: 90, ship: 12, days: 5, qty: 2,
    kind: tcg, game: "One Piece", setName: "OP-02", language: "日文", raw: "D", views: 14,
    notes: ["玩卡，角圓", "平放"],
  }),

  card({
    id: "seed_messi", sellerId: "user_star", categoryId: "cat_football",
    zh: "美斯", en: "Messi", line: "Topps · 2022 · Raw C",
    price: 640, ship: 18, days: 5,
    kind: athlete, season: "2022", brand: "Topps", raw: "C", views: 80,
    notes: ["球衣卡", "卡角有白"],
  }),
  card({
    id: "seed_ronaldo", sellerId: "user_wai", categoryId: "cat_football",
    zh: "朗拿度", en: "Ronaldo", line: "Panini Prizm · PSA 9",
    saleType: auction, start: 1500, hours: 20, ship: 28,
    kind: athlete, season: "2018", brand: "Panini", grader: "PSA", score: 9, cert: "61882004", views: 132,
    bids: [{ bidderId: A, max: 2200, at: t0 }, { bidderId: M, max: 3600, at: t1 }],
    notes: ["C 朗簽名年份卡", "拍賣中"],
  }),
  card({
    id: "seed_haaland", sellerId: "user_wai", categoryId: "cat_football",
    zh: "哈蘭德", en: "Haaland", line: "Topps Chrome · BGS 9.5",
    price: 2100, offerMin: 1600, ship: 24,
    kind: athlete, season: "2023", brand: "Topps", grader: "BGS", score: 9.5, cert: "001711902", views: 91,
    notes: ["新秀亮面", "可以議價"],
  }),
  card({
    id: "seed_mbappe", sellerId: "user_wai", categoryId: "cat_football",
    zh: "麥巴比", en: "Mbappe", line: "Panini · 2024 · Raw A",
    saleType: both, price: 1680, start: 400, hours: 6, ship: 22,
    kind: athlete, season: "2024", brand: "Panini", raw: "A", views: 70,
    bids: [{ bidderId: Y, max: 650, at: t0 }, { bidderId: O, max: 1000, at: t2 }],
    notes: ["直購價仍然高過現價"],
  }),
  card({
    id: "seed_son", sellerId: "user_ming", categoryId: "cat_football",
    zh: "孫興慜", en: "Son", line: "Topps · 2021 · Raw B",
    price: 420, ship: 16,
    kind: athlete, season: "2021", brand: "Topps", raw: "B", views: 37,
    notes: ["熱刺主場"],
  }),
  card({
    id: "seed_yamal", sellerId: "user_ken", categoryId: "cat_football",
    zh: "耶馬爾", en: "Yamal", line: "Topps Now · Raw D",
    saleType: auction, start: 150, hours: 1.5, ship: 15,
    kind: athlete, season: "2024", brand: "Topps", raw: "D", views: 44,
    bids: [{ bidderId: H, max: 220, at: t0 }, { bidderId: A, max: 380, at: t2 }],
    notes: ["就快完", "卡況一般"],
  }),
  card({
    id: "seed_salah", sellerId: "user_wai", categoryId: "cat_football",
    zh: "沙拿", en: "Salah", line: "Panini Select · CGC 10",
    price: 980, ship: 20,
    kind: athlete, season: "2022", brand: "Panini", grader: "CGC", score: 10, cert: "450228100", views: 48,
    notes: ["利物浦"],
  }),

  card({
    id: "seed_curry", sellerId: "user_star", categoryId: "cat_basketball",
    zh: "居里", en: "Stephen Curry", line: "Panini · 2021 · PSA 9",
    saleType: auction, start: 1500, hours: 48, ship: 30, days: 4,
    kind: athlete, season: "2021", brand: "Panini", grader: "PSA", score: 9, cert: "57221009", views: 160,
    bids: [
      { bidderId: M, max: 1800, at: t0 },
      { bidderId: O, max: 2400, at: t1 },
      { bidderId: Y, max: 3200, at: t2 },
    ],
    notes: ["簽名卡", "三人出價中"],
  }),
  card({
    id: "seed_lebron", sellerId: "user_wai", categoryId: "cat_basketball",
    zh: "勒邦占士", en: "LeBron James", line: "Upper Deck · BGS 10",
    price: 5600, offerMin: 4200, ship: 35, days: 4,
    kind: athlete, season: "2013", brand: "Upper Deck", grader: "BGS", score: 10, cert: "001220045", views: 140,
    notes: ["黑邊乾淨", "高價可以傾"],
  }),
  card({
    id: "seed_jokic", sellerId: "user_wai", categoryId: "cat_basketball",
    zh: "約基奇", en: "Jokic", line: "Prizm · 2022 · Raw A",
    price: 720, ship: 18,
    kind: athlete, season: "2022", brand: "Panini", raw: "A", views: 39,
    notes: ["金塊"],
  }),
  card({
    id: "seed_luka", sellerId: "user_ken", categoryId: "cat_basketball",
    zh: "東契奇", en: "Luka Doncic", line: "Optic · PSA 8",
    saleType: auction, start: 900, hours: 22, ship: 24,
    kind: athlete, season: "2019", brand: "Panini", grader: "PSA", score: 8, cert: "44129008", views: 66,
    bids: [{ bidderId: A, max: 1400, at: t0 }, { bidderId: H, max: 2100, at: t1 }],
    notes: ["新秀年", "PSA 8"],
  }),
  card({
    id: "seed_wemby", sellerId: "user_star", categoryId: "cat_basketball",
    zh: "雲班耶馬", en: "Wembanyama", line: "Prizm · 2024 · Raw B",
    saleType: both, price: 2100, start: 350, hours: 5, ship: 22,
    kind: athlete, season: "2024", brand: "Panini", raw: "B", views: 102,
    bids: [{ bidderId: Y, max: 500, at: t0 }, { bidderId: M, max: 900, at: t2 }],
    notes: ["新秀", "直購仍然開住"],
  }),
  card({
    id: "seed_jordan", sellerId: "user_wai", categoryId: "cat_basketball",
    zh: "米高佐敦", en: "Michael Jordan", line: "Fleer · TAG 10",
    price: 8800, ship: 40, days: 5,
    kind: athlete, season: "1986", brand: "Fleer", grader: "TAG", score: 10, cert: "TAG-10086", views: 210,
    notes: ["示範高價評級", "只限直購"],
  }),
  card({
    id: "seed_sga", sellerId: "user_ming", categoryId: "cat_basketball",
    zh: "基爾吉斯", en: "SGA", line: "Select · 2023 · Raw C",
    price: 310, offerMin: 220, ship: 16,
    kind: athlete, season: "2023", brand: "Panini", raw: "C", views: 22,
    notes: ["雷霆", "可以議價"],
  }),

  card({
    id: "seed_ohtani", sellerId: "user_ming", categoryId: "cat_baseball",
    zh: "大谷翔平", en: "Shohei Ohtani", line: "Bowman · 2018 · Raw A",
    price: 420, offerMin: 300, ship: 22,
    kind: athlete, season: "2018", brand: "Bowman", raw: "A", views: 84,
    notes: ["新秀卡", "接受議價"],
  }),
  card({
    id: "seed_judge", sellerId: "user_wai", categoryId: "cat_baseball",
    zh: "賈吉", en: "Aaron Judge", line: "Topps Chrome · PSA 10",
    saleType: auction, start: 1100, hours: 26, ship: 28,
    kind: athlete, season: "2017", brand: "Topps", grader: "PSA", score: 10, cert: "77821010", views: 97,
    bids: [{ bidderId: O, max: 1600, at: t0 }, { bidderId: A, max: 2500, at: t1 }],
    notes: ["洋基新秀", "證書可查"],
  }),
  card({
    id: "seed_soto", sellerId: "user_wai", categoryId: "cat_baseball",
    zh: "蘇圖", en: "Juan Soto", line: "Bowman · BGS 8.5",
    price: 640, ship: 20,
    kind: athlete, season: "2018", brand: "Bowman", grader: "BGS", score: 8.5, cert: "001498812", views: 33,
    notes: ["副分有高低"],
  }),
  card({
    id: "seed_trout", sellerId: "user_ken", categoryId: "cat_baseball",
    zh: "卓奧特", en: "Mike Trout", line: "Topps Update · Raw B",
    price: 380, offerMin: 250, ship: 18,
    kind: athlete, season: "2011", brand: "Topps", raw: "B", views: 40,
    notes: ["經典新秀", "可以議價"],
  }),
  card({
    id: "seed_yamamoto", sellerId: "user_ming", categoryId: "cat_baseball",
    zh: "山本由伸", en: "Yamamoto", line: "Topps · 2024 · Raw A",
    saleType: auction, start: 280, hours: 12, ship: 18,
    kind: athlete, season: "2024", brand: "Topps", raw: "A", views: 55,
    bids: [{ bidderId: H, max: 400, at: t0 }, { bidderId: Y, max: 720, at: t2 }],
    notes: ["道奇年份"],
  }),
  card({
    id: "seed_betts", sellerId: "user_wai", categoryId: "cat_baseball",
    zh: "貝茲", en: "Mookie Betts", line: "Topps · CGC 8.5",
    price: 290, ship: 16,
    kind: athlete, season: "2016", brand: "Topps", grader: "CGC", score: 8.5, cert: "439100285", views: 21,
    notes: ["紅襪年"],
  }),
  card({
    id: "seed_ohtani_auto", sellerId: "user_star", categoryId: "cat_baseball",
    zh: "大谷翔平", en: "Ohtani Auto", line: "Topps Chrome · TAG 8.5",
    title: "大谷翔平 簽名 Ohtani Auto",
    saleType: both, price: 3200, start: 600, hours: 9, ship: 30,
    kind: athlete, season: "2024", brand: "Topps", grader: "TAG", score: 8.5, cert: "TAG-80845", views: 118,
    bids: [{ bidderId: M, max: 900, at: t0 }, { bidderId: H, max: 1500, at: t1 }],
    notes: ["簽名位清楚", "直購價 HK$3,200"],
  }),

  card({
    id: "seed_iu", sellerId: "user_star", categoryId: "cat_singers",
    zh: "李知恩", en: "IU", line: "官方小卡 · 2024 · CGC 9.5",
    title: "IU 小卡 李知恩", price: 990, ship: 12, days: 2,
    kind: celeb, season: "2024", brand: "官方小卡", grader: "CGC", score: 9.5, cert: "451992450", views: 76,
    notes: ["專輯特典"],
  }),
  card({
    id: "seed_jay", sellerId: "user_ming", categoryId: "cat_singers",
    zh: "周杰倫", en: "Jay Chou", line: "魔天倫 · 2023 · Raw B",
    price: 360, ship: 10, days: 2,
    kind: celeb, season: "2023", brand: "魔天倫", raw: "B", views: 64,
    notes: ["演唱會紀念"],
  }),
  card({
    id: "seed_eason", sellerId: "user_lam", categoryId: "cat_singers",
    zh: "陳奕迅", en: "Eason Chan", line: "LIFE · PSA 10",
    saleType: auction, start: 700, hours: 16, ship: 12,
    kind: celeb, season: "2023", brand: "官方小卡", grader: "PSA", score: 10, cert: "88001123", views: 90,
    bids: [{ bidderId: O, max: 1000, at: t0 }, { bidderId: Y, max: 1800, at: t1 }],
    notes: ["演唱會場刊小卡"],
  }),
  card({
    id: "seed_jj", sellerId: "user_lam", categoryId: "cat_singers",
    zh: "林俊傑", en: "JJ Lin", line: "JJ20 · Raw A",
    price: 540, offerMin: 400, ship: 12,
    kind: celeb, season: "2024", brand: "官方小卡", raw: "A", views: 42,
    notes: ["接受議價"],
  }),
  card({
    id: "seed_taylor", sellerId: "user_star", categoryId: "cat_singers",
    zh: "泰勒絲", en: "Taylor Swift", line: "Eras · BGS 9",
    price: 1280, ship: 20,
    kind: celeb, season: "2024", brand: "官方小卡", grader: "BGS", score: 9, cert: "001880091", views: 101,
    notes: ["巡演特典"],
  }),
  card({
    id: "seed_jacky", sellerId: "user_wai", categoryId: "cat_singers",
    zh: "張學友", en: "Jacky Cheung", line: "60+ · Raw C",
    saleType: auction, start: 200, hours: 4, ship: 12,
    kind: celeb, season: "2023", brand: "演唱會", raw: "C", views: 28,
    bids: [{ bidderId: A, max: 300, at: t0 }, { bidderId: M, max: 480, at: t2 }],
    notes: ["歌神巡演"],
  }),
  card({
    id: "seed_adele", sellerId: "user_star", categoryId: "cat_singers",
    zh: "阿黛爾", en: "Adele", line: "30 · Raw D",
    price: 150, ship: 14,
    kind: celeb, season: "2022", brand: "官方小卡", raw: "D", views: 12,
    notes: ["有摺痕", "平放"],
  }),

  card({
    id: "seed_chow", sellerId: "user_lam", categoryId: "cat_actors",
    zh: "周潤發", en: "Chow Yun-fat", line: "英雄本色 · Raw A",
    price: 680, offerMin: 500, ship: 15,
    kind: celeb, season: "1986", brand: "電影紀念", raw: "A", views: 57,
    notes: ["經典港產", "可以議價"],
  }),
  card({
    id: "seed_leung", sellerId: "user_lam", categoryId: "cat_actors",
    zh: "梁朝偉", en: "Tony Leung", line: "花樣年華 · PSA 9",
    saleType: auction, start: 450, hours: 28, ship: 15,
    kind: celeb, season: "2000", brand: "電影紀念", grader: "PSA", score: 9, cert: "66012009", views: 73,
    bids: [{ bidderId: H, max: 700, at: t0 }, { bidderId: O, max: 1200, at: t1 }],
    notes: ["文藝片收藏"],
  }),
  card({
    id: "seed_donnie", sellerId: "user_ken", categoryId: "cat_actors",
    zh: "甄子丹", en: "Donnie Yen", line: "葉問 · BGS 9.5",
    price: 860, ship: 16,
    kind: celeb, season: "2008", brand: "電影紀念", grader: "BGS", score: 9.5, cert: "001772145", views: 49,
    notes: ["詠春"],
  }),
  card({
    id: "seed_andy", sellerId: "user_star", categoryId: "cat_actors",
    zh: "劉德華", en: "Andy Lau", line: "無間道 · Raw B",
    saleType: both, price: 1500, start: 250, hours: 7, ship: 16,
    kind: celeb, season: "2002", brand: "電影紀念", raw: "B", views: 68,
    bids: [{ bidderId: Y, max: 400, at: t0 }, { bidderId: A, max: 650, at: t2 }],
    notes: ["直購或拍賣"],
  }),
  card({
    id: "seed_maggie", sellerId: "user_lam", categoryId: "cat_actors",
    zh: "張曼玉", en: "Maggie Cheung", line: "阮玲玉 · CGC 9",
    price: 740, ship: 15,
    kind: celeb, season: "1991", brand: "電影紀念", grader: "CGC", score: 9, cert: "442100319", views: 36,
    notes: ["金像獎年份"],
  }),
  card({
    id: "seed_shuqi", sellerId: "user_star", categoryId: "cat_actors",
    zh: "舒淇", en: "Shu Qi", line: "千禧 · Raw C",
    saleType: auction, start: 180, hours: 11, ship: 14,
    kind: celeb, season: "2000", brand: "雜誌卡", raw: "C", views: 25,
    bids: [{ bidderId: M, max: 260, at: t0 }, { bidderId: H, max: 420, at: t1 }],
    notes: ["早期雜誌卡"],
  }),
  card({
    id: "seed_takeshi", sellerId: "user_ming", categoryId: "cat_actors",
    zh: "金城武", en: "Takeshi Kaneshiro", line: "重慶森林 · TAG 9",
    price: 610, ship: 15,
    kind: celeb, season: "1994", brand: "電影紀念", grader: "TAG", score: 9, cert: "TAG-19940", views: 61,
    notes: ["王家衛"],
  }),

  card({
    id: "seed_keung", sellerId: "user_star", categoryId: "cat_idols",
    zh: "姜濤", en: "Keung To", line: "MIRROR · TAG 9",
    price: 520, ship: 8, days: 2,
    kind: celeb, season: "2024", brand: "MIRROR", grader: "TAG", score: 9, cert: "TAG-90901", views: 120,
    notes: ["偶像卡"],
  }),
  card({
    id: "seed_anson", sellerId: "user_lam", categoryId: "cat_idols",
    zh: "盧瀚霆", en: "Anson Lo", line: "MIRROR · Raw A",
    saleType: auction, start: 320, hours: 15, ship: 8,
    kind: celeb, season: "2024", brand: "MIRROR", raw: "A", views: 99,
    bids: [{ bidderId: O, max: 500, at: t0 }, { bidderId: M, max: 880, at: t1 }],
    notes: ["親簽位沒有", "卡況新"],
  }),
  card({
    id: "seed_ian", sellerId: "user_lam", categoryId: "cat_idols",
    zh: "陳卓賢", en: "Ian Chan", line: "MIRROR · PSA 9",
    price: 890, offerMin: 650, ship: 8,
    kind: celeb, season: "2024", brand: "MIRROR", grader: "PSA", score: 9, cert: "70024519", views: 83,
    notes: ["可以議價"],
  }),
  card({
    id: "seed_gigi", sellerId: "user_star", categoryId: "cat_idols",
    zh: "炎明熹", en: "Gigi Yim", line: "聲夢 · Raw B",
    price: 260, ship: 8, days: 2,
    kind: celeb, season: "2023", brand: "聲夢", raw: "B", views: 31,
    notes: ["官方小卡"],
  }),
  card({
    id: "seed_jennie", sellerId: "user_star", categoryId: "cat_idols",
    zh: "珍妮", en: "Jennie", line: "BLACKPINK · CGC 9.5",
    saleType: auction, start: 800, hours: 3, ship: 18,
    kind: celeb, season: "2024", brand: "官方小卡", grader: "CGC", score: 9.5, cert: "460882195", views: 111,
    bids: [{ bidderId: Y, max: 1200, at: t0 }, { bidderId: A, max: 2000, at: t2 }],
    notes: ["幾小時內截標"],
  }),
  card({
    id: "seed_minji", sellerId: "user_lam", categoryId: "cat_idols",
    zh: "敏智", en: "Minji", line: "NewJeans · Raw D",
    saleType: both, price: 680, offerMin: 480, start: 120, hours: 40, ship: 16,
    kind: celeb, season: "2023", brand: "官方小卡", raw: "D", views: 27,
    bids: [{ bidderId: H, max: 180, at: t0 }, { bidderId: O, max: 300, at: t1 }],
    notes: ["有少少彎", "直購、拍賣、議價都可以"],
  }),
  card({
    id: "seed_edan", sellerId: "user_lam", categoryId: "cat_idols",
    zh: "呂爵安", en: "Edan Lui", line: "MIRROR · Raw C",
    price: 180, ship: 8,
    kind: celeb, season: "2024", brand: "MIRROR", raw: "C", views: 23,
    notes: ["白邊明顯"],
  }),

  card({
    id: "seed_sold_zard_b", sellerId: "user_ken", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · Raw A", title: "噴火龍 已售 Raw A Charizard",
    price: 2680, ship: 20, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A",
    notes: ["站內成交，同一品相"],
  }),
  card({
    id: "seed_sold_zard_c", sellerId: "user_star", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · Raw A", title: "噴火龍 已售 Charizard Raw A",
    price: 2450, ship: 18, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A",
    notes: ["站內成交"],
  }),
  card({
    id: "seed_sold_zard_d", sellerId: "user_wai", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · Raw A", title: "噴火龍 VMAX 已售 Charizard",
    price: 3120, ship: 22, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A",
    notes: ["站內成交"],
  }),
  card({
    id: "seed_sold_zard_e", sellerId: "user_lam", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · Raw A", title: "噴火龍 成交 Charizard",
    price: 2890, ship: 20, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", raw: "A",
    notes: ["站內成交"],
  }),
  card({
    id: "seed_sold_zard_psa10", sellerId: "user_ken", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · PSA 10", title: "噴火龍 PSA 10 已售 Charizard",
    price: 8800, ship: 30, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", grader: "PSA", score: 10, cert: "80112001",
    notes: ["其他品相成交"],
  }),
  card({
    id: "seed_sold_zard_psa9", sellerId: "user_ming", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · PSA 9", title: "噴火龍 PSA 9 已售 Charizard",
    price: 4200, ship: 25, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", grader: "PSA", score: 9, cert: "80112009",
    notes: ["其他品相成交"],
  }),
  card({
    id: "seed_sold_zard_bgs", sellerId: "user_star", categoryId: "cat_pokemon", status: "SOLD",
    zh: "噴火龍", en: "Charizard", line: "仰天峰 · BGS 9.5", title: "噴火龍 BGS 9.5 已售 Charizard",
    price: 6100, ship: 28, number: "020/189", rarity: "SR",
    kind: tcg, game: "Pokémon", setName: "仰天峰", language: "日文", grader: "BGS", score: 9.5, cert: "00199821",
    notes: ["其他品相成交"],
  }),
  card({
    id: "seed_sold_zoro_a", sellerId: "user_ming", categoryId: "cat_onepiece", status: "SOLD",
    zh: "索隆", en: "Zoro", line: "OP-06 · PSA 10", title: "索隆 PSA 10 已售 Zoro",
    price: 2100, ship: 20, number: "118/106", rarity: "SEC",
    kind: tcg, game: "One Piece", setName: "OP-06", language: "日文", grader: "PSA", score: 10, cert: "91220091",
  }),
  card({
    id: "seed_sold_zoro_b", sellerId: "user_lam", categoryId: "cat_onepiece", status: "SOLD",
    zh: "索隆", en: "Zoro", line: "OP-06 · PSA 10", title: "索隆 SEC 已售 Zoro",
    price: 1960, ship: 18, number: "118/106", rarity: "SEC",
    kind: tcg, game: "One Piece", setName: "OP-06", language: "日文", grader: "PSA", score: 10, cert: "91220092",
  }),
  card({
    id: "seed_sold_zoro_c", sellerId: "user_wai", categoryId: "cat_onepiece", status: "SOLD",
    zh: "索隆", en: "Zoro", line: "OP-06 · PSA 10", title: "索隆 三刀流已售 Zoro",
    price: 1760, ship: 20, number: "118/106", rarity: "SEC",
    kind: tcg, game: "One Piece", setName: "OP-06", language: "日文", grader: "PSA", score: 10, cert: "91220093",
  }),
  card({
    id: "seed_sold_luffy_a", sellerId: "user_ken", categoryId: "cat_onepiece", status: "SOLD",
    zh: "路飛", en: "Luffy", line: "Romance Dawn · BGS 9.5", title: "路飛 BGS 9.5 已售 Luffy",
    price: 1500, ship: 25,
    kind: tcg, game: "One Piece", setName: "Romance Dawn", language: "日文", grader: "BGS", score: 9.5, cert: "001602201",
  }),
  card({
    id: "seed_sold_luffy_b", sellerId: "user_star", categoryId: "cat_onepiece", status: "SOLD",
    zh: "路飛", en: "Luffy", line: "Romance Dawn · BGS 9.5", title: "路飛 漫畫背景已售 Luffy",
    price: 1680, ship: 22,
    kind: tcg, game: "One Piece", setName: "Romance Dawn", language: "日文", grader: "BGS", score: 9.5, cert: "001602202",
  }),
  card({
    id: "seed_sold_luffy_c", sellerId: "user_wai", categoryId: "cat_onepiece", status: "SOLD",
    zh: "路飛", en: "Luffy", line: "Romance Dawn · BGS 9.5", title: "路飛 領袖卡已售 Luffy",
    price: 1420, ship: 20,
    kind: tcg, game: "One Piece", setName: "Romance Dawn", language: "日文", grader: "BGS", score: 9.5, cert: "001602203",
  }),
];

export const demoUsers = [
  { id: "user_admin", emailKey: "admin" as const, phoneKey: "admin" as const, nickname: "TYSM 管理員", role: "ADMIN" as const, phoneVerified: true, bio: "平台管理員。" },
  { id: "user_ming", email: "ming@tysm.hk", phone: "+85291111111", nickname: "卡牌阿明", role: "USER" as const, phoneVerified: true, bio: "香港卡牌賣家，主攻寶可夢同運動卡。" },
  { id: "user_star", email: "star@tysm.hk", phone: "+85292222222", nickname: "星光收藏", role: "USER" as const, phoneVerified: true, bio: "明星小卡同評級卡。" },
  { id: "user_mei", email: "mei@tysm.hk", phone: "+85293333333", nickname: "陳小美", role: "USER" as const, phoneVerified: true, bio: "收藏寶可夢同女團小卡。" },
  { id: "user_alex", email: "alex@tysm.hk", phone: null, nickname: "Alex", role: "USER" as const, phoneVerified: false, bio: "拍賣玩家，鍾意出價。" },
  { id: "user_ken", email: "ken@tysm.hk", phone: "+85294444444", nickname: "旺角卡舖", role: "USER" as const, phoneVerified: true, bio: "旺角實體店，主攻 TCG 評級卡。" },
  { id: "user_wai", email: "wai@tysm.hk", phone: "+85295555555", nickname: "維港球星", role: "USER" as const, phoneVerified: true, bio: "足球、籃球、棒球簽名卡。" },
  { id: "user_lam", email: "lam@tysm.hk", phone: "+85296666666", nickname: "林小姐", role: "USER" as const, phoneVerified: true, bio: "偶像同歌手小卡，接受議價。" },
  { id: "user_yuki", email: "yuki@tysm.hk", phone: "+85297777777", nickname: "Yuki", role: "USER" as const, phoneVerified: true, bio: "買家，追海賊王同 IU。" },
  { id: "user_ho", email: "ho@tysm.hk", phone: "+85298888888", nickname: "何生", role: "USER" as const, phoneVerified: false, bio: "週末收藏家，鍾意足球同拍賣。" },
  { id: "user_oscar", email: "oscar@tysm.hk", phone: null, nickname: "Oscar", role: "USER" as const, phoneVerified: false, bio: "專攻 PSA 同 BGS。" },
];

export const demoStores = [
  { userId: "user_ken", storeName: "旺角卡舖", storeDistrict: "油尖旺", storeLine1: "西洋菜南街 12 號 2 樓", storeHours: "每日 13:00–21:00" },
];

export const demoAddresses = [
  { id: "addr_mei", userId: "user_mei", recipient: "陳小美", phone: "+85293333333", line1: "軒尼詩道 1 號", district: "灣仔" },
  { id: "addr_ming", userId: "user_ming", recipient: "卡牌阿明", phone: "+85291111111", line1: "彌敦道 88 號", district: "油尖旺" },
  { id: "addr_alex", userId: "user_alex", recipient: "Alex Chan", phone: "+85293333333", line1: "英皇道 200 號", district: "東區" },
  { id: "addr_star", userId: "user_star", recipient: "星光收藏", phone: "+85292222222", line1: "廣東道 50 號", district: "油尖旺" },
  { id: "addr_ken", userId: "user_ken", recipient: "旺角卡舖", phone: "+85294444444", line1: "西洋菜南街 12 號", district: "油尖旺" },
  { id: "addr_wai", userId: "user_wai", recipient: "維港球星", phone: "+85295555555", line1: "德輔道中 18 號", district: "中西區" },
  { id: "addr_lam", userId: "user_lam", recipient: "林小姐", phone: "+85296666666", line1: "沙田正街 9 號", district: "沙田" },
  { id: "addr_yuki", userId: "user_yuki", recipient: "Yuki Lee", phone: "+85297777777", line1: "清水灣道 77 號", district: "西貢" },
  { id: "addr_ho", userId: "user_ho", recipient: "何生", phone: "+85298888888", line1: "青山公路 300 號", district: "屯門" },
  { id: "addr_oscar", userId: "user_oscar", recipient: "Oscar Ng", phone: "+85290000000", line1: "銀城路 4 號", district: "離島" },
];

export const demoOffers = [
  { id: "seed_offer_alex", listingId: "seed_charizard", buyerId: A, status: "PENDING" as const, round: 1, amount: hk(1100), counterAmount: null, hours: 20 },
  { id: "seed_offer_yuki_ohtani", listingId: "seed_ohtani", buyerId: Y, status: "PENDING" as const, round: 1, amount: hk(360), counterAmount: null, hours: 18 },
  { id: "seed_offer_ho_gengar", listingId: "seed_gengar", buyerId: H, status: "COUNTERED" as const, round: 2, amount: hk(200), counterAmount: hk(230), hours: 12 },
  { id: "seed_offer_oscar_haaland", listingId: "seed_haaland", buyerId: O, status: "PENDING" as const, round: 1, amount: hk(1800), counterAmount: null, hours: 22 },
  { id: "seed_offer_mei_trout", listingId: "seed_trout", buyerId: M, status: "PENDING" as const, round: 1, amount: hk(300), counterAmount: null, hours: 16 },
  { id: "seed_offer_alex_law", listingId: "seed_law", buyerId: A, status: "DECLINED" as const, round: 1, amount: hk(150), counterAmount: null, hours: -5 },
  { id: "seed_offer_yuki_jj", listingId: "seed_jj", buyerId: Y, status: "PENDING" as const, round: 1, amount: hk(460), counterAmount: null, hours: 15 },
  { id: "seed_offer_ho_chow", listingId: "seed_chow", buyerId: H, status: "PENDING" as const, round: 1, amount: hk(560), counterAmount: null, hours: 19 },
];

export const demoThreads = [
  { id: "seed_thread_mei", listingId: "seed_charizard", buyerId: "user_mei", sellerId: "user_ming" },
  { id: "seed_thread_yuki", listingId: "seed_messi", buyerId: "user_yuki", sellerId: "user_star" },
  { id: "seed_thread_ho", listingId: "seed_mewtwo", buyerId: "user_ho", sellerId: "user_ken" },
  { id: "seed_thread_oscar", listingId: "seed_judge", buyerId: "user_oscar", sellerId: "user_wai" },
  { id: "seed_thread_alex", listingId: "seed_curry", buyerId: "user_alex", sellerId: "user_star" },
];

export const demoMessages = [
  { id: "seed_msg_1", threadId: "seed_thread_mei", senderId: "user_mei", body: "請問噴火龍可以看多啲卡角嗎？", read: true },
  { id: "seed_msg_2", threadId: "seed_thread_mei", senderId: "user_ming", body: "可以，相片有正面同背面，四角都尖。", read: false },
  { id: "seed_msg_yuki_1", threadId: "seed_thread_yuki", senderId: "user_yuki", body: "美斯呢張卡角有冇白邊？", read: true },
  { id: "seed_msg_yuki_2", threadId: "seed_thread_yuki", senderId: "user_star", body: "有少少，所以先標 Raw C，相片有特寫。", read: false },
  { id: "seed_msg_ho_1", threadId: "seed_thread_ho", senderId: "user_ho", body: "超夢拍賣可唔可以順豐到屯門？", read: true },
  { id: "seed_msg_ho_2", threadId: "seed_thread_ho", senderId: "user_ken", body: "可以，運費已包順豐站。", read: false },
  { id: "seed_msg_oscar_1", threadId: "seed_thread_oscar", senderId: "user_oscar", body: "PSA 10 證書號碼方便核對嗎？", read: true },
  { id: "seed_msg_oscar_2", threadId: "seed_thread_oscar", senderId: "user_wai", body: "有，刊登頁面有 cert，可以上 PSA 查。", read: false },
  { id: "seed_msg_alex_1", threadId: "seed_thread_alex", senderId: "user_alex", body: "居里我出緊價，完場前會唔會延長？", read: true },
  { id: "seed_msg_alex_2", threadId: "seed_thread_alex", senderId: "user_star", body: "最後兩分鐘有出價會延長兩分鐘。", read: false },
];

export const demoNotifications = [
  { id: "seed_note_mei", userId: "user_mei", type: "message", title: "新訊息", body: "卡牌阿明回覆了你。", href: "/messages/seed_thread_mei", read: false },
  { id: "seed_note_ming_offer", userId: "user_ming", type: "offer", title: "收到新議價", body: "Alex 對噴火龍 VMAX 出價。", href: "/listing/seed_charizard", read: false },
  { id: "seed_note_star_bid", userId: "user_star", type: "bid", title: "拍賣有新出價", body: "居里簽名卡有人加價。", href: "/listing/seed_curry", read: false },
  { id: "seed_note_yuki", userId: "user_yuki", type: "message", title: "新訊息", body: "星光收藏回覆了美斯卡。", href: "/messages/seed_thread_yuki", read: true },
  { id: "seed_note_ken", userId: "user_ken", type: "message", title: "新訊息", body: "何生問超夢點寄。", href: "/messages/seed_thread_ho", read: false },
  { id: "seed_note_ho", userId: "user_ho", type: "bid", title: "你已被超價", body: "耶馬爾拍賣你而家唔領先。", href: "/listing/seed_yamal", read: false },
  { id: "seed_note_oscar", userId: "user_oscar", type: "message", title: "新訊息", body: "維港球星回覆了證書問題。", href: "/messages/seed_thread_oscar", read: false },
  { id: "seed_note_wai", userId: "user_wai", type: "order", title: "拍賣有人領先", body: "賈吉 PSA 10 仲有人出價。", href: "/listing/seed_judge", read: true },
  { id: "seed_note_alex", userId: "user_alex", type: "order", title: "爭議處理中", body: "周杰倫示範單仲等管理員。", href: "/orders/seed_order_dispute", read: false },
  { id: "seed_note_lam", userId: "user_lam", type: "offer", title: "收到新議價", body: "何生對周潤發出價。", href: "/listing/seed_chow", read: false },
];

export const demoFavorites = [
  { id: "seed_fav_mei_zard", userId: "user_mei", listingId: "seed_charizard" },
  { id: "seed_fav_mei_luffy", userId: "user_mei", listingId: "seed_luffy" },
  { id: "seed_fav_mei_iu", userId: "user_mei", listingId: "seed_iu" },
  { id: "seed_fav_yuki_nami", userId: "user_yuki", listingId: "seed_nami" },
  { id: "seed_fav_yuki_jennie", userId: "user_yuki", listingId: "seed_jennie" },
  { id: "seed_fav_yuki_boa", userId: "user_yuki", listingId: "seed_boa" },
  { id: "seed_fav_ho_messi", userId: "user_ho", listingId: "seed_messi" },
  { id: "seed_fav_ho_ronaldo", userId: "user_ho", listingId: "seed_ronaldo" },
  { id: "seed_fav_oscar_pika", userId: "user_oscar", listingId: "seed_pikachu" },
  { id: "seed_fav_oscar_judge", userId: "user_oscar", listingId: "seed_judge" },
  { id: "seed_fav_alex_curry", userId: "user_alex", listingId: "seed_curry" },
  { id: "seed_fav_lam_jay", userId: "user_lam", listingId: "seed_jay" },
];

export const demoCart = [
  { id: "seed_cart_mei_pika", userId: "user_mei", listingId: "seed_pikachu", quantity: 1 },
  { id: "seed_cart_mei_messi", userId: "user_mei", listingId: "seed_messi", quantity: 1 },
  { id: "seed_cart_yuki_iu", userId: "user_yuki", listingId: "seed_iu", quantity: 1 },
  { id: "seed_cart_yuki_zoro", userId: "user_yuki", listingId: "seed_zoro", quantity: 1 },
  { id: "seed_cart_ho_salah", userId: "user_ho", listingId: "seed_salah", quantity: 1 },
  { id: "seed_cart_ho_jj", userId: "user_ho", listingId: "seed_jj", quantity: 1 },
  { id: "seed_cart_oscar_trout", userId: "user_oscar", listingId: "seed_trout", quantity: 1 },
  { id: "seed_cart_alex_ohtani", userId: "user_alex", listingId: "seed_ohtani", quantity: 1 },
];

export const demoFollows = [
  { id: "seed_follow_mei_ming", followerId: "user_mei", sellerId: "user_ming" },
  { id: "seed_follow_mei_star", followerId: "user_mei", sellerId: "user_star" },
  { id: "seed_follow_yuki_star", followerId: "user_yuki", sellerId: "user_star" },
  { id: "seed_follow_yuki_lam", followerId: "user_yuki", sellerId: "user_lam" },
  { id: "seed_follow_ho_wai", followerId: "user_ho", sellerId: "user_wai" },
  { id: "seed_follow_ho_ken", followerId: "user_ho", sellerId: "user_ken" },
  { id: "seed_follow_oscar_ken", followerId: "user_oscar", sellerId: "user_ken" },
  { id: "seed_follow_oscar_wai", followerId: "user_oscar", sellerId: "user_wai" },
  { id: "seed_follow_alex_ming", followerId: "user_alex", sellerId: "user_ming" },
  { id: "seed_follow_alex_star", followerId: "user_alex", sellerId: "user_star" },
];

export const demoViews = [
  { id: "seed_view_mei_zard", userId: "user_mei", listingId: "seed_charizard" },
  { id: "seed_view_mei_luffy", userId: "user_mei", listingId: "seed_luffy" },
  { id: "seed_view_mei_iu", userId: "user_mei", listingId: "seed_iu" },
  { id: "seed_view_yuki_nami", userId: "user_yuki", listingId: "seed_nami" },
  { id: "seed_view_yuki_jennie", userId: "user_yuki", listingId: "seed_jennie" },
  { id: "seed_view_oscar_pika", userId: "user_oscar", listingId: "seed_pikachu" },
  { id: "seed_view_oscar_judge", userId: "user_oscar", listingId: "seed_judge" },
  { id: "seed_view_ho_messi", userId: "user_ho", listingId: "seed_messi" },
];

export const demoSearches = [
  { id: "seed_search_mei", userId: "user_mei", query: "噴火龍" },
  { id: "seed_search_yuki", userId: "user_yuki", query: "Luffy" },
  { id: "seed_search_oscar", userId: "user_oscar", query: "PSA" },
  { id: "seed_search_ho", userId: "user_ho", query: "美斯" },
];

export const LEAF_CATEGORIES = [
  ["cat_pokemon", "pokemon", "寶可夢", "Pokémon", "tcg", "cat_tcg", 1],
  ["cat_onepiece", "one-piece", "海賊王", "One Piece", "tcg", "cat_tcg", 2],
  ["cat_football", "football", "足球", "Football", "athlete", "cat_athletes", 1],
  ["cat_basketball", "basketball", "籃球", "Basketball", "athlete", "cat_athletes", 2],
  ["cat_baseball", "baseball", "棒球", "Baseball", "athlete", "cat_athletes", 3],
  ["cat_singers", "singers", "歌手", "Singers", "celebrity", "cat_celebrities", 1],
  ["cat_actors", "actors", "演員", "Actors", "celebrity", "cat_celebrities", 2],
  ["cat_idols", "idols", "偶像", "Idols", "celebrity", "cat_celebrities", 3],
] as const;

/// Sell-step lines. Not part of LEAF_CATEGORIES, so demo seed does not need seven listings each.
export const EXTRA_CARD_CATEGORIES = [
  ["cat_topps_soccer", "topps-soccer", "Topps 足球", "Topps Soccer", "athlete", "cat_athletes", 4],
  ["cat_topps_basketball", "topps-basketball", "Topps 籃球", "Topps Basketball", "athlete", "cat_athletes", 5],
  ["cat_topps_baseball", "topps-baseball", "Topps 棒球", "Topps Baseball", "athlete", "cat_athletes", 6],
  ["cat_panini_soccer", "panini-soccer", "Panini 足球", "Panini Soccer", "athlete", "cat_athletes", 7],
  ["cat_riftbound", "riftbound", "Riftbound", "Riftbound", "tcg", "cat_tcg", 8],
] as const;
