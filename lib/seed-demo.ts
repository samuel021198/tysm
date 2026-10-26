import { prisma } from "./db";
import { ensureDemoCatalog, dropPokemonDemoSeries } from "./dex-query";
import { linkCatalogListings } from "./dex-link";
import { conditionLabel, resolveAuction } from "./rules";
import { buildFulfillment, courierFor, mockTracking } from "./shipping";
import {
  EXTRA_CARD_CATEGORIES,
  LEAF_CATEGORIES,
  demoAddresses,
  demoCart,
  demoFavorites,
  demoFollows,
  demoListings,
  demoMessages,
  demoNotifications,
  demoOffers,
  demoSearches,
  demoStores,
  demoShowcaseCollections,
  demoShowcaseListings,
  demoShowcasePosts,
  demoShowcaseReviews,
  demoThreads,
  demoUsers,
  demoViews,
  type DemoListing,
} from "../prisma/demo-catalog";
import { DEMO_SHOWCASE_USER_ID } from "./demo-login";

const hoursFromNow = (value: number) => new Date(Date.now() + value * 60 * 60 * 1000);
const daysAgo = (value: number) => new Date(Date.now() - value * 86400000);
const CAT_ORDER = LEAF_CATEGORIES.map((row) => row[0]);

function publishedAt(item: DemoListing): Date {
  if (item.status !== "ACTIVE") return daysAgo(14);
  const catIndex = Math.max(0, CAT_ORDER.indexOf(item.categoryId as (typeof CAT_ORDER)[number]));
  const siblings = demoListings.filter((row) => row.categoryId === item.categoryId && row.status === "ACTIVE");
  const index = Math.max(0, siblings.findIndex((row) => row.id === item.id));
  return new Date(Date.now() - (catIndex + index * 8) * 3600 * 1000);
}

function listingData(item: DemoListing, resolved: { leaderId: string | null; price: number } | null) {
  return {
    sellerId: item.sellerId,
    categoryId: item.categoryId,
    status: item.status,
    saleType: item.saleType,
    title: item.title,
    description: item.description,
    quantity: item.quantity,
    quantityAvailable: item.quantityAvailable,
    shippingFee: item.shippingFee,
    shippingDays: item.shippingDays,
    shipLockerFee: item.shipLockerFee,
    shipMeetFee: item.shipMeetFee,
    shipSfCod: item.shipSfCod,
    shipMeetup: item.shipMeetup,
    shipPickup: item.shipPickup,
    meetupDistrict: item.meetupDistrict,
    meetupWindow: item.meetupWindow,
    meetupNotes: item.meetupNotes,
    cardNumber: item.cardNumber,
    rarity: item.rarity,
    price: item.price,
    offersEnabled: item.offersEnabled,
    minOffer: item.minOffer,
    startPrice: item.startPrice,
    auctionEndsAt: item.auctionHours != null ? hoursFromNow(item.auctionHours) : null,
    currentBid: resolved ? resolved.price : null,
    leaderId: resolved?.leaderId ?? null,
    auctionSettled: false,
    bidsVoided: false,
    binLockOrderId: null,
    cardKind: item.cardKind,
    game: item.game,
    setName: item.setName,
    cardName: item.cardName,
    language: item.language,
    personName: item.personName,
    seasonYear: item.seasonYear,
    brandSeries: item.brandSeries,
    conditionTrack: item.conditionTrack,
    rawGrade: item.rawGrade,
    grader: item.grader,
    gradeValue: item.gradeValue,
    certNumber: item.certNumber,
    videoUrl: null,
    publishedAt: publishedAt(item),
    viewCount: item.viewCount,
  };
}

function bidEvents(item: DemoListing) {
  if (item.startPrice == null || item.bids.length === 0) return [];
  const ordered = [...item.bids].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return ordered.map((bid, index) => {
    const slice = ordered.slice(0, index + 1).map((row) => ({
      bidderId: row.bidderId,
      maxAmount: row.maxAmount,
      updatedAt: new Date(row.at),
    }));
    const resolved = resolveAuction(item.startPrice ?? 0, slice);
    return {
      id: `${item.id}_evt_${index}`,
      listingId: item.id,
      bidderId: resolved.leaderId ?? bid.bidderId,
      publicAmount: resolved.price,
      createdAt: new Date(bid.at),
    };
  });
}

async function seedOrders() {
  const byId = new Map(demoListings.map((item) => [item.id, item]));
  const snap = { recipient: "陳小美", phone: "+85293333333", line1: "軒尼詩道 1 號", district: "灣仔" };
  const orders = [
    {
      id: "seed_order_sold",
      itemId: "seed_oi_sold",
      buyerId: "user_mei",
      sellerId: "user_ming",
      listingId: "seed_sold_zard",
      status: "COMPLETED" as const,
      subtotal: 300000,
      shippingTotal: 0,
      total: 300000,
      commissionAmount: 24000,
      sellerProceeds: 276000,
      shipDays: 3,
      paidAt: daysAgo(10),
      shippedAt: daysAgo(8),
      completedAt: daysAgo(6),
      escrowReleasedAt: daysAgo(6),
      shipBy: daysAgo(9),
      autoReleaseAt: null,
      shippingMethod: "SF_COD",
      courierName: "順豐到付",
      trackingNumber: "SF85210023HK",
    },
    {
      id: "seed_order_shipped",
      itemId: "seed_oi_shipped",
      buyerId: "user_mei",
      sellerId: "user_star",
      listingId: "seed_keung",
      status: "SHIPPED" as const,
      subtotal: 52000,
      shippingTotal: 0,
      total: 52000,
      commissionAmount: 4160,
      sellerProceeds: 47840,
      shipDays: 2,
      paidAt: daysAgo(2),
      shippedAt: daysAgo(1),
      completedAt: null,
      escrowReleasedAt: null,
      shipBy: hoursFromNow(24),
      autoReleaseAt: hoursFromNow(24 * 6),
      shippingMethod: "MEET",
      courierName: "面交",
      trackingNumber: null,
    },
    {
      id: "seed_order_dispute",
      itemId: "seed_oi_dispute",
      buyerId: "user_alex",
      sellerId: "user_ming",
      listingId: "seed_jay",
      status: "DISPUTED" as const,
      subtotal: 36000,
      shippingTotal: 0,
      total: 36000,
      commissionAmount: 2880,
      sellerProceeds: 33120,
      shipDays: 2,
      paidAt: daysAgo(1),
      shippedAt: null,
      completedAt: null,
      escrowReleasedAt: null,
      shipBy: null,
      autoReleaseAt: null,
      shippingMethod: "SF_COD",
      courierName: null as string | null,
      trackingNumber: null as string | null,
    },
  ];
  const buyers = ["user_mei", "user_alex", "user_yuki", "user_ho", "user_oscar", "user_star", "user_ken", "user_wai", "user_lam", "user_ming"];
  for (const [index, listing] of demoListings.filter((item) => item.status === "SOLD" && item.id !== "seed_sold_zard").entries()) {
    const buyerId = buyers.filter((id) => id !== listing.sellerId)[index % 8];
    const subtotal = listing.price ?? 0;
    const shippingTotal = listing.shippingFee;
    const commissionAmount = Math.round((subtotal * 800) / 10000);
    const age = 4 + index * 5;
    orders.push({
      id: `seed_order_${listing.id}`,
      itemId: `seed_oi_${listing.id}`,
      buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      status: "COMPLETED",
      subtotal,
      shippingTotal,
      total: subtotal + shippingTotal,
      commissionAmount,
      sellerProceeds: subtotal - commissionAmount + shippingTotal,
      shipDays: listing.shippingDays,
      paidAt: daysAgo(age + 3),
      shippedAt: daysAgo(age + 1),
      completedAt: daysAgo(age),
      escrowReleasedAt: daysAgo(age),
      shipBy: daysAgo(age + 2),
      autoReleaseAt: null,
      shippingMethod: listing.shipPickup ? "PICKUP" : listing.shipMeetup && !listing.shipSfCod ? "MEET" : "SF_COD",
      courierName: courierFor(listing.shipPickup ? "PICKUP" : listing.shipMeetup && !listing.shipSfCod ? "MEET" : "SF_COD"),
      trackingNumber: mockTracking(listing.id, listing.shipPickup ? "PICKUP" : listing.shipMeetup && !listing.shipSfCod ? "MEET" : "SF_COD"),
    });
  }
  for (const order of orders) {
    const listing = byId.get(order.listingId);
    if (!listing) throw new Error(order.listingId);
    const data = {
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      source: "BUY_NOW" as const,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      total: order.total,
      commissionBps: 800,
      commissionAmount: order.commissionAmount,
      sellerProceeds: order.sellerProceeds,
      paymentOutcome: "SUCCESS" as const,
      shipDays: order.shipDays,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      escrowReleasedAt: order.escrowReleasedAt,
      shipBy: order.shipBy,
      autoReleaseAt: order.autoReleaseAt,
      shippingMethod: order.shippingMethod,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      fulfillment: buildFulfillment(
        order.shippingMethod === "MEET" || order.shippingMethod === "PICKUP" ? order.shippingMethod : "SF_COD",
        [{
          id: listing.id,
          title: listing.title,
          meetupDistrict: listing.meetupDistrict,
          meetupWindow: listing.meetupWindow,
          meetupNotes: listing.meetupNotes,
        }],
        listing.sellerId === "user_ken"
          ? { storeName: "旺角卡舖", storeDistrict: "油尖旺", storeLine1: "西洋菜南街 12 號 2 樓", storeHours: "每日 13:00–21:00" }
          : null,
      ) ?? undefined,
      paymentBrand: order.status === "DISPUTED" ? null : "FPS",
      payBy: null,
      addressSnapshot: snap,
    };
    await prisma.order.upsert({
      where: { id: order.id },
      update: data,
      create: { id: order.id, ...data },
    });
    const item = {
      listingId: listing.id,
      title: listing.title,
      unitPrice: order.subtotal,
      quantity: 1,
      shippingFee: order.shippingTotal,
      imageUrl: listing.photos[0]?.url ?? null,
      conditionLabel: conditionLabel(listing),
      cardName: listing.cardName,
      personName: listing.personName,
    };
    await prisma.orderItem.deleteMany({ where: { orderId: order.id, NOT: { id: order.itemId } } });
    await prisma.orderItem.upsert({
      where: { id: order.itemId },
      update: item,
      create: { id: order.itemId, orderId: order.id, ...item },
    });
  }
  await prisma.review.upsert({
    where: { orderId_authorId: { orderId: "seed_order_sold", authorId: "user_mei" } },
    update: { stars: 5, comment: "寄貨準時，卡牌同描述一致。", reply: "多謝支持。", repliedAt: new Date() },
    create: {
      id: "seed_review_sold",
      orderId: "seed_order_sold",
      authorId: "user_mei",
      subjectId: "user_ming",
      stars: 5,
      comment: "寄貨準時，卡牌同描述一致。",
      reply: "多謝支持。",
      repliedAt: new Date(),
    },
  });
  await prisma.dispute.upsert({
    where: { orderId: "seed_order_dispute" },
    update: { status: "OPEN", reason: "示範爭議：卡況同相片有落差。", openerId: "user_alex" },
    create: {
      id: "seed_dispute_jay",
      orderId: "seed_order_dispute",
      openerId: "user_alex",
      reason: "示範爭議：卡況同相片有落差。",
      status: "OPEN",
    },
  });
}

async function seedSocial() {
  for (const fav of demoFavorites) {
    await prisma.favorite.deleteMany({ where: { userId: fav.userId, listingId: fav.listingId, NOT: { id: fav.id } } });
    await prisma.favorite.upsert({ where: { id: fav.id }, update: {}, create: fav });
  }
  for (const row of demoCart) {
    await prisma.cartItem.deleteMany({ where: { userId: row.userId, listingId: row.listingId, NOT: { id: row.id } } });
    await prisma.cartItem.upsert({
      where: { id: row.id },
      update: { quantity: row.quantity },
      create: row,
    });
  }
  for (const row of demoFollows) {
    await prisma.follow.deleteMany({
      where: { followerId: row.followerId, sellerId: row.sellerId, NOT: { id: row.id } },
    });
    await prisma.follow.upsert({ where: { id: row.id }, update: {}, create: row });
  }
  for (const row of demoViews) {
    await prisma.viewHistory.deleteMany({ where: { userId: row.userId, listingId: row.listingId, NOT: { id: row.id } } });
    await prisma.viewHistory.upsert({
      where: { id: row.id },
      update: { viewedAt: new Date() },
      create: { ...row, viewedAt: new Date() },
    });
  }
  for (const row of demoSearches) {
    await prisma.searchHistory.deleteMany({ where: { userId: row.userId, query: row.query, NOT: { id: row.id } } });
    await prisma.searchHistory.upsert({
      where: { id: row.id },
      update: { query: row.query },
      create: row,
    });
  }
  for (const thread of demoThreads) {
    await prisma.messageThread.upsert({
      where: { id: thread.id },
      update: { listingId: thread.listingId, buyerId: thread.buyerId, sellerId: thread.sellerId },
      create: thread,
    });
  }
  for (const message of demoMessages) {
    const data = {
      threadId: message.threadId,
      senderId: message.senderId,
      body: message.body,
      readAt: message.read ? new Date() : null,
    };
    await prisma.message.upsert({
      where: { id: message.id },
      update: data,
      create: { id: message.id, ...data },
    });
  }
  for (const note of demoNotifications) {
    const data = {
      userId: note.userId,
      type: note.type,
      title: note.title,
      body: note.body,
      href: note.href,
      readAt: note.read ? new Date() : null,
    };
    await prisma.notification.upsert({
      where: { id: note.id },
      update: data,
      create: { id: note.id, ...data },
    });
  }
}

async function seedStories() {
  const rows = [
    { id: "story_ming_zard", authorId: "user_ming", imageUrl: "/demo/cards/seed_charizard.svg", ageHours: 2 },
    { id: "story_ming_mew", authorId: "user_ming", imageUrl: "/demo/cards/seed_mewtwo.svg", ageHours: 1 },
    { id: "story_star_messi", authorId: "user_star", imageUrl: "/demo/cards/seed_messi.svg", ageHours: 5 },
    { id: "story_mei_pika", authorId: "user_mei", imageUrl: "/demo/cards/seed_pikachu.svg", ageHours: 3 },
    { id: "story_lam_old", authorId: "user_lam", imageUrl: "/demo/cards/seed_jay.svg", ageHours: 30 },
  ];
  await prisma.storyView.deleteMany({ where: { storyId: { in: rows.map((row) => row.id) } } });
  for (const row of rows) {
    const createdAt = hoursFromNow(-row.ageHours);
    const data = {
      authorId: row.authorId,
      imageUrl: row.imageUrl,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    };
    await prisma.story.upsert({
      where: { id: row.id },
      update: data,
      create: { id: row.id, ...data },
    });
  }
}

async function seedShowcase() {
  const collections = new Map(demoShowcaseCollections.map((item) => [item.id, item]));
  for (const [index, item] of demoShowcaseListings.entries()) {
    const data = {
      sellerId: DEMO_SHOWCASE_USER_ID,
      categoryId: "cat_idols",
      status: "ACTIVE" as const,
      saleType: "BUY_NOW" as const,
      title: item.title,
      description: item.description,
      quantity: 1,
      quantityAvailable: 1,
      shippingFee: 0,
      shippingDays: 3,
      shipLockerFee: 0,
      shipMeetFee: 0,
      shipSfCod: true,
      shipMeetup: true,
      shipPickup: false,
      meetupDistrict: "油尖旺",
      meetupWindow: "週末下午",
      meetupNotes: "旺角站，請先傳訊息。",
      price: item.priceCents,
      offersEnabled: false,
      minOffer: null,
      startPrice: null,
      auctionEndsAt: null,
      currentBid: null,
      leaderId: null,
      auctionSettled: false,
      bidsVoided: false,
      binLockOrderId: null,
      cardKind: "CELEBRITY" as const,
      game: null,
      setName: null,
      cardName: null,
      language: null,
      personName: item.title,
      seasonYear: "2026",
      brandSeries: "生活",
      conditionTrack: "RAW" as const,
      rawGrade: "A" as const,
      grader: null,
      gradeValue: null,
      certNumber: null,
      videoUrl: null,
      publishedAt: daysAgo(index),
      viewCount: 36,
    };
    await prisma.listing.upsert({
      where: { id: item.id },
      update: data,
      create: { id: item.id, ...data },
    });
    const photoIds = item.photos.map((_, position) => `${item.id}_p${position}`);
    await prisma.listingPhoto.deleteMany({ where: { listingId: item.id, id: { notIn: photoIds } } });
    for (const [position, url] of item.photos.entries()) {
      const id = `${item.id}_p${position}`;
      await prisma.listingPhoto.upsert({
        where: { id },
        update: { url, role: position === 0 ? "FRONT" : "GALLERY", position },
        create: { id, listingId: item.id, url, role: position === 0 ? "FRONT" : "GALLERY", position },
      });
    }
  }

  const listingById = new Map(demoShowcaseListings.map((item) => [item.id, item]));
  for (const review of demoShowcaseReviews) {
    const listing = listingById.get(review.listingId);
    if (!listing) throw new Error(review.id);
    const subtotal = listing.priceCents;
    const commissionAmount = Math.round((subtotal * 800) / 10000);
    const age = review.ageDays;
    const order = {
      buyerId: review.authorId,
      sellerId: DEMO_SHOWCASE_USER_ID,
      status: "COMPLETED" as const,
      source: "BUY_NOW" as const,
      subtotal,
      shippingTotal: 0,
      total: subtotal,
      commissionBps: 800,
      commissionAmount,
      sellerProceeds: subtotal - commissionAmount,
      paymentOutcome: "SUCCESS" as const,
      shipDays: 3,
      paidAt: daysAgo(age + 3),
      shippedAt: daysAgo(age + 2),
      completedAt: daysAgo(age),
      escrowReleasedAt: daysAgo(age),
      shipBy: daysAgo(age + 1),
      autoReleaseAt: null,
      shippingMethod: "SF_COD",
      courierName: courierFor("SF_COD"),
      trackingNumber: mockTracking(review.orderId, "SF_COD"),
      paymentBrand: "FPS",
      payBy: null,
      addressSnapshot: { recipient: "示範買家", phone: "+85290000000", line1: "彌敦道 1 號", district: "油尖旺" },
    };
    await prisma.order.upsert({
      where: { id: review.orderId },
      update: order,
      create: { id: review.orderId, ...order },
    });
    const item = {
      listingId: listing.id,
      title: listing.title,
      unitPrice: subtotal,
      quantity: 1,
      shippingFee: 0,
      imageUrl: listing.photos[0] ?? null,
      conditionLabel: "Raw A",
      cardName: null,
      personName: listing.title,
    };
    await prisma.orderItem.deleteMany({ where: { orderId: review.orderId, NOT: { id: review.itemId } } });
    await prisma.orderItem.upsert({
      where: { id: review.itemId },
      update: item,
      create: { id: review.itemId, orderId: review.orderId, ...item },
    });
    const reply = review.reply;
    await prisma.review.upsert({
      where: { orderId_authorId: { orderId: review.orderId, authorId: review.authorId } },
      update: {
        subjectId: DEMO_SHOWCASE_USER_ID,
        stars: review.stars,
        comment: review.comment,
        reply,
        repliedAt: reply ? daysAgo(age) : null,
      },
      create: {
        id: review.id,
        orderId: review.orderId,
        authorId: review.authorId,
        subjectId: DEMO_SHOWCASE_USER_ID,
        stars: review.stars,
        comment: review.comment,
        reply,
        repliedAt: reply ? daysAgo(age) : null,
      },
    });
  }

  for (const item of demoShowcaseCollections) {
    const data = {
      ownerId: DEMO_SHOWCASE_USER_ID,
      listingId: null,
      visibility: item.visibility,
      title: item.title,
      note: "",
      conditionTrack: "RAW" as const,
      rawGrade: "A" as const,
      grader: null,
      gradeValue: null,
      cardName: item.title,
    };
    await prisma.collectionItem.upsert({
      where: { id: item.id },
      update: data,
      create: { id: item.id, ...data },
    });
    const photoIds = item.photos.map((_, position) => `${item.id}_${position}`);
    await prisma.collectionPhoto.deleteMany({ where: { itemId: item.id, id: { notIn: photoIds } } });
    for (const [position, url] of item.photos.entries()) {
      const id = `${item.id}_${position}`;
      await prisma.collectionPhoto.upsert({
        where: { id },
        update: { url, role: position === 0 ? "FRONT" : "GALLERY", position },
        create: { id, itemId: item.id, url, role: position === 0 ? "FRONT" : "GALLERY", position },
      });
    }
  }

  for (const post of demoShowcasePosts) {
    const item = collections.get(post.collectionId);
    if (!item) throw new Error(post.id);
    await prisma.post.deleteMany({ where: { collectionItemId: item.id, NOT: { id: post.id } } });
    const data = {
      authorId: DEMO_SHOWCASE_USER_ID,
      collectionItemId: item.id,
      body: post.body,
      createdAt: daysAgo(post.ageDays),
    };
    await prisma.post.upsert({
      where: { id: post.id },
      update: data,
      create: { id: post.id, ...data },
    });
    await prisma.postPhoto.deleteMany({ where: { postId: post.id } });
  }
}

async function seedFeed() {
  const linked = ["seed_charizard", "seed_pikachu", "seed_iu", "seed_messi", "seed_nami", "seed_mewtwo"];
  for (const listingId of linked) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { photos: { orderBy: { position: "asc" } } },
    });
    if (!listing) continue;
    const itemId = `col_${listingId}`;
    const postId = `post_${listingId}`;
    await prisma.collectionItem.deleteMany({ where: { listingId, NOT: { id: itemId } } });
    const data = {
      ownerId: listing.sellerId,
      listingId,
      visibility: "PUBLIC" as const,
      title: listing.title,
      note: "",
      conditionTrack: listing.conditionTrack,
      rawGrade: listing.rawGrade,
      grader: listing.grader,
      gradeValue: listing.gradeValue,
      cardName: listing.cardName || listing.personName || listing.title,
    };
    await prisma.collectionItem.upsert({
      where: { id: itemId },
      update: data,
      create: { id: itemId, ...data },
    });
    const photoIds = listing.photos.map((photo) => `${itemId}_${photo.position}`);
    await prisma.collectionPhoto.deleteMany({ where: { itemId, id: { notIn: photoIds } } });
    for (const photo of listing.photos) {
      const id = `${itemId}_${photo.position}`;
      await prisma.collectionPhoto.upsert({
        where: { id },
        update: { url: photo.url, role: photo.role, position: photo.position },
        create: { id, itemId, url: photo.url, role: photo.role, position: photo.position },
      });
    }
    await prisma.post.deleteMany({ where: { collectionItemId: itemId, NOT: { id: postId } } });
    await prisma.post.upsert({
      where: { id: postId },
      update: { authorId: listing.sellerId, collectionItemId: itemId, body: "" },
      create: { id: postId, authorId: listing.sellerId, collectionItemId: itemId, body: "" },
    });
  }

  await prisma.collectionItem.upsert({
    where: { id: "col_mei_eevee" },
    update: {
      ownerId: "user_mei",
      listingId: null,
      visibility: "PUBLIC",
      title: "伊布收藏",
      cardName: "伊布",
      note: "先收藏，未放賣。",
      conditionTrack: "RAW",
      rawGrade: "A",
      grader: null,
      gradeValue: null,
    },
    create: {
      id: "col_mei_eevee",
      ownerId: "user_mei",
      visibility: "PUBLIC",
      title: "伊布收藏",
      cardName: "伊布",
      note: "先收藏，未放賣。",
      conditionTrack: "RAW",
      rawGrade: "A",
    },
  });
  await prisma.collectionPhoto.upsert({
    where: { id: "col_mei_eevee_0" },
    update: { url: "/demo/cards/seed_eevee.svg", position: 0, role: "FRONT" },
    create: { id: "col_mei_eevee_0", itemId: "col_mei_eevee", url: "/demo/cards/seed_eevee.svg", position: 0, role: "FRONT" },
  });
  await prisma.post.deleteMany({ where: { collectionItemId: "col_mei_eevee", NOT: { id: "post_mei_eevee" } } });
  await prisma.post.upsert({
    where: { id: "post_mei_eevee" },
    update: { authorId: "user_mei", collectionItemId: "col_mei_eevee", body: "先收藏，未放賣。" },
    create: { id: "post_mei_eevee", authorId: "user_mei", collectionItemId: "col_mei_eevee", body: "先收藏，未放賣。" },
  });

  await prisma.post.deleteMany({ where: { collectionItemId: "col_ming_secret" } });
  await prisma.collectionItem.upsert({
    where: { id: "col_ming_secret" },
    update: {
      ownerId: "user_ming",
      listingId: null,
      visibility: "PRIVATE",
      title: "未公開噴火龍",
      cardName: "噴火龍",
      note: "",
      conditionTrack: "GRADED",
      rawGrade: null,
      grader: "PSA",
      gradeValue: 100,
    },
    create: {
      id: "col_ming_secret",
      ownerId: "user_ming",
      visibility: "PRIVATE",
      title: "未公開噴火龍",
      cardName: "噴火龍",
      conditionTrack: "GRADED",
      grader: "PSA",
      gradeValue: 100,
    },
  });
  await prisma.collectionPhoto.upsert({
    where: { id: "col_ming_secret_0" },
    update: { url: "/demo/cards/seed_charizard.svg", position: 0, role: "FRONT" },
    create: { id: "col_ming_secret_0", itemId: "col_ming_secret", url: "/demo/cards/seed_charizard.svg", position: 0, role: "FRONT" },
  });

  await prisma.post.upsert({
    where: { id: "post_mei_note" },
    update: { authorId: "user_mei", collectionItemId: null, body: "今日喺旺角睇卡，未決定收唔收。" },
    create: { id: "post_mei_note", authorId: "user_mei", body: "今日喺旺角睇卡，未決定收唔收。" },
  });
  await prisma.postPhoto.upsert({
    where: { id: "post_mei_note_0" },
    update: { url: "/demo/cards/seed_pikachu.svg", position: 0 },
    create: { id: "post_mei_note_0", postId: "post_mei_note", url: "/demo/cards/seed_pikachu.svg", position: 0 },
  });
  await seedStories();
  await prisma.postLike.upsert({
    where: { id: "like_mei_zard" },
    update: { postId: "post_seed_charizard", userId: "user_mei" },
    create: { id: "like_mei_zard", postId: "post_seed_charizard", userId: "user_mei" },
  });
  await prisma.postComment.upsert({
    where: { id: "cmt_mei_iu" },
    update: { postId: "post_seed_iu", authorId: "user_mei", body: "好靚，問下可唔可以約旺角？" },
    create: { id: "cmt_mei_iu", postId: "post_seed_iu", authorId: "user_mei", body: "好靚，問下可唔可以約旺角？" },
  });
}

export async function seedDemo() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@tysm.hk").split(",")[0].trim().toLowerCase();
  const adminPhone = process.env.ADMIN_PHONE || "+85260000000";

  await prisma.siteSetting.upsert({
    where: { key: "commission_percent" },
    update: { value: "8" },
    create: { key: "commission_percent", value: "8" },
  });

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

  for (const user of demoUsers) {
    const email = "email" in user ? user.email : adminEmail;
    const phone = "phone" in user ? user.phone : adminPhone;
    const data = {
      email,
      phone,
      nickname: user.nickname,
      role: user.role,
      phoneVerified: user.phoneVerified,
      emailVerified: true,
      termsAcceptedAt: new Date(),
      bio: user.bio,
      payoutMethod: user.phoneVerified ? "FPS" : null,
      payoutHolder: user.phoneVerified ? user.nickname : null,
      payoutAccount: user.phoneVerified ? phone : null,
      storeName: null,
      storeDistrict: null,
      storeLine1: null,
      storeHours: null,
      consecutiveUnpaid: 0,
      bidBanned: false,
      ...("avatarUrl" in user && user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
    await prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: { id: user.id, ...data },
    });
  }

  for (const store of demoStores) {
    await prisma.user.update({
      where: { id: store.userId },
      data: {
        storeName: store.storeName,
        storeDistrict: store.storeDistrict,
        storeLine1: store.storeLine1,
        storeHours: store.storeHours,
      },
    });
  }

  for (const address of demoAddresses) {
    const { id, ...rest } = address;
    await prisma.address.upsert({
      where: { id },
      update: rest,
      create: { id, ...rest, isDefault: true },
    });
  }

  const listingIds = demoListings.map((item) => item.id);
  const auctionIds = demoListings
    .filter((item) => item.status === "ACTIVE" && item.saleType !== "BUY_NOW")
    .map((item) => item.id);
  const stray = await prisma.order.findMany({
    where: {
      source: "AUCTION",
      status: "PENDING_PAYMENT",
      id: { notIn: ["seed_order_sold", "seed_order_shipped", "seed_order_dispute"] },
      items: { every: { listingId: { in: auctionIds } }, some: { listingId: { in: auctionIds } } },
    },
    select: { id: true },
  });
  if (stray.length) {
    const ids = stray.map((order) => order.id);
    await prisma.notification.deleteMany({ where: { href: { in: ids.map((id) => `/orders/${id}`) } } });
    await prisma.offer.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
    await prisma.review.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.dispute.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  let photos = 0;
  let proxyBids = 0;
  let bidEventCount = 0;
  for (const item of demoListings) {
    const proxies = item.bids.map((bid) => ({
      bidderId: bid.bidderId,
      maxAmount: bid.maxAmount,
      updatedAt: new Date(bid.at),
    }));
    const resolved = proxies.length && item.startPrice != null ? resolveAuction(item.startPrice, proxies) : null;
    const data = listingData(item, resolved);
    await prisma.listing.upsert({
      where: { id: item.id },
      update: data,
      create: { id: item.id, ...data },
    });
    const photoIds = item.photos.map((photo) => photo.id);
    await prisma.listingPhoto.deleteMany({ where: { listingId: item.id, id: { notIn: photoIds } } });
    for (const photo of item.photos) {
      await prisma.listingPhoto.upsert({
        where: { id: photo.id },
        update: { url: photo.url, role: photo.role, position: photo.position },
        create: { listingId: item.id, ...photo },
      });
    }
    photos += item.photos.length;
    const proxyIds = item.bids.map((bid) => bid.id);
    await prisma.proxyBid.deleteMany({
      where: proxyIds.length ? { listingId: item.id, id: { notIn: proxyIds } } : { listingId: item.id },
    });
    for (const bid of item.bids) {
      await prisma.proxyBid.upsert({
        where: { listingId_bidderId: { listingId: item.id, bidderId: bid.bidderId } },
        update: { maxAmount: bid.maxAmount, updatedAt: new Date(bid.at) },
        create: {
          id: bid.id,
          listingId: item.id,
          bidderId: bid.bidderId,
          maxAmount: bid.maxAmount,
          updatedAt: new Date(bid.at),
        },
      });
    }
    proxyBids += item.bids.length;
    const events = bidEvents(item);
    const eventIds = events.map((event) => event.id);
    await prisma.bidEvent.deleteMany({
      where: eventIds.length ? { listingId: item.id, id: { notIn: eventIds } } : { listingId: item.id },
    });
    for (const event of events) {
      await prisma.bidEvent.upsert({
        where: { id: event.id },
        update: { bidderId: event.bidderId, publicAmount: event.publicAmount, createdAt: event.createdAt },
        create: event,
      });
    }
    bidEventCount += events.length;
  }

  const offerIds = demoOffers.map((offer) => offer.id);
  await prisma.offer.deleteMany({ where: { listingId: { in: listingIds }, id: { notIn: offerIds } } });
  for (const offer of demoOffers) {
    const data = {
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      status: offer.status,
      round: offer.round,
      amount: offer.amount,
      counterAmount: offer.counterAmount,
      expiresAt: hoursFromNow(offer.hours),
      orderId: null,
    };
    await prisma.offer.upsert({
      where: { id: offer.id },
      update: data,
      create: { id: offer.id, ...data },
    });
  }

  await seedOrders();
  await seedSocial();
  await seedFeed();
  await seedShowcase();

  const favCounts = await prisma.favorite.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listingIds } },
    _count: { _all: true },
  });
  const favMap = new Map(favCounts.map((row) => [row.listingId, row._count._all]));
  for (const id of listingIds) {
    await prisma.listing.update({ where: { id }, data: { favoriteCount: favMap.get(id) ?? 0 } });
  }

  const catalogLinks = await linkCatalogListings();
  await ensureDemoCatalog();
  await dropPokemonDemoSeries();
  const active = demoListings.filter((item) => item.status === "ACTIVE");
  const byCategory: Record<string, number> = {};
  for (const item of active) byCategory[item.categoryId] = (byCategory[item.categoryId] ?? 0) + 1;
  return {
    users: demoUsers.length,
    categories: 1 + groups.length + LEAF_CATEGORIES.length + EXTRA_CARD_CATEGORIES.length,
    listings: demoListings.length,
    activeListings: active.length,
    buyNow: active.filter((item) => item.saleType === "BUY_NOW").length,
    auctions: active.filter((item) => item.saleType === "AUCTION").length,
    both: active.filter((item) => item.saleType === "BOTH").length,
    withBids: active.filter((item) => item.bids.length > 0).length,
    offerEnabled: active.filter((item) => item.offersEnabled).length,
    raw: active.filter((item) => item.conditionTrack === "RAW").length,
    graded: active.filter((item) => item.conditionTrack === "GRADED").length,
    photos,
    proxyBids,
    bidEvents: bidEventCount,
    offers: demoOffers.length,
    orders: 3 + demoListings.filter((item) => item.status === "SOLD" && item.id !== "seed_sold_zard").length,
    threads: demoThreads.length,
    messages: demoMessages.length,
    notifications: demoNotifications.length,
    favorites: demoFavorites.length,
    cartItems: demoCart.length,
    follows: demoFollows.length,
    stories: 5,
    showcasePosts: demoShowcasePosts.length,
    showcaseCollections: demoShowcaseCollections.length,
    showcaseListings: demoShowcaseListings.length,
    showcaseReviews: demoShowcaseReviews.length,
    byCategory,
    clearedAuctionOrders: stray.length,
    catalogLinkedListings: catalogLinks.listings,
    catalogLinkedCollection: catalogLinks.collectionItems,
  };
}
