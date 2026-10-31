import { DEMO_ACCOUNTS } from "../lib/demo-login";
import { fronts, withSceneCover } from "./demo-card-fronts";
import { traderCollections, traderFollows, traderListings, traderPosts, traderUsers } from "./demo-traders";
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
    notes: ["卡面乾淨，四角尖", "兩張庫存，歡迎傾交收"],
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
    notes: ["卡角有少少白", "可以傾交收"],
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
    notes: ["三刀流 SEC", "歡迎傾交收"],
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
    notes: ["有輕微白邊", "歡迎傾交收"],
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
    notes: ["新秀亮面", "可以傾交收"],
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
    notes: ["雷霆", "可以傾交收"],
  }),

  card({
    id: "seed_ohtani", sellerId: "user_ming", categoryId: "cat_baseball",
    zh: "大谷翔平", en: "Shohei Ohtani", line: "Bowman · 2018 · Raw A",
    price: 420, offerMin: 300, ship: 22,
    kind: athlete, season: "2018", brand: "Bowman", raw: "A", views: 84,
    notes: ["新秀卡", "歡迎傾交收"],
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
    notes: ["經典新秀", "可以傾交收"],
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
    notes: ["歡迎傾交收"],
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
    notes: ["經典港產", "可以傾交收"],
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
    notes: ["可以傾交收"],
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
    notes: ["有少少彎", "直購、拍賣都可以，歡迎傾交收"],
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
    verificationTier: "MERCHANT" as const,
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
    verificationTier: "TRUSTED" as const,
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
  ...traderUsers,
];

export const demoStores: { userId: string; storeName: string; storeDistrict: string; storeLine1: string; storeHours: string }[] = [
  { userId: "user_mars", storeName: "旺角實拍卡", storeDistrict: "油尖旺", storeLine1: "西洋菜南街 1 號", storeHours: "週末 14:00–18:00" },
  { userId: "user_tyu", storeName: "灣仔閃卡舖", storeDistrict: "灣仔", storeLine1: "軒尼詩道 20 號", storeHours: "平日 19:00–22:00" },
  { userId: "user_muel", storeName: "油麻地運動卡", storeDistrict: "油尖旺", storeLine1: "廣東道 8 號", storeHours: "週末 15:00–20:00" },
  { userId: "user_kai", storeName: "油麻地噴火龍", storeDistrict: "油尖旺", storeLine1: "碧街 18 號地下", storeHours: "週末 14:00–19:00" },
  { userId: "user_hoi", storeName: "觀塘海賊王", storeDistrict: "觀塘", storeLine1: "開源道 68 號", storeHours: "平日 18:00–21:00" },
  { userId: "user_suki", storeName: "沙田月伊布", storeDistrict: "沙田", storeLine1: "沙田正街 8 號", storeHours: "週日 13:00–18:00" },
  { userId: "user_lok", storeName: "科學園卡鋪", storeDistrict: "沙田", storeLine1: "科技大道西 5 號", storeHours: "平日 12:00–20:00" },
  { userId: "user_yan", storeName: "銅鑼灣球星", storeDistrict: "灣仔", storeLine1: "軒尼詩道 88 號", storeHours: "週末 15:00–20:00" },
  { userId: "user_jun", storeName: "深水埗舊卡", storeDistrict: "深水埗", storeLine1: "福華街 42 號", storeHours: "每日 13:00–19:00" },
  { userId: "user_mika", storeName: "尖沙咀卡冊", storeDistrict: "油尖旺", storeLine1: "加拿分道 20 號", storeHours: "週末 14:00–19:00" },
  { userId: "user_bao", storeName: "荃灣實價卡", storeDistrict: "荃灣", storeLine1: "川龍街 9 號", storeHours: "平日 16:00–21:00" },
  { userId: "user_rafa", storeName: "紅磡球星卡", storeDistrict: "九龍城", storeLine1: "黃埔新邨 3 號", storeHours: "週末 13:00–18:00" },
  { userId: "user_ace", storeName: "將軍澳 SEC", storeDistrict: "西貢", storeLine1: "唐俊街 11 號", storeHours: "週六 14:00–19:00" },
];

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

export const demoFollows = [
  ...demoPairs.flatMap(([a, b]) => [
    { id: `follow_${a}_${b}`, followerId: a, sellerId: b },
    { id: `follow_${b}_${a}`, followerId: b, sellerId: a },
  ]),
  ...traderFollows,
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
  { id: "search_mars_tyu", userId: "user_mars", query: "Tyu" },
  { id: "search_mars_pile", userId: "user_mars", query: "卡堆" },
  { id: "search_tyu_mars", userId: "user_tyu", query: "Mars" },
];

const mars01 = [fronts.charizard, fronts.charizardSar, fronts.pikachu];
const mars02 = [fronts.eevee, fronts.mew, fronts.dragonite];
const mars03 = [fronts.gengar, fronts.snorlax];
const marsCol03 = [fronts.eevee, fronts.pikachu, fronts.mew];
const marsCol04 = [fronts.gengar, fronts.umbreon, fronts.dragonite];
const tyu01 = [fronts.umbreon, fronts.charizard, fronts.eevee];
const tyu02 = [fronts.pikachu, fronts.pikachuEx, fronts.eevee];
const tyu03 = [fronts.snorlax, fronts.gengar, fronts.mewtwo];
const tyu04 = [fronts.umbreonSar, fronts.glaceon, fronts.charizardSar];
const muel01 = [fronts.mewtwo, fronts.charizard, fronts.umbreon];
const muel02 = [fronts.charizardSar, fronts.mew];
const muel03 = [fronts.snorlax, fronts.dragonite];
const muelCol02 = [fronts.dragonite, fronts.snorlax, fronts.mewtwo];
const muelCol03 = [fronts.umbreonSar, fronts.umbreon, fronts.glaceon];
const muel04 = [fronts.glaceon, fronts.umbreonSar, fronts.pikachuEx];

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
  categoryId?: string;
  game?: string | null;
  setName?: string | null;
  cardName?: string | null;
  personName?: string | null;
  cardKind?: "TCG" | "ATHLETE" | "CELEBRITY";
  language?: string | null;
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
  tags: string[];
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

const marsSell01 = "今日手持呢疊噴火龍，卡面乾淨，四角都尖。燈光下閃面無花，同實卡一樣。想換或者放賣都可以傾，價錢寫咗喺下面。 #FS #Charizard";
const marsSell02 = "單卡放喺布上面影，白邊同卡角都睇到。收咗半年，狀態同相一樣。而家放賣，可約旺角交收。 #賣 #寶可夢";
const tyuSell01 = "收工整理今日的卡堆，閃面同普通卡分開影。狀態都係近全新，白邊少。呢組放賣，價錢係實價。 #FS #寶可夢";
const tyuSell02 = "這張先單獨影，卡面無花，四角尖。收藏咗一陣，而家讓出。可順豐或者旺角交收。 #賣 #寶可夢";
const tyuSell03 = "排開先睇有冇白邊，大部分都乾淨。呢排想騰空間，所以放賣。有興趣可以睇相再問。 #FS";
const muelSell01 = "疊高先數張數，入面有幾張閃。狀態同相一樣，無大花。整疊放賣，價錢寫喺下面。 #賣 #寶可夢";

export const demoShowcaseListings: ShowcaseListing[] = [
  { id: "mars_list_01", ownerId: MARS, title: "手持一疊卡", description: marsSell01, priceCents: 12800, photos: mars01, catalogCardId: "demo_card_charizard", categoryId: "cat_pokemon", game: "Pokémon", setName: "151", cardName: "噴火龍", cardKind: "TCG", language: "日文" },
  { id: "mars_list_02", ownerId: MARS, title: "布面單卡", description: marsSell02, priceCents: 8600, photos: mars02, categoryId: "cat_pokemon", game: "Pokémon", cardName: "布面單卡", cardKind: "TCG", language: "日文" },
  { id: "mars_list_03", ownerId: MARS, title: "平鋪一組", description: "平鋪一組放喺檯面，色卡同閃卡都有。狀態同相一樣，白邊少。而家放賣，週末旺角交收。 #FS", priceCents: 6400, photos: mars03, categoryId: "cat_pokemon", game: "Pokémon", cardKind: "TCG", language: "日文" },
  { id: "tyu_list_01", ownerId: TYU, title: "今日卡堆", description: tyuSell01, priceCents: 9800, photos: tyu01, categoryId: "cat_pokemon", game: "Pokémon", cardKind: "TCG", language: "日文" },
  { id: "tyu_list_02", ownerId: TYU, title: "桌上單卡", description: tyuSell02, priceCents: 5400, photos: tyu02, catalogCardId: "demo_card_pikachu", categoryId: "cat_pokemon", game: "Pokémon", setName: "SV2a", cardName: "皮卡丘", cardKind: "TCG", language: "日文" },
  { id: "tyu_list_03", ownerId: TYU, title: "桌上一排", description: tyuSell03, priceCents: 7200, photos: tyu03, categoryId: "cat_pokemon", game: "Pokémon", cardKind: "TCG", language: "日文" },
  { id: "muel_list_01", ownerId: MUEL, title: "疊高的卡", description: muelSell01, priceCents: 11200, photos: muel01, catalogCardId: "demo_card_mewtwo", categoryId: "cat_pokemon", game: "Pokémon", cardName: "超夢", cardKind: "TCG", language: "日文" },
  { id: "muel_list_02", ownerId: MUEL, title: "卡盒同特寫", description: "卡盒同特寫係同一套，盒面同卡面都影咗。狀態近全新，角位尖。而家放賣，可順豐到付。 #賣", priceCents: 15400, photos: muel02, categoryId: "cat_pokemon", game: "Pokémon", cardKind: "TCG", language: "日文" },
  { id: "muel_list_03", ownerId: MUEL, title: "桌上一組卡", description: "桌上一組卡排開影，閃面同普通卡都有。狀態同相一樣。而家放賣，油尖旺可交收。 #FS", priceCents: 6800, photos: muel03, categoryId: "cat_pokemon", game: "Pokémon", cardKind: "TCG", language: "日文" },
  ...traderListings,
];

export const demoShowcaseCollections: ShowcaseCollection[] = [
  { id: "mars_col_01", ownerId: MARS, title: "手持一疊卡", visibility: "PUBLIC", photos: withSceneCover(mars01, 0), listingId: "mars_list_01", catalogCardId: "demo_card_charizard" },
  { id: "mars_col_02", ownerId: MARS, title: "布面單卡", visibility: "PUBLIC", photos: withSceneCover(mars02, 1), listingId: "mars_list_02" },
  { id: "mars_col_03", ownerId: MARS, title: "開完未入冊", visibility: "PUBLIC", photos: withSceneCover(marsCol03, 2), listingId: null, catalogCardId: "demo_card_eevee" },
  { id: "mars_col_04", ownerId: MARS, title: "檯面色卡", visibility: "PUBLIC", photos: withSceneCover(marsCol04, 3), listingId: null, catalogCardId: "demo_card_gengar" },
  { id: "tyu_col_01", ownerId: TYU, title: "今日卡堆", visibility: "PUBLIC", photos: withSceneCover(tyu01, 4), listingId: "tyu_list_01" },
  { id: "tyu_col_02", ownerId: TYU, title: "桌上單卡", visibility: "PUBLIC", photos: withSceneCover(tyu02, 5), listingId: "tyu_list_02", catalogCardId: "demo_card_pikachu" },
  { id: "tyu_col_03", ownerId: TYU, title: "排開睇白邊", visibility: "PUBLIC", photos: withSceneCover(tyu03, 6), listingId: "tyu_list_03" },
  { id: "tyu_col_04", ownerId: TYU, title: "未公開閃卡", visibility: "PRIVATE", photos: withSceneCover(tyu04, 7), listingId: null },
  { id: "muel_col_01", ownerId: MUEL, title: "疊高的卡", visibility: "PUBLIC", photos: withSceneCover(muel01, 8), listingId: "muel_list_01", catalogCardId: "demo_card_mewtwo" },
  { id: "muel_col_02", ownerId: MUEL, title: "卡盒封面", visibility: "PUBLIC", photos: withSceneCover(muelCol02, 9), listingId: null },
  { id: "muel_col_03", ownerId: MUEL, title: "桌面同特寫", visibility: "PUBLIC", photos: withSceneCover(muelCol03, 10), listingId: null, catalogCardId: "demo_card_umbreon" },
  { id: "muel_col_04", ownerId: MUEL, title: "自己先睇的特寫", visibility: "PRIVATE", photos: withSceneCover(muel04, 11), listingId: null },
  ...traderCollections,
];

export const demoShowcasePosts: ShowcasePost[] = [
  { id: "mars_post_01", ownerId: MARS, collectionId: "mars_col_01", body: marsSell01, tags: ["FS", "Charizard"], ageDays: 0 },
  { id: "mars_post_02", ownerId: MARS, collectionId: "mars_col_02", body: marsSell02, tags: ["賣", "寶可夢"], ageDays: 1 },
  { id: "mars_post_03", ownerId: MARS, collectionId: "mars_col_03", body: "開完放喺桌面，未入冊，先自己睇一排。呢組留喺收藏，暫時唔放。喜歡色卡的可以睇下，唔賣。 #PC", tags: ["PC"], ageDays: 2 },
  { id: "mars_post_04", ownerId: MARS, collectionId: "mars_col_04", body: "檯面呢組色卡我好鍾意，但缺一張同系列。有人放緊可以搵我。其餘自己留，唔賣。 #PC #ISO", tags: ["PC", "ISO"], ageDays: 3 },
  { id: "tyu_post_01", ownerId: TYU, collectionId: "tyu_col_01", body: tyuSell01, tags: ["FS", "寶可夢"], ageDays: 1 },
  { id: "tyu_post_02", ownerId: TYU, collectionId: "tyu_col_02", body: tyuSell02, tags: ["賣", "寶可夢"], ageDays: 2 },
  { id: "tyu_post_03", ownerId: TYU, collectionId: "tyu_col_03", body: tyuSell03, tags: ["FS"], ageDays: 4 },
  { id: "tyu_post_04", ownerId: TYU, collectionId: "tyu_col_04", body: "閃卡先收住，未公開，卡套都未除。自己先影低角度同反光。呢張留喺收藏，唔會放上賣場。 #PC", tags: ["PC"], ageDays: 5 },
  { id: "muel_post_01", ownerId: MUEL, collectionId: "muel_col_01", body: muelSell01, tags: ["賣", "寶可夢"], ageDays: 2 },
  { id: "muel_post_02", ownerId: MUEL, collectionId: "muel_col_02", body: "卡盒封面同實卡一起影，呢套留喺櫃入面。開盒的時候卡角都好好。純粹分享，暫時唔放。 #PC", tags: ["PC"], ageDays: 3 },
  { id: "muel_post_03", ownerId: MUEL, collectionId: "muel_col_03", body: "桌面同特寫都有，月亮伊布的閃面好靚。我仲想搵同系列另一張。有人放緊可以傳訊息。 #PC #ISO", tags: ["PC", "ISO"], ageDays: 6 },
  { id: "muel_post_04", ownerId: MUEL, collectionId: "muel_col_04", body: "特寫先自己睇，未決定放唔放。卡面乾淨，但我想再對下光。而家只係收藏記錄。 #PC", tags: ["PC"], ageDays: 7 },
  ...traderPosts,
];

export const demoShowcaseReviews: ShowcaseReview[] = [
  { id: "mars_review_tyu", orderId: "mars_order_tyu", itemId: "mars_oi_tyu", listingId: "mars_list_01", authorId: TYU, stars: 5, comment: "手持相片同實卡一樣，約旺角交收好方便。", reply: "多謝，下次見。", ageDays: 6 },
  { id: "mars_review_muel", orderId: "mars_order_muel", itemId: "mars_oi_muel", listingId: "mars_list_02", authorId: MUEL, stars: 5, comment: "布面相已經好清楚，卡角乾淨。", reply: null, ageDays: 8 },
  { id: "tyu_review_mars", orderId: "tyu_order_mars", itemId: "tyu_oi_mars", listingId: "tyu_list_01", authorId: MARS, stars: 5, comment: "卡堆相無落差，包裝穩陣。", reply: "多謝 Mars。", ageDays: 9 },
  { id: "tyu_review_muel", orderId: "tyu_order_muel", itemId: "tyu_oi_muel", listingId: "tyu_list_02", authorId: MUEL, stars: 4, comment: "單卡同相片相符，回覆亦快。", reply: null, ageDays: 11 },
  { id: "muel_review_mars", orderId: "muel_order_mars", itemId: "muel_oi_mars", listingId: "muel_list_01", authorId: MARS, stars: 5, comment: "疊卡實拍，描述老實。", reply: "多謝支持。", ageDays: 12 },
  { id: "muel_review_tyu", orderId: "muel_order_tyu", itemId: "muel_oi_tyu", listingId: "muel_list_02", authorId: TYU, stars: 4, comment: "卡盒同特寫都對得上，推薦。", reply: null, ageDays: 14 },
];

const RANK_USERS = [
  "user_mars",
  "user_tyu",
  "user_muel",
  "user_kai",
  "user_hoi",
  "user_suki",
  "user_lok",
  "user_yan",
  "user_jun",
  "user_mika",
  "user_bao",
  "user_rafa",
  "user_ace",
] as const;

/**
 * Paid volume for 人氣商戶. `current` / `prior` are units in the rolling 3-day window and the 3 days before it.
 * ponytail: one order per shop per window, quantity is the volume. Upgrade path: split into qty-1 orders if order history should look like foot traffic.
 */
const rankShops: { sellerId: string; listingId: string; current: number; prior: number }[] = [
  { sellerId: "user_kai", listingId: "kai_01_list", current: 12, prior: 4 },
  { sellerId: "user_hoi", listingId: "hoi_01_list", current: 9, prior: 6 },
  { sellerId: "user_suki", listingId: "suki_01_list", current: 7, prior: 7 },
  { sellerId: "user_mars", listingId: "mars_list_01", current: 6, prior: 8 },
  { sellerId: "user_yan", listingId: "yan_01_list", current: 5, prior: 2 },
  { sellerId: "user_lok", listingId: "lok_01_list", current: 4, prior: 1 },
  { sellerId: "user_bao", listingId: "bao_01_list", current: 3, prior: 5 },
  { sellerId: "user_rafa", listingId: "rafa_01_list", current: 2, prior: 0 },
];

function rankBuyer(sellerId: string, offset: number): string {
  const others = RANK_USERS.filter((id) => id !== sellerId);
  return others[offset % others.length];
}

export type DemoRankOrder = {
  id: string;
  sellerId: string;
  buyerId: string;
  listingId: string;
  quantity: number;
  hoursAgo: number;
};

export const demoRankOrders: DemoRankOrder[] = rankShops.flatMap((shop, index) => {
  const rows: DemoRankOrder[] = [
    {
      id: `rank_order_${shop.sellerId}_now`,
      sellerId: shop.sellerId,
      buyerId: rankBuyer(shop.sellerId, 0),
      listingId: shop.listingId,
      quantity: shop.current,
      hoursAgo: 6 + index * 7,
    },
  ];
  if (shop.prior > 0) {
    rows.push({
      id: `rank_order_${shop.sellerId}_prev`,
      sellerId: shop.sellerId,
      buyerId: rankBuyer(shop.sellerId, 1),
      listingId: shop.listingId,
      quantity: shop.prior,
      hoursAgo: 80 + index * 7,
    });
  }
  return rows;
});

/** Likes for 人氣收藏家 and 人氣貼文. Posts are older than 6 days so every like lands after the post. No self-likes. */
const rankPosts: { postId: string; authorId: string; current: number; prior: number }[] = [
  { postId: "kai_03_post", authorId: "user_kai", current: 9, prior: 3 },
  { postId: "hoi_03_post", authorId: "user_hoi", current: 8, prior: 3 },
  { postId: "muel_post_03", authorId: "user_muel", current: 7, prior: 2 },
  { postId: "suki_03_post", authorId: "user_suki", current: 6, prior: 6 },
  { postId: "yan_02_post", authorId: "user_yan", current: 5, prior: 2 },
  { postId: "mika_02_post", authorId: "user_mika", current: 4, prior: 5 },
  { postId: "lok_02_post", authorId: "user_lok", current: 3, prior: 1 },
  { postId: "bao_03_post", authorId: "user_bao", current: 2, prior: 0 },
];

export type DemoRankLike = {
  id: string;
  postId: string;
  userId: string;
  hoursAgo: number;
};

export const demoRankLikes: DemoRankLike[] = rankPosts.flatMap((post) => {
  const likers = RANK_USERS.filter((id) => id !== post.authorId);
  const current = likers.slice(0, post.current).map((userId, index) => ({
    id: `like_${post.postId}_${userId}`,
    postId: post.postId,
    userId,
    hoursAgo: 4 + index * 6,
  }));
  const prior = likers.slice(post.current, post.current + post.prior).map((userId, index) => ({
    id: `like_${post.postId}_${userId}`,
    postId: post.postId,
    userId,
    hoursAgo: 78 + index * 8,
  }));
  return [...current, ...prior];
});

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
/// Wave-1 leaves pair with catalog enums YUGIOH, WEISS_SCHWARZ, DIGIMON, LORCANA, MTG, FLESH_AND_BLOOD, BANDAI_GUNDAM, DRAGON_BALL.
/// No card rows here. Wave-2 brand leaves stay off this list.
export const EXTRA_CARD_CATEGORIES = [
  ["cat_topps_soccer", "topps-soccer", "Topps 足球", "Topps Soccer", "athlete", "cat_athletes", 4],
  ["cat_topps_basketball", "topps-basketball", "Topps 籃球", "Topps Basketball", "athlete", "cat_athletes", 5],
  ["cat_topps_baseball", "topps-baseball", "Topps 棒球", "Topps Baseball", "athlete", "cat_athletes", 6],
  ["cat_panini_soccer", "panini-soccer", "Panini 足球", "Panini Soccer", "athlete", "cat_athletes", 7],
  ["cat_riftbound", "riftbound", "Riftbound", "Riftbound", "tcg", "cat_tcg", 8],
  ["cat_yugioh", "yugioh", "Yu-Gi-Oh", "Yu-Gi-Oh", "tcg", "cat_tcg", 9],
  ["cat_weiss_schwarz", "weiss-schwarz", "Weiss Schwarz", "Weiss Schwarz", "tcg", "cat_tcg", 10],
  ["cat_digimon", "digimon", "Digimon", "Digimon", "tcg", "cat_tcg", 11],
  ["cat_lorcana", "lorcana", "Lorcana", "Lorcana", "tcg", "cat_tcg", 12],
  ["cat_mtg", "mtg", "MTG", "MTG", "tcg", "cat_tcg", 13],
  ["cat_flesh_and_blood", "flesh-and-blood", "Flesh and Blood", "Flesh and Blood", "tcg", "cat_tcg", 14],
  ["cat_gundam", "gundam", "Gundam", "Gundam", "tcg", "cat_tcg", 15],
  ["cat_dragon_ball", "dragon-ball", "Dragon Ball", "Dragon Ball", "tcg", "cat_tcg", 16],
  ["cat_other", "other", "其他", "Other", "tcg", "cat_tcg", 17],
] as const;
