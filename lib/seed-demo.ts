import { DEMO_ACCOUNTS, TRIAL_ACCOUNTS } from "./demo-login";
import { prisma } from "./db";
import { ensureDemoCatalog } from "./dex-query";
import { NEWS_SAMPLES } from "./news";
import { courierFor, mockTracking } from "./shipping";
import {
  EXTRA_CARD_CATEGORIES,
  LEAF_CATEGORIES,
  demoAddresses,
  demoFavorites,
  demoFollows,
  demoMessages,
  demoNotifications,
  demoRankLikes,
  demoRankOrders,
  demoSearches,
  demoShowcaseCollections,
  demoShowcaseListings,
  demoShowcasePosts,
  demoShowcaseReviews,
  demoStores,
  demoThreads,
  demoUsers,
} from "../prisma/demo-catalog";

const daysAgo = (value: number) => new Date(Date.now() - value * 86400000);
const hoursAgo = (value: number) => new Date(Date.now() - value * 60 * 60 * 1000);

/** Clears accounts and their content. Catalog sets, catalog cards, categories, and site settings stay. */
export async function wipeUserContent() {
  await prisma.storyView.deleteMany();
  await prisma.story.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.postComment.deleteMany();
  await prisma.postPhoto.deleteMany();
  await prisma.feedHide.deleteMany();
  await prisma.post.deleteMany();
  await prisma.collectionPhoto.deleteMany();
  await prisma.collectionItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.block.deleteMany();
  await prisma.report.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.viewHistory.deleteMany();
  await prisma.outboundStub.deleteMany();
  await prisma.address.deleteMany();
  await prisma.proxyBid.deleteMany();
  await prisma.bidEvent.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listingItem.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.usernameChange.deleteMany();
  await prisma.user.deleteMany();
}

async function seedShowcase() {
  for (const [index, item] of demoShowcaseListings.entries()) {
    const data = {
      sellerId: item.ownerId,
      categoryId: item.categoryId ?? "cat_idols",
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
      cardKind: item.cardKind ?? "CELEBRITY",
      game: item.game ?? null,
      setName: item.setName ?? null,
      cardName: item.cardName ?? null,
      language: item.language ?? null,
      personName: item.cardKind && item.cardKind !== "CELEBRITY" ? item.personName ?? null : item.personName ?? item.title,
      seasonYear: "2026",
      brandSeries: "實拍",
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
      sellerId: listing.ownerId,
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
    await prisma.review.upsert({
      where: { orderId_authorId: { orderId: review.orderId, authorId: review.authorId } },
      update: {
        subjectId: listing.ownerId,
        stars: review.stars,
        comment: review.comment,
        reply: review.reply,
        repliedAt: review.reply ? daysAgo(age) : null,
      },
      create: {
        id: review.id,
        orderId: review.orderId,
        authorId: review.authorId,
        subjectId: listing.ownerId,
        stars: review.stars,
        comment: review.comment,
        reply: review.reply,
        repliedAt: review.reply ? daysAgo(age) : null,
      },
    });
  }

  for (const item of demoShowcaseCollections) {
    const data = {
      ownerId: item.ownerId,
      listingId: item.listingId ?? null,
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

  const collections = new Map(demoShowcaseCollections.map((item) => [item.id, item]));
  for (const post of demoShowcasePosts) {
    const item = collections.get(post.collectionId);
    if (!item || item.ownerId !== post.ownerId) throw new Error(post.id);
    await prisma.post.deleteMany({ where: { collectionItemId: item.id, NOT: { id: post.id } } });
    const data = {
      authorId: post.ownerId,
      collectionItemId: item.id,
      body: post.body,
      tags: post.tags,
      createdAt: daysAgo(post.ageDays),
    };
    await prisma.post.upsert({
      where: { id: post.id },
      update: data,
      create: { id: post.id, ...data },
    });
    await prisma.postPhoto.deleteMany({ where: { postId: post.id } });
  }

  const storyOwners = new Set<string>();
  for (const item of demoShowcaseCollections) {
    if (item.visibility !== "PUBLIC" || storyOwners.has(item.ownerId)) continue;
    storyOwners.add(item.ownerId);
    const id = `story_${item.ownerId}`;
    const createdAt = daysAgo(0);
    const data = {
      authorId: item.ownerId,
      imageUrl: item.photos[0],
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 22 * 60 * 60 * 1000),
    };
    await prisma.story.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }
}

async function seedRank() {
  const listings = new Map(demoShowcaseListings.map((item) => [item.id, item]));
  for (const row of demoRankOrders) {
    const listing = listings.get(row.listingId);
    if (!listing || listing.ownerId !== row.sellerId || row.buyerId === row.sellerId) throw new Error(row.id);
    const paidAt = hoursAgo(row.hoursAgo);
    const subtotal = listing.priceCents * row.quantity;
    const order = {
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      status: "COMPLETED" as const,
      source: "BUY_NOW" as const,
      subtotal,
      shippingTotal: 0,
      total: subtotal,
      commissionBps: 0,
      commissionAmount: 0,
      sellerProceeds: subtotal,
      paymentOutcome: "NONE" as const,
      shipDays: 3,
      paidAt,
      shippedAt: paidAt,
      completedAt: paidAt,
      escrowReleasedAt: null,
      shipBy: null,
      autoReleaseAt: null,
      shippingMethod: "MEET",
      courierName: courierFor("MEET"),
      trackingNumber: null,
      paymentBrand: null,
      payBy: null,
      addressSnapshot: { recipient: "示範買家", phone: "+85290000000", line1: "彌敦道 1 號", district: "油尖旺" },
      createdAt: paidAt,
    };
    await prisma.order.upsert({
      where: { id: row.id },
      update: order,
      create: { id: row.id, ...order },
    });
    const item = {
      listingId: listing.id,
      title: listing.title,
      unitPrice: listing.priceCents,
      quantity: row.quantity,
      shippingFee: 0,
      imageUrl: listing.photos[0] ?? null,
      conditionLabel: "Raw A",
      cardName: listing.cardName ?? null,
      personName: listing.personName ?? listing.title,
    };
    const itemId = `${row.id}_item`;
    await prisma.orderItem.deleteMany({ where: { orderId: row.id, NOT: { id: itemId } } });
    await prisma.orderItem.upsert({
      where: { id: itemId },
      update: item,
      create: { id: itemId, orderId: row.id, ...item },
    });
  }

  const posts = new Map(demoShowcasePosts.map((post) => [post.id, post]));
  for (const like of demoRankLikes) {
    const post = posts.get(like.postId);
    if (!post || post.ownerId === like.userId) throw new Error(like.id);
    const createdAt = hoursAgo(like.hoursAgo);
    await prisma.postLike.upsert({
      where: { postId_userId: { postId: like.postId, userId: like.userId } },
      update: { createdAt },
      create: { id: like.id, postId: like.postId, userId: like.userId, createdAt },
    });
  }
}

async function attachShowcaseDex() {
  for (const item of demoShowcaseCollections) {
    await prisma.collectionItem.update({
      where: { id: item.id },
      data: { catalogCardId: item.catalogCardId ?? null },
    });
  }
  for (const item of demoShowcaseListings) {
    await prisma.listing.update({
      where: { id: item.id },
      data: { catalogCardId: item.catalogCardId ?? null },
    });
  }
}

async function seedSocial() {
  for (const thread of demoThreads) {
    const data = { listingId: thread.listingId, buyerId: thread.buyerId, sellerId: thread.sellerId };
    await prisma.messageThread.upsert({
      where: { id: thread.id },
      update: data,
      create: { id: thread.id, ...data },
    });
  }
  for (const [index, message] of demoMessages.entries()) {
    const data = {
      threadId: message.threadId,
      senderId: message.senderId,
      body: message.body,
      readAt: message.read ? daysAgo(1) : null,
      createdAt: new Date(Date.now() - (demoMessages.length - index) * 60_000),
    };
    await prisma.message.upsert({
      where: { id: message.id },
      update: { senderId: data.senderId, body: data.body, readAt: data.readAt },
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
      readAt: note.read ? daysAgo(1) : null,
    };
    await prisma.notification.upsert({
      where: { id: note.id },
      update: data,
      create: { id: note.id, ...data },
    });
  }
  for (const row of demoFavorites) {
    await prisma.favorite.upsert({
      where: { id: row.id },
      update: { userId: row.userId, listingId: row.listingId },
      create: row,
    });
  }
  for (const row of demoSearches) {
    await prisma.searchHistory.upsert({
      where: { id: row.id },
      update: { userId: row.userId, query: row.query },
      create: row,
    });
  }
}

async function seedNews() {
  for (const row of NEWS_SAMPLES) {
    const data = {
      slug: row.slug,
      title: row.title,
      source: row.source,
      teaser: row.teaser,
      body: row.body,
      coverUrl: row.coverUrl,
      brandColor: row.brandColor,
      linkUrl: row.linkUrl,
      tag: row.tag,
      eventAt: row.eventAt,
      hot: row.hot,
    };
    await prisma.newsItem.upsert({
      where: { id: row.id },
      update: data,
      create: { id: row.id, ...data },
    });
  }
}

export async function seedDemo() {
  const catalogCardsBefore = await prisma.catalogCard.count();
  const catalogSetsBefore = await prisma.catalogSet.count();
  await wipeUserContent();

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

  const stores = new Map(demoStores.map((row) => [row.userId, row]));
  const handles = new Map<string, string>([...DEMO_ACCOUNTS, ...TRIAL_ACCOUNTS].map((row) => [row.id, row.handle]));
  for (const user of demoUsers) {
    const email = "email" in user ? user.email : adminEmail;
    const phone = "phone" in user ? user.phone : adminPhone;
    const store = stores.get(user.id);
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
      storeName: store?.storeName ?? null,
      storeDistrict: store?.storeDistrict ?? null,
      storeLine1: store?.storeLine1 ?? null,
      storeHours: store?.storeHours ?? null,
      handoverPlace: store?.storeDistrict ?? null,
      ...(handles.get(user.id) ? { username: handles.get(user.id) } : {}),
      consecutiveUnpaid: 0,
      bidBanned: false,
      avatarUrl: "avatarUrl" in user ? user.avatarUrl : null,
    };
    await prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: { id: user.id, ...data },
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

  for (const row of demoFollows) {
    await prisma.follow.upsert({
      where: { id: row.id },
      update: { followerId: row.followerId, sellerId: row.sellerId },
      create: row,
    });
  }

  await seedShowcase();
  await seedRank();
  await ensureDemoCatalog();
  await attachShowcaseDex();
  await seedSocial();
  await seedNews();

  const catalogCardsAfter = await prisma.catalogCard.count();
  const catalogSetsAfter = await prisma.catalogSet.count();
  return {
    wiped: true,
    users: await prisma.user.count(),
    demoAccounts: demoUsers.filter((user) => user.role === "USER").length,
    adminKept: demoUsers.filter((user) => user.role === "ADMIN").length,
    posts: demoShowcasePosts.length,
    collections: demoShowcaseCollections.length,
    listings: demoShowcaseListings.length,
    reviews: demoShowcaseReviews.length,
    follows: demoFollows.length,
    threads: demoThreads.length,
    messages: demoMessages.length,
    notifications: demoNotifications.length,
    favorites: demoFavorites.length,
    addresses: demoAddresses.length,
    shops: demoStores.length,
    rankOrders: demoRankOrders.length,
    rankLikes: demoRankLikes.length,
    stories: demoUsers.filter((user) => user.role === "USER").length,
    catalogCardsBefore,
    catalogCardsAfter,
    catalogSetsBefore,
    catalogSetsAfter,
  };
}
