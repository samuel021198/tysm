import type { CatalogGame } from "@prisma/client";
import { EXTRA_CARD_CATEGORIES, LEAF_CATEGORIES } from "../prisma/demo-catalog";
import { loadCuratedCatalog, loadSoftListings, softListingId, softPostId, type WaveGame } from "./catalog-names";
import { prisma } from "./db";
import { DEX_PLACEHOLDER } from "./dex";

const ZH: Record<WaveGame, string> = {
  YUGIOH: "遊戲王",
  DIGIMON: "數碼暴龍",
  WEISS_SCHWARZ: "黑白雙翼",
  LORCANA: "Lorcana",
  MTG: "魔法風雲會",
  FLESH_AND_BLOOD: "Flesh and Blood",
  BANDAI_GUNDAM: "高達",
};

const SELLERS: { persona: string; handle: string; district: string; bio: string }[] = [
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

const SLUG_BY_GAME: Record<WaveGame, string> = {
  YUGIOH: "yugioh",
  DIGIMON: "digimon",
  WEISS_SCHWARZ: "weiss-schwarz",
  LORCANA: "lorcana",
  MTG: "mtg",
  FLESH_AND_BLOOD: "flesh-and-blood",
  BANDAI_GUNDAM: "gundam",
};

async function upsertCategories() {
  await prisma.category.upsert({
    where: { slug: "cards" },
    update: { nameZh: "卡牌", nameEn: "Cards" },
    create: { id: "cat_cards", slug: "cards", nameZh: "卡牌", nameEn: "Cards", level: "ROOT", sort: 0 },
  });
  const groups = [
    ["cat_tcg", "tcg", "TCG", "TCG", "tcg", 1],
    ["cat_athletes", "athletes", "運動員", "Athletes", "athlete", 2],
    ["cat_celebrities", "celebrities", "明星", "Celebrities", "celebrity", 3],
  ] as const;
  for (const [id, slug, nameZh, nameEn, groupKey, sort] of groups) {
    await prisma.category.upsert({
      where: { slug },
      update: { nameZh, nameEn, parentId: "cat_cards", groupKey, sort },
      create: { id, slug, nameZh, nameEn, level: "GROUP", parentId: "cat_cards", groupKey, sort },
    });
  }
  for (const [id, slug, nameZh, nameEn, groupKey, parentId, sort] of [...LEAF_CATEGORIES, ...EXTRA_CARD_CATEGORIES]) {
    await prisma.category.upsert({
      where: { slug },
      update: { nameZh, nameEn, groupKey, parentId, sort },
      create: { id, slug, nameZh, nameEn, level: "LEAF", groupKey, parentId, sort },
    });
  }
}

async function upsertNames() {
  const { sets, cards } = loadCuratedCatalog();
  const setIds = new Map<string, string>();
  for (const set of sets) {
    const data = {
      game: set.game as CatalogGame,
      printRegion: "WEST" as const,
      code: set.code,
      nameEn: set.nameEn,
      nameJa: set.nameJa,
      series: set.series,
      releaseDate: null,
      total: set.total,
      logoUrl: null,
    };
    const row = await prisma.catalogSet.upsert({
      where: { externalId: set.externalId },
      update: data,
      create: { id: set.externalId, externalId: set.externalId, ...data },
    });
    setIds.set(set.externalId, row.id);
  }
  const chunk = 500;
  // ponytail: skipDuplicates will not refresh a renamed english row. nameJa is filled below. Upgrade path: ON CONFLICT DO UPDATE if curated english names are revised.
  for (let index = 0; index < cards.length; index += chunk) {
    await prisma.catalogCard.createMany({
      data: cards.slice(index, index + chunk).map((card) => ({
        id: card.externalId,
        externalId: card.externalId,
        setId: setIds.get(card.setExternalId) || card.setExternalId,
        game: card.game as CatalogGame,
        printRegion: "WEST" as const,
        collectorNumber: card.collectorNumber,
        numberKey: card.numberKey,
        nameEn: card.nameEn,
        nameJa: card.nameJa,
        imageUrl: DEX_PLACEHOLDER,
        sourceImageUrl: null,
        rarity: null,
        artist: null,
        finish: null,
      })),
      skipDuplicates: true,
    });
  }
  const aliases = await refreshAliasNames(cards);
  return { sets: sets.length, cards: cards.length, aliases };
}

/** skipDuplicates will not fill nameJa on a row that already exists. Touch only cards that gained a JA title. */
async function refreshAliasNames(cards: { externalId: string; nameJa: string }[]) {
  const aliased = cards.filter((card) => card.nameJa);
  const chunk = 40;
  for (let index = 0; index < aliased.length; index += chunk) {
    await prisma.$transaction(
      aliased.slice(index, index + chunk).map((card) =>
        prisma.catalogCard.updateMany({
          where: { externalId: card.externalId, NOT: { nameJa: card.nameJa } },
          data: { nameJa: card.nameJa },
        }),
      ),
    );
  }
  return aliased.length;
}

function sellerId(handle: string) {
  return `user_soft_${handle}`;
}

async function upsertDemos() {
  const plan = loadSoftListings();
  const byPersona = new Map(SELLERS.map((row) => [row.persona, row]));
  for (const [index, seller] of SELLERS.entries()) {
    const id = sellerId(seller.handle);
    const data = {
      email: `${seller.handle}@tysm.hk`,
      phone: `+852910001${String(index + 1).padStart(2, "0")}`,
      nickname: seller.persona,
      username: seller.handle,
      role: "USER" as const,
      phoneVerified: true,
      emailVerified: true,
      termsAcceptedAt: new Date(),
      bio: seller.bio,
      handoverPlace: seller.district,
      storeName: `${seller.persona} 卡`,
      storeDistrict: seller.district,
      interestTags: ["卡牌"],
    };
    await prisma.user.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  const categories = await prisma.category.findMany({
    where: { slug: { in: Object.values(SLUG_BY_GAME) } },
    select: { id: true, slug: true },
  });
  const categoryId = new Map(categories.map((row) => [row.slug, row.id]));
  const linked = await prisma.catalogCard.findMany({
    where: {
      OR: plan.map((row) => ({ game: row.proposedEnum as CatalogGame, nameEn: row.cardNameEn })),
    },
    select: { id: true, game: true, nameEn: true },
  });
  const cardId = new Map(linked.map((row) => [`${row.game}\0${row.nameEn}`, row.id]));

  for (const [index, row] of plan.entries()) {
    const seller = byPersona.get(row.sellerPersona);
    if (!seller) throw new Error(row.sellerPersona);
    const slug = SLUG_BY_GAME[row.proposedEnum];
    const cat = categoryId.get(slug);
    if (!cat) throw new Error(slug);
    const cents = Math.round(row.priceHKD * 100);
    const auction = row.listingType === "auction";
    const id = softListingId(row.id);
    const title = `${ZH[row.proposedEnum]} ${row.cardNameEn}`;
    const data = {
      sellerId: sellerId(seller.handle),
      categoryId: cat,
      status: "ACTIVE" as const,
      saleType: auction ? ("AUCTION" as const) : ("BUY_NOW" as const),
      title,
      description: `軟啟動示範。${row.cardNameEn}，近全新。可順豐到付或${seller.district}交收。 ${row.brand}.`,
      quantity: 1,
      quantityAvailable: 1,
      shippingFee: 0,
      shippingDays: 3,
      shipLockerFee: 0,
      shipMeetFee: 0,
      shipSfCod: true,
      shipMeetup: true,
      shipPickup: false,
      meetupDistrict: seller.district,
      meetupWindow: "週末下午",
      meetupNotes: "請先傳訊息。",
      price: auction ? null : cents,
      offersEnabled: false,
      minOffer: null,
      startPrice: auction ? cents : null,
      reservePrice: null,
      auctionDays: auction ? 3 : null,
      auctionEndsAt: auction ? new Date(Date.now() + 3 * 86400000) : null,
      currentBid: null,
      leaderId: null,
      auctionSettled: false,
      auctionPassed: false,
      bidsVoided: false,
      binLockOrderId: null,
      cardKind: "TCG" as const,
      game: row.brand,
      setName: row.series,
      cardName: row.cardNameEn,
      language: "英文",
      personName: null,
      seasonYear: "2026",
      brandSeries: null,
      conditionTrack: "RAW" as const,
      rawGrade: "A" as const,
      grader: null,
      gradeValue: null,
      certNumber: null,
      videoUrl: null,
      catalogCardId: cardId.get(`${row.proposedEnum}\0${row.cardNameEn}`) ?? null,
      publishedAt: new Date(Date.now() - index * 3600000),
      viewCount: 4,
    };
    await prisma.listing.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    const photoId = `${id}_p0`;
    await prisma.listingPhoto.upsert({
      where: { id: photoId },
      update: { url: DEX_PLACEHOLDER, role: "FRONT", position: 0 },
      create: { id: photoId, listingId: id, url: DEX_PLACEHOLDER, role: "FRONT", position: 0 },
    });
    const postId = softPostId(row.id);
    const post = {
      authorId: sellerId(seller.handle),
      body: `放售 ${row.cardNameEn}。軟啟動示範，相片之後再補。 #${ZH[row.proposedEnum]}`,
      tags: [ZH[row.proposedEnum]],
      createdAt: new Date(Date.now() - index * 3600000),
    };
    await prisma.post.upsert({
      where: { id: postId },
      update: post,
      create: { id: postId, ...post },
    });
    const postPhotoId = `${postId}_p0`;
    await prisma.postPhoto.upsert({
      where: { id: postPhotoId },
      update: { url: DEX_PLACEHOLDER, position: 0 },
      create: { id: postPhotoId, postId, url: DEX_PLACEHOLDER, position: 0 },
    });
  }
  return { sellers: SELLERS.length, listings: plan.length, posts: plan.length };
}

/** Additive. Does not delete users, posts, or listings. */
export async function seedWave1() {
  await upsertCategories();
  const names = await upsertNames();
  const demos = await upsertDemos();
  return { ...names, ...demos, wiped: false };
}
