import { DEMO_ACCOUNTS } from "../lib/demo-login";
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

const portrait = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&h=800&q=80`;

export const demoUsers = [
  { id: "user_admin", emailKey: "admin" as const, phoneKey: "admin" as const, nickname: "TSM 管理員", role: "ADMIN" as const, phoneVerified: true, bio: "平台管理員。" },
  {
    id: DEMO_ACCOUNTS[0].id,
    email: "mars@tysm.hk",
    phone: "+85291000001",
    nickname: DEMO_ACCOUNTS[0].nickname,
    role: "USER" as const,
    phoneVerified: true,
    bio: "旺角收卡。手持、平鋪同卡冊都係實拍。",
    avatarUrl: portrait("photo-1507003211169-0a1dd7228f2d"),
  },
  {
    id: DEMO_ACCOUNTS[1].id,
    email: "tyu@tysm.hk",
    phone: "+85291000002",
    nickname: DEMO_ACCOUNTS[1].nickname,
    role: "USER" as const,
    phoneVerified: true,
    bio: "主攻閃卡同卡冊，每週更新桌面實拍。",
    avatarUrl: portrait("photo-1494790108377-be9c29b29330"),
  },
  {
    id: DEMO_ACCOUNTS[2].id,
    email: "muel@tysm.hk",
    phone: "+85291000003",
    nickname: DEMO_ACCOUNTS[2].nickname,
    role: "USER" as const,
    phoneVerified: true,
    bio: "收藏運動卡同寶可夢，喜歡堆疊同單卡特寫。",
    avatarUrl: portrait("photo-1500648767791-00dcc994a43e"),
  },
];

export const demoStores: { userId: string; storeName: string; storeDistrict: string; storeLine1: string; storeHours: string }[] = [];

export const demoAddresses = [
  { id: "addr_mars", userId: "user_mars", recipient: "Mars", phone: "+85291000001", line1: "彌敦道 100 號", district: "油尖旺" },
  { id: "addr_tyu", userId: "user_tyu", recipient: "Tyu", phone: "+85291000002", line1: "軒尼詩道 20 號", district: "灣仔" },
  { id: "addr_muel", userId: "user_muel", recipient: "MueL", phone: "+85291000003", line1: "廣東道 8 號", district: "油尖旺" },
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
  { id: "thread_tyu_mars", listingId: "mars_list_03", buyerId: "user_tyu", sellerId: "user_mars" },
  { id: "thread_mars_tyu", listingId: "tyu_list_03", buyerId: "user_mars", sellerId: "user_tyu" },
  { id: "thread_muel_mars", listingId: "mars_list_01", buyerId: "user_muel", sellerId: "user_mars" },
  { id: "thread_mars_muel", listingId: "muel_list_03", buyerId: "user_mars", sellerId: "user_muel" },
  { id: "thread_tyu_muel", listingId: "muel_list_02", buyerId: "user_tyu", sellerId: "user_muel" },
];

export const demoMessages = [
  { id: "msg_tyu_mars_1", threadId: "thread_tyu_mars", senderId: "user_tyu", body: "平鋪呢組可唔可以約旺角交收？", read: true },
  { id: "msg_tyu_mars_2", threadId: "thread_tyu_mars", senderId: "user_mars", body: "可以，週末下午旺角站。我再傳相。", read: false },
  { id: "msg_mars_tyu_1", threadId: "thread_mars_tyu", senderId: "user_mars", body: "桌上一排入面有冇單張閃卡？", read: true },
  { id: "msg_mars_tyu_2", threadId: "thread_mars_tyu", senderId: "user_tyu", body: "有一張，特寫喺第二張相。", read: false },
  { id: "msg_muel_mars_1", threadId: "thread_muel_mars", senderId: "user_muel", body: "手持那疊我睇過相，卡角乾淨嗎？", read: true },
  { id: "msg_muel_mars_2", threadId: "thread_muel_mars", senderId: "user_mars", body: "四角都尖，同相片一樣。", read: false },
  { id: "msg_mars_muel_1", threadId: "thread_mars_muel", senderId: "user_mars", body: "桌上一組可以順豐到付嗎？", read: true },
  { id: "msg_mars_muel_2", threadId: "thread_mars_muel", senderId: "user_muel", body: "可以，運費到付。", read: false },
  { id: "msg_tyu_muel_1", threadId: "thread_tyu_muel", senderId: "user_tyu", body: "卡盒同特寫係同一套嗎？", read: true },
  { id: "msg_tyu_muel_2", threadId: "thread_tyu_muel", senderId: "user_muel", body: "係，盒面同卡面都影咗。", read: false },
];

export const demoNotifications = [
  { id: "note_mars_tyu", userId: "user_mars", type: "message", title: "新訊息", body: "Tyu 問平鋪那組可唔可以交收。", href: "/messages/thread_tyu_mars", read: false },
  { id: "note_tyu_mars", userId: "user_tyu", type: "message", title: "新訊息", body: "Mars 問桌上一排有冇閃卡。", href: "/messages/thread_mars_tyu", read: false },
  { id: "note_mars_muel", userId: "user_mars", type: "message", title: "新訊息", body: "MueL 問手持那疊的卡角。", href: "/messages/thread_muel_mars", read: false },
  { id: "note_muel_mars", userId: "user_muel", type: "message", title: "新訊息", body: "Mars 問桌上一組點寄。", href: "/messages/thread_mars_muel", read: true },
  { id: "note_muel_tyu", userId: "user_muel", type: "message", title: "新訊息", body: "Tyu 問卡盒同特寫。", href: "/messages/thread_tyu_muel", read: false },
  { id: "note_tyu_order", userId: "user_tyu", type: "order", title: "交易完成", body: "你同 Mars 的訂單已完成。", href: "/orders", read: true },
  { id: "note_mars_order", userId: "user_mars", type: "order", title: "交易完成", body: "你同 Tyu 的訂單已完成。", href: "/orders", read: true },
  { id: "note_muel_order", userId: "user_muel", type: "order", title: "收到評價", body: "Mars 留低咗評價。", href: "/me?tab=reviews", read: false },
  { id: "note_mars_fav", userId: "user_mars", type: "message", title: "有人睇緊你的卡", body: "Tyu 收藏咗你的布面單卡。", href: "/listing/mars_list_02", read: false },
  { id: "note_tyu_fav", userId: "user_tyu", type: "message", title: "有人睇緊你的卡", body: "Mars 收藏咗你的桌上單卡。", href: "/listing/tyu_list_02", read: false },
];

export const demoFavorites = [
  { id: "fav_mars_tyu_1", userId: "user_mars", listingId: "tyu_list_01" },
  { id: "fav_mars_tyu_2", userId: "user_mars", listingId: "tyu_list_02" },
  { id: "fav_mars_tyu_3", userId: "user_mars", listingId: "tyu_list_03" },
  { id: "fav_mars_muel_1", userId: "user_mars", listingId: "muel_list_01" },
  { id: "fav_tyu_mars_1", userId: "user_tyu", listingId: "mars_list_01" },
  { id: "fav_tyu_mars_2", userId: "user_tyu", listingId: "mars_list_02" },
  { id: "fav_tyu_mars_3", userId: "user_tyu", listingId: "mars_list_03" },
  { id: "fav_tyu_muel_1", userId: "user_tyu", listingId: "muel_list_02" },
  { id: "fav_muel_mars_1", userId: "user_muel", listingId: "mars_list_01" },
  { id: "fav_muel_tyu_1", userId: "user_muel", listingId: "tyu_list_01" },
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

const demoPairs = [
  ["user_mars", "user_tyu"],
  ["user_mars", "user_muel"],
  ["user_tyu", "user_muel"],
] as const;

export const demoFollows = demoPairs.flatMap(([a, b]) => [
  { id: `follow_${a}_${b}`, followerId: a, sellerId: b },
  { id: `follow_${b}_${a}`, followerId: b, sellerId: a },
]);

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
  { id: "search_mars_tyu", userId: "user_mars", query: "Tyu" },
  { id: "search_mars_pile", userId: "user_mars", query: "卡堆" },
  { id: "search_tyu_mars", userId: "user_tyu", query: "Mars" },
];

const shot = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const spread = shot("photo-1613771404784-3a5686aa2be3");
const holo = shot("photo-1613771404721-1f92d799e49f");
const cloth = shot("photo-1611931960487-4932667079f1");
const color = shot("photo-1616196334218-caffdc9b2317");
const pileA = shot("photo-1647892591880-58c55fd726d8");
const pileB = shot("photo-1647892591717-28c7fd63bb3f");
const stackA = shot("photo-1647893977173-59619da505d9");
const single = shot("photo-1636391671086-6b4b776cd031");
const bunch = shot("photo-1703023689733-6a4281149189");
const group = shot("photo-1640271215810-ce65ba65ef0b");
const pileC = shot("photo-1647892591703-4552c35a58e7");
const logoStack = shot("photo-1647893977168-6316f6c9ae44");
const closeup = shot("photo-1672759043716-620e810abac8");
const handHolo = shot("photo-1742743032379-8dbd2c2fe9df");
const table = shot("photo-1606503153255-59d8b8b82176");

const MARS = "user_mars";
const TYU = "user_tyu";
const MUEL = "user_muel";

export type ShowcaseListing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  priceCents: number;
  photos: string[];
  catalogCardId?: string | null;
};

export type ShowcaseCollection = {
  id: string;
  ownerId: string;
  title: string;
  visibility: "PUBLIC" | "PRIVATE";
  photos: string[];
  listingId: string | null;
  catalogCardId?: string | null;
};

export type ShowcasePost = {
  id: string;
  ownerId: string;
  collectionId: string;
  body: string;
  ageDays: number;
};

export type ShowcaseReview = {
  id: string;
  orderId: string;
  itemId: string;
  listingId: string;
  authorId: string;
  stars: number;
  comment: string;
  reply: string | null;
  ageDays: number;
};

export const demoShowcaseListings: ShowcaseListing[] = [
  { id: "mars_list_01", ownerId: MARS, title: "手持一疊卡", description: "手持實拍。A stack of cards held up to the light.", priceCents: 12800, photos: [spread, holo], catalogCardId: "demo_card_charizard" },
  { id: "mars_list_02", ownerId: MARS, title: "布面單卡", description: "布面實拍。One card on cloth.", priceCents: 8600, photos: [cloth] },
  { id: "mars_list_03", ownerId: MARS, title: "平鋪一組", description: "平鋪實拍。Cards spread on a table.", priceCents: 6400, photos: [color, table] },
  { id: "tyu_list_01", ownerId: TYU, title: "今日卡堆", description: "卡堆實拍。A pile of pulled cards.", priceCents: 9800, photos: [pileB, stackA] },
  { id: "tyu_list_02", ownerId: TYU, title: "桌上單卡", description: "單卡實拍。A single card on the table.", priceCents: 5400, photos: [single], catalogCardId: "demo_card_pikachu" },
  { id: "tyu_list_03", ownerId: TYU, title: "桌上一排", description: "排列實拍。Cards lined up on a table.", priceCents: 7200, photos: [bunch] },
  { id: "muel_list_01", ownerId: MUEL, title: "疊高的卡", description: "疊卡實拍。A tall stack of cards.", priceCents: 11200, photos: [pileC], catalogCardId: "demo_card_mewtwo" },
  { id: "muel_list_02", ownerId: MUEL, title: "卡盒同特寫", description: "卡盒實拍。A box stack and a close-up.", priceCents: 15400, photos: [logoStack, closeup] },
  { id: "muel_list_03", ownerId: MUEL, title: "桌上一組卡", description: "桌面實拍。A group of cards on the table.", priceCents: 6800, photos: [group] },
];

export const demoShowcaseCollections: ShowcaseCollection[] = [
  { id: "mars_col_01", ownerId: MARS, title: "手持一疊卡", visibility: "PUBLIC", photos: [spread, holo], listingId: "mars_list_01", catalogCardId: "demo_card_charizard" },
  { id: "mars_col_02", ownerId: MARS, title: "布面單卡", visibility: "PUBLIC", photos: [cloth], listingId: "mars_list_02" },
  { id: "mars_col_03", ownerId: MARS, title: "開完未入冊", visibility: "PUBLIC", photos: [pileA, table], listingId: null, catalogCardId: "demo_card_eevee" },
  { id: "mars_col_04", ownerId: MARS, title: "檯面色卡", visibility: "PUBLIC", photos: [color], listingId: null, catalogCardId: "demo_card_gengar" },
  { id: "tyu_col_01", ownerId: TYU, title: "今日卡堆", visibility: "PUBLIC", photos: [pileB, stackA], listingId: "tyu_list_01" },
  { id: "tyu_col_02", ownerId: TYU, title: "桌上單卡", visibility: "PUBLIC", photos: [single], listingId: "tyu_list_02", catalogCardId: "demo_card_pikachu" },
  { id: "tyu_col_03", ownerId: TYU, title: "排開睇白邊", visibility: "PUBLIC", photos: [bunch], listingId: "tyu_list_03" },
  { id: "tyu_col_04", ownerId: TYU, title: "未公開閃卡", visibility: "PRIVATE", photos: [handHolo], listingId: null },
  { id: "muel_col_01", ownerId: MUEL, title: "疊高的卡", visibility: "PUBLIC", photos: [pileC], listingId: "muel_list_01", catalogCardId: "demo_card_mewtwo" },
  { id: "muel_col_02", ownerId: MUEL, title: "卡盒封面", visibility: "PUBLIC", photos: [logoStack], listingId: null },
  { id: "muel_col_03", ownerId: MUEL, title: "桌面同特寫", visibility: "PUBLIC", photos: [group, closeup], listingId: null, catalogCardId: "demo_card_umbreon" },
  { id: "muel_col_04", ownerId: MUEL, title: "自己先睇的特寫", visibility: "PRIVATE", photos: [handHolo, holo], listingId: null },
];

export const demoShowcasePosts: ShowcasePost[] = [
  { id: "mars_post_01", ownerId: MARS, collectionId: "mars_col_01", body: "今日手持，卡面乾淨。", ageDays: 0 },
  { id: "mars_post_02", ownerId: MARS, collectionId: "mars_col_02", body: "單卡放喺布上面影。", ageDays: 1 },
  { id: "mars_post_03", ownerId: MARS, collectionId: "mars_col_03", body: "開完放喺桌面，未入冊。", ageDays: 2 },
  { id: "mars_post_04", ownerId: MARS, collectionId: "mars_col_04", body: "呢組色卡留喺檯面。", ageDays: 3 },
  { id: "tyu_post_01", ownerId: TYU, collectionId: "tyu_col_01", body: "收工整理今日的卡堆。", ageDays: 1 },
  { id: "tyu_post_02", ownerId: TYU, collectionId: "tyu_col_02", body: "這張先單獨影。", ageDays: 2 },
  { id: "tyu_post_03", ownerId: TYU, collectionId: "tyu_col_03", body: "排開先睇有冇白邊。", ageDays: 4 },
  { id: "tyu_post_04", ownerId: TYU, collectionId: "tyu_col_04", body: "閃卡先收住，未公開。", ageDays: 5 },
  { id: "muel_post_01", ownerId: MUEL, collectionId: "muel_col_01", body: "疊高先數張數。", ageDays: 2 },
  { id: "muel_post_02", ownerId: MUEL, collectionId: "muel_col_02", body: "卡盒封面同實卡一起影。", ageDays: 3 },
  { id: "muel_post_03", ownerId: MUEL, collectionId: "muel_col_03", body: "桌面同特寫都有。", ageDays: 6 },
  { id: "muel_post_04", ownerId: MUEL, collectionId: "muel_col_04", body: "特寫先自己睇。", ageDays: 7 },
];

export const demoShowcaseReviews: ShowcaseReview[] = [
  { id: "mars_review_tyu", orderId: "mars_order_tyu", itemId: "mars_oi_tyu", listingId: "mars_list_01", authorId: TYU, stars: 5, comment: "手持相片同實卡一樣，約旺角交收好方便。", reply: "多謝，下次見。", ageDays: 6 },
  { id: "mars_review_muel", orderId: "mars_order_muel", itemId: "mars_oi_muel", listingId: "mars_list_02", authorId: MUEL, stars: 5, comment: "布面相已經好清楚，卡角乾淨。", reply: null, ageDays: 8 },
  { id: "tyu_review_mars", orderId: "tyu_order_mars", itemId: "tyu_oi_mars", listingId: "tyu_list_01", authorId: MARS, stars: 5, comment: "卡堆相無落差，包裝穩陣。", reply: "多謝 Mars。", ageDays: 9 },
  { id: "tyu_review_muel", orderId: "tyu_order_muel", itemId: "tyu_oi_muel", listingId: "tyu_list_02", authorId: MUEL, stars: 4, comment: "單卡同相片相符，回覆亦快。", reply: null, ageDays: 11 },
  { id: "muel_review_mars", orderId: "muel_order_mars", itemId: "muel_oi_mars", listingId: "muel_list_01", authorId: MARS, stars: 5, comment: "疊卡實拍，描述老實。", reply: "多謝支持。", ageDays: 12 },
  { id: "muel_review_tyu", orderId: "muel_order_tyu", itemId: "muel_oi_tyu", listingId: "muel_list_02", authorId: TYU, stars: 4, comment: "卡盒同特寫都對得上，推薦。", reply: null, ageDays: 14 },
];

export function showcasePostPhotos(post: ShowcasePost): string[] {
  return demoShowcaseCollections.find((item) => item.id === post.collectionId)?.photos ?? [];
}

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
