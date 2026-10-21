import { PrismaClient, type Grader, type RawGrade, type SaleType } from "@prisma/client";
import { resolveAuction } from "../lib/rules";

const prisma = new PrismaClient();
const hours = (value: number) => new Date(Date.now() + value * 60 * 60 * 1000);

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@tysm.hk").split(",")[0].trim().toLowerCase();
  const adminPhone = process.env.ADMIN_PHONE || "+85260000000";

  await prisma.siteSetting.upsert({
    where: { key: "commission_percent" },
    update: { value: "8" },
    create: { key: "commission_percent", value: "8" },
  });

  const cards = await prisma.category.upsert({
    where: { slug: "cards" },
    update: {},
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
      update: { nameZh, nameEn, parentId: cards.id, groupKey, sort },
      create: { id, slug, nameZh, nameEn, level: "GROUP", parentId: cards.id, groupKey, sort },
    });
  }
  const leaves = [
    ["cat_pokemon", "pokemon", "寶可夢", "Pokémon", "tcg", "cat_tcg", 1],
    ["cat_onepiece", "one-piece", "海賊王", "One Piece", "tcg", "cat_tcg", 2],
    ["cat_football", "football", "足球", "Football", "athlete", "cat_athletes", 1],
    ["cat_basketball", "basketball", "籃球", "Basketball", "athlete", "cat_athletes", 2],
    ["cat_baseball", "baseball", "棒球", "Baseball", "athlete", "cat_athletes", 3],
    ["cat_singers", "singers", "歌手", "Singers", "celebrity", "cat_celebrities", 1],
    ["cat_actors", "actors", "演員", "Actors", "celebrity", "cat_celebrities", 2],
    ["cat_idols", "idols", "偶像", "Idols", "celebrity", "cat_celebrities", 3],
  ] as const;
  for (const [id, slug, nameZh, nameEn, groupKey, parentId, sort] of leaves) {
    await prisma.category.upsert({
      where: { slug },
      update: { nameZh, nameEn, groupKey, parentId, sort },
      create: { id, slug, nameZh, nameEn, level: "LEAF", groupKey, parentId, sort },
    });
  }

  const users = [
    { id: "user_admin", email: adminEmail, phone: adminPhone, nickname: "TYSM 管理員", role: "ADMIN" as const, phoneVerified: true },
    { id: "user_ming", email: "ming@tysm.hk", phone: "+85291111111", nickname: "卡牌阿明", role: "USER" as const, phoneVerified: true },
    { id: "user_star", email: "star@tysm.hk", phone: "+85292222222", nickname: "星光收藏", role: "USER" as const, phoneVerified: true },
    { id: "user_mei", email: "mei@tysm.hk", phone: "+85293333333", nickname: "陳小美", role: "USER" as const, phoneVerified: true },
    { id: "user_alex", email: "alex@tysm.hk", phone: null, nickname: "Alex", role: "USER" as const, phoneVerified: false },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        nickname: user.nickname,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        role: user.role,
        termsAcceptedAt: new Date(),
        bio: user.id === "user_ming" ? "香港卡牌賣家，主攻寶可夢同運動卡。" : user.id === "user_star" ? "明星小卡同評級卡。" : undefined,
      },
      create: {
        ...user,
        emailVerified: true,
        termsAcceptedAt: new Date(),
        payoutMethod: user.phoneVerified ? "FPS" : null,
        payoutHolder: user.phoneVerified ? user.nickname : null,
        payoutAccount: user.phoneVerified ? user.phone : null,
        bio: user.id === "user_ming" ? "香港卡牌賣家，主攻寶可夢同運動卡。" : user.id === "user_star" ? "明星小卡同評級卡。" : null,
      },
    });
  }

  const addressFor = async (userId: string, id: string, recipient: string) => {
    await prisma.address.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId,
        recipient,
        phone: "+85293333333",
        line1: "軒尼詩道 1 號",
        district: "灣仔",
        isDefault: true,
      },
    });
  };
  await addressFor("user_mei", "addr_mei", "陳小美");
  await addressFor("user_ming", "addr_ming", "卡牌阿明");
  await addressFor("user_alex", "addr_alex", "Alex Chan");
  await addressFor("user_star", "addr_star", "星光收藏");

  const published = new Date();
  const listings: Array<Record<string, unknown> & { id: string; photos: [string, "FRONT" | "BACK" | "GALLERY"][] }> = [
    {
      id: "seed_charizard", sellerId: "user_ming", categoryId: "cat_pokemon", status: "ACTIVE", saleType: "BUY_NOW" as SaleType,
      title: "噴火龍 VMAX", description: "**日文噴火龍 VMAX**\n- 卡面乾淨\n- 可議價", quantity: 2, quantityAvailable: 2,
      shippingFee: 2000, shippingDays: 3, price: 128000, offersEnabled: true, minOffer: 100000, cardKind: "TCG",
      game: "Pokémon", setName: "仰天峰", cardName: "噴火龍", language: "日文", conditionTrack: "RAW", rawGrade: "A" as RawGrade,
      publishedAt: published, favoriteCount: 1, viewCount: 12, photos: [["/demo/charizard.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_pikachu", sellerId: "user_ming", categoryId: "cat_pokemon", status: "ACTIVE", saleType: "BUY_NOW",
      title: "皮卡丘 PSA 10", description: "寶可夢 25 周年皮卡丘，**PSA 10**。", quantity: 1, quantityAvailable: 1,
      shippingFee: 1500, shippingDays: 2, price: 88000, cardKind: "TCG", game: "Pokémon", setName: "25th Anniversary", cardName: "皮卡丘",
      language: "日文", conditionTrack: "GRADED", grader: "PSA" as Grader, gradeValue: 100, certNumber: "12345678",
      publishedAt: published, photos: [["/demo/pikachu.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_psyduck", sellerId: "user_ming", categoryId: "cat_pokemon", status: "ACTIVE", saleType: "BUY_NOW",
      title: "Psyduck", description: "English-title demo for bilingual search.", quantity: 1, quantityAvailable: 1,
      shippingFee: 1200, shippingDays: 3, price: 18000, cardKind: "TCG", game: "Pokémon", setName: "Base", cardName: "Psyduck",
      language: "英文", conditionTrack: "RAW", rawGrade: "A" as RawGrade, publishedAt: published,
      photos: [["/demo/pikachu.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_luffy", sellerId: "user_ming", categoryId: "cat_onepiece", status: "ACTIVE", saleType: "AUCTION",
      title: "路飛 漫畫背景 BGS 9.5", description: "海賊王領袖卡，代理出價示範。", quantity: 1, quantityAvailable: 1,
      shippingFee: 2500, shippingDays: 3, startPrice: 50000, cardKind: "TCG", game: "One Piece", setName: "Romance Dawn", cardName: "路飛",
      language: "日文", conditionTrack: "GRADED", grader: "BGS", gradeValue: 95, publishedAt: published,
      auctionEndsAt: hours(36), photos: [["/demo/luffy.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_nami", sellerId: "user_star", categoryId: "cat_onepiece", status: "ACTIVE", saleType: "BOTH",
      title: "娜美 Raw B", description: "可以拍賣，亦可以直購。", quantity: 1, quantityAvailable: 1,
      shippingFee: 2000, shippingDays: 4, price: 220000, startPrice: 30000, cardKind: "TCG", game: "One Piece", setName: "OP-01", cardName: "娜美",
      language: "日文", conditionTrack: "RAW", rawGrade: "B", publishedAt: published, auctionEndsAt: hours(2),
      photos: [["/demo/nami.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_messi", sellerId: "user_star", categoryId: "cat_football", status: "ACTIVE", saleType: "BUY_NOW",
      title: "美斯球衣卡 Raw C", description: "2022 賽季球衣卡。", quantity: 1, quantityAvailable: 1,
      shippingFee: 1800, shippingDays: 5, price: 64000, cardKind: "ATHLETE", personName: "美斯", seasonYear: "2022", brandSeries: "Topps",
      conditionTrack: "RAW", rawGrade: "C", publishedAt: published, photos: [["/demo/messi.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_curry", sellerId: "user_star", categoryId: "cat_basketball", status: "ACTIVE", saleType: "AUCTION",
      title: "居里簽名 PSA 9", description: "籃球簽名卡拍賣。", quantity: 1, quantityAvailable: 1,
      shippingFee: 3000, shippingDays: 4, startPrice: 150000, cardKind: "ATHLETE", personName: "Stephen Curry", seasonYear: "2021", brandSeries: "Panini",
      conditionTrack: "GRADED", grader: "PSA", gradeValue: 90, publishedAt: published, auctionEndsAt: hours(48),
      photos: [["/demo/curry.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_ohtani", sellerId: "user_ming", categoryId: "cat_baseball", status: "ACTIVE", saleType: "BUY_NOW",
      title: "大谷翔平 Raw A", description: "可議價的棒球新秀卡。", quantity: 1, quantityAvailable: 1,
      shippingFee: 2200, shippingDays: 3, price: 42000, offersEnabled: true, minOffer: 30000, cardKind: "ATHLETE",
      personName: "大谷翔平", seasonYear: "2018", brandSeries: "Bowman", conditionTrack: "RAW", rawGrade: "A", publishedAt: published,
      photos: [["/demo/ohtani.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_iu", sellerId: "user_star", categoryId: "cat_singers", status: "ACTIVE", saleType: "BUY_NOW",
      title: "IU 小卡 CGC 9.5", description: "歌手小卡，評級。", quantity: 1, quantityAvailable: 1,
      shippingFee: 1200, shippingDays: 2, price: 99000, cardKind: "CELEBRITY", personName: "IU", seasonYear: "2024", brandSeries: "官方小卡",
      conditionTrack: "GRADED", grader: "CGC", gradeValue: 95, publishedAt: published, photos: [["/demo/iu.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_jay", sellerId: "user_ming", categoryId: "cat_singers", status: "ACTIVE", saleType: "BUY_NOW",
      title: "周杰倫 Raw B", description: "演唱會紀念卡。", quantity: 1, quantityAvailable: 1,
      shippingFee: 1000, shippingDays: 2, price: 36000, cardKind: "CELEBRITY", personName: "周杰倫", seasonYear: "2023", brandSeries: "魔天倫",
      conditionTrack: "RAW", rawGrade: "B", publishedAt: published, photos: [["/demo/jay.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_keung", sellerId: "user_star", categoryId: "cat_idols", status: "ACTIVE", saleType: "BUY_NOW",
      title: "姜濤 TAG 9", description: "偶像卡，TAG 評級。", quantity: 1, quantityAvailable: 1,
      shippingFee: 800, shippingDays: 2, price: 52000, cardKind: "CELEBRITY", personName: "姜濤", seasonYear: "2024", brandSeries: "MIRROR",
      conditionTrack: "GRADED", grader: "TAG", gradeValue: 90, publishedAt: published, photos: [["/demo/keung.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
    {
      id: "seed_sold_zard", sellerId: "user_ming", categoryId: "cat_pokemon", status: "SOLD", saleType: "BUY_NOW",
      title: "噴火龍 已售示範", description: "用來展示站內成交價。", quantity: 1, quantityAvailable: 0,
      shippingFee: 2000, shippingDays: 3, price: 300000, cardKind: "TCG", game: "Pokémon", setName: "仰天峰", cardName: "噴火龍",
      language: "日文", conditionTrack: "RAW", rawGrade: "A", publishedAt: published, photos: [["/demo/sold.svg", "FRONT"], ["/demo/back.svg", "BACK"]],
    },
  ];

  for (const item of listings) {
    const { photos, id, ...data } = item;
    await prisma.listing.upsert({
      where: { id },
      update: data,
      create: { id, ...data } as never,
    });
    await prisma.listingPhoto.deleteMany({ where: { listingId: item.id } });
    await prisma.listingPhoto.createMany({
      data: photos.map(([url, role], position) => ({ listingId: item.id, url, role, position })),
    });
  }

  const proxies = [
    { bidderId: "user_alex", maxAmount: 80000, updatedAt: new Date("2026-10-01T00:00:00Z") },
    { bidderId: "user_mei", maxAmount: 120000, updatedAt: new Date("2026-10-01T01:00:00Z") },
  ];
  const resolved = resolveAuction(50000, proxies);
  for (const proxy of proxies) {
    await prisma.proxyBid.upsert({
      where: { listingId_bidderId: { listingId: "seed_luffy", bidderId: proxy.bidderId } },
      update: { maxAmount: proxy.maxAmount },
      create: { listingId: "seed_luffy", bidderId: proxy.bidderId, maxAmount: proxy.maxAmount, updatedAt: proxy.updatedAt },
    });
  }
  await prisma.listing.update({
    where: { id: "seed_luffy" },
    data: { currentBid: resolved.price, leaderId: resolved.leaderId },
  });
  await prisma.bidEvent.deleteMany({ where: { listingId: "seed_luffy" } });
  await prisma.bidEvent.createMany({
    data: [
      { listingId: "seed_luffy", bidderId: "user_alex", publicAmount: 50000, createdAt: new Date("2026-10-01T00:00:00Z") },
      { listingId: "seed_luffy", bidderId: "user_mei", publicAmount: resolved.price, createdAt: new Date("2026-10-01T01:00:00Z") },
    ],
  });

  await prisma.offer.upsert({
    where: { id: "seed_offer_alex" },
    update: { status: "PENDING", amount: 110000, expiresAt: hours(20), round: 1 },
    create: {
      id: "seed_offer_alex",
      listingId: "seed_charizard",
      buyerId: "user_alex",
      status: "PENDING",
      round: 1,
      amount: 110000,
      expiresAt: hours(20),
    },
  });

  const orderBase = {
    commissionBps: 800,
    paymentOutcome: "SUCCESS" as const,
    shipDays: 3,
    addressSnapshot: { recipient: "陳小美", phone: "+85293333333", line1: "軒尼詩道 1 號", district: "灣仔" },
  };
  await prisma.order.upsert({
    where: { id: "seed_order_sold" },
    update: {},
    create: {
      id: "seed_order_sold",
      buyerId: "user_mei",
      sellerId: "user_ming",
      status: "COMPLETED",
      source: "BUY_NOW",
      subtotal: 300000,
      shippingTotal: 2000,
      total: 302000,
      commissionAmount: 24000,
      sellerProceeds: 278000,
      ...orderBase,
      paidAt: new Date(Date.now() - 10 * 86400000),
      shippedAt: new Date(Date.now() - 8 * 86400000),
      completedAt: new Date(Date.now() - 6 * 86400000),
      escrowReleasedAt: new Date(Date.now() - 6 * 86400000),
      items: {
        create: [{
          listingId: "seed_sold_zard",
          title: "噴火龍 已售示範",
          unitPrice: 300000,
          quantity: 1,
          shippingFee: 2000,
          imageUrl: "/demo/sold.svg",
          conditionLabel: "Raw A",
          cardName: "噴火龍",
        }],
      },
    },
  });
  await prisma.review.upsert({
    where: { orderId_authorId: { orderId: "seed_order_sold", authorId: "user_mei" } },
    update: {},
    create: {
      orderId: "seed_order_sold",
      authorId: "user_mei",
      subjectId: "user_ming",
      stars: 5,
      comment: "寄貨準時，卡牌同描述一致。",
      reply: "多謝支持。",
      repliedAt: new Date(),
    },
  });

  await prisma.order.upsert({
    where: { id: "seed_order_shipped" },
    update: {},
    create: {
      id: "seed_order_shipped",
      buyerId: "user_mei",
      sellerId: "user_star",
      status: "SHIPPED",
      source: "BUY_NOW",
      subtotal: 52000,
      shippingTotal: 800,
      total: 52800,
      commissionAmount: 4160,
      sellerProceeds: 48640,
      ...orderBase,
      shipDays: 2,
      paidAt: new Date(Date.now() - 2 * 86400000),
      shipBy: new Date(Date.now() + 86400000),
      shippedAt: new Date(Date.now() - 86400000),
      autoReleaseAt: new Date(Date.now() + 6 * 86400000),
      items: {
        create: [{
          listingId: "seed_keung",
          title: "姜濤 TAG 9",
          unitPrice: 52000,
          quantity: 1,
          shippingFee: 800,
          imageUrl: "/demo/keung.svg",
          conditionLabel: "TAG 9",
          personName: "姜濤",
        }],
      },
    },
  });

  await prisma.order.upsert({
    where: { id: "seed_order_dispute" },
    update: {},
    create: {
      id: "seed_order_dispute",
      buyerId: "user_alex",
      sellerId: "user_ming",
      status: "DISPUTED",
      source: "BUY_NOW",
      subtotal: 36000,
      shippingTotal: 1000,
      total: 37000,
      commissionAmount: 2880,
      sellerProceeds: 34120,
      commissionBps: 800,
      paymentOutcome: "SUCCESS",
      shipDays: 2,
      paidAt: new Date(Date.now() - 86400000),
      addressSnapshot: orderBase.addressSnapshot,
      items: {
        create: [{
          listingId: "seed_jay",
          title: "周杰倫 Raw B",
          unitPrice: 36000,
          quantity: 1,
          shippingFee: 1000,
          imageUrl: "/demo/jay.svg",
          conditionLabel: "Raw B",
          personName: "周杰倫",
        }],
      },
    },
  });
  await prisma.dispute.upsert({
    where: { orderId: "seed_order_dispute" },
    update: {},
    create: { orderId: "seed_order_dispute", openerId: "user_alex", reason: "示範爭議：卡況同相片有落差。", status: "OPEN" },
  });

  await prisma.favorite.upsert({
    where: { userId_listingId: { userId: "user_mei", listingId: "seed_charizard" } },
    update: {},
    create: { userId: "user_mei", listingId: "seed_charizard" },
  });
  await prisma.follow.upsert({
    where: { followerId_sellerId: { followerId: "user_mei", sellerId: "user_ming" } },
    update: {},
    create: { followerId: "user_mei", sellerId: "user_ming" },
  });
  await prisma.cartItem.upsert({
    where: { userId_listingId: { userId: "user_mei", listingId: "seed_pikachu" } },
    update: { quantity: 1 },
    create: { userId: "user_mei", listingId: "seed_pikachu", quantity: 1 },
  });
  await prisma.searchHistory.deleteMany({ where: { userId: "user_mei", query: "噴火龍" } });
  await prisma.searchHistory.create({ data: { userId: "user_mei", query: "噴火龍" } });
  await prisma.viewHistory.upsert({
    where: { userId_listingId: { userId: "user_mei", listingId: "seed_charizard" } },
    update: { viewedAt: new Date() },
    create: { userId: "user_mei", listingId: "seed_charizard" },
  });

  const thread = await prisma.messageThread.upsert({
    where: { id: "seed_thread_mei" },
    update: {},
    create: { id: "seed_thread_mei", listingId: "seed_charizard", buyerId: "user_mei", sellerId: "user_ming" },
  });
  await prisma.message.upsert({
    where: { id: "seed_msg_1" },
    update: {},
    create: { id: "seed_msg_1", threadId: thread.id, senderId: "user_mei", body: "請問噴火龍可以看更多卡角嗎？", readAt: new Date() },
  });
  await prisma.message.upsert({
    where: { id: "seed_msg_2" },
    update: {},
    create: { id: "seed_msg_2", threadId: thread.id, senderId: "user_ming", body: "可以，相片已放正面同背面。" },
  });
  await prisma.notification.upsert({
    where: { id: "seed_note_mei" },
    update: {},
    create: { id: "seed_note_mei", userId: "user_mei", type: "message", title: "新訊息", body: "卡牌阿明回覆了你。", href: "/messages/seed_thread_mei" },
  });

  console.log("seeded TYSM");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
