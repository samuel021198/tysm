import { prisma } from "../lib/db";
import { placeBid } from "../lib/bids";
import { saveListing } from "../lib/listings";
import { advanceShipment, checkoutLines, confirmReceipt, payOrder } from "../lib/orders";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const seller = await prisma.user.findUnique({ where: { email: "ming@tysm.hk" } });
  const buyer = await prisma.user.findUnique({ where: { email: "mei@tysm.hk" } });
  const rival = await prisma.user.findUnique({ where: { email: "alex@tysm.hk" } });
  assert(seller && buyer && rival, "run prisma db seed first");
  const address = await prisma.address.findFirst({ where: { userId: buyer.id, isDefault: true } });
  assert(address, "buyer needs an address");

  const rejected = await saveListing(seller.id, {
    categoryId: "cat_pokemon",
    title: "缺背面的評級卡",
    description: "應該被拒絕",
    saleType: "BUY_NOW",
    priceCents: 10000,
    startPriceCents: null,
    auctionEndsAt: null,
    offersEnabled: false,
    minOfferCents: null,
    shippingDays: 2,
    shipSfCod: true,
    shipMeetup: false,
    shipPickup: false,
    meetupDistrict: null,
    meetupWindow: null,
    meetupNotes: null,
    quantity: 1,
    game: "Pokémon",
    setName: "Test",
    cardName: "測試",
    language: "日文",
    personName: null,
    seasonYear: null,
    brandSeries: null,
    conditionTrack: "GRADED",
    rawGrade: null,
    grader: "PSA",
    gradeValue: 100,
    certNumber: null,
    videoUrl: null,
    photos: [
      { url: "/demo/pikachu.svg", role: "FRONT" },
      { url: "/demo/charizard.svg", role: "GALLERY" },
    ],
    publishAt: null,
    intent: "publish",
  });
  assert(!rejected.ok && rejected.error === "front_back", "graded listing without a back photo must fail");

  const created = await saveListing(seller.id, {
    categoryId: "cat_pokemon",
    title: "煙霧測試卡",
    description: "自動化煙霧測試",
    saleType: "BUY_NOW",
    priceCents: 20000,
    startPriceCents: null,
    auctionEndsAt: null,
    offersEnabled: false,
    minOfferCents: null,
    shippingDays: 2,
    shipSfCod: true,
    shipMeetup: true,
    shipPickup: false,
    meetupDistrict: "油尖旺",
    meetupWindow: null,
    meetupNotes: null,
    quantity: 1,
    game: "Pokémon",
    setName: "Smoke",
    cardName: "測試卡",
    language: "日文",
    personName: null,
    seasonYear: null,
    brandSeries: null,
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
    certNumber: null,
    videoUrl: null,
    photos: [
      { url: "/demo/charizard.svg", role: "FRONT" },
      { url: "/demo/back.svg", role: "BACK" },
    ],
    publishAt: null,
    intent: "publish",
  });
  assert(created.ok, "create buy-now listing");
  const bought = await checkoutLines(buyer.id, [{ listingId: created.id, quantity: 1 }], null, false, {
    methods: { [seller.id]: "MEET" },
  });
  assert(bought.ok, "checkout");
  const paid = await payOrder(buyer.id, bought.ids[0], "success");
  assert(paid.ok && paid.kind === "success", "mock pay");
  const packed = await advanceShipment(seller.id, bought.ids[0], "pack");
  const shipped = await advanceShipment(seller.id, bought.ids[0], "ship");
  const done = await confirmReceipt(buyer.id, bought.ids[0]);
  assert(packed.ok && shipped.ok && done.ok, "escrow ship confirm");
  const order = await prisma.order.findUnique({ where: { id: bought.ids[0] } });
  assert(order?.status === "COMPLETED", "order completed");
  assert(order.commissionAmount === 1600 && order.sellerProceeds === 18400 && order.shippingTotal === 0, "8% commission on item price; platform shipping is HK$0");
  assert(order.shippingMethod === "MEET", "buyer keeps the meetup method");

  const auction = await saveListing(seller.id, {
    categoryId: "cat_pokemon",
    title: "煙霧拍賣卡",
    description: "拍賣煙霧測試",
    saleType: "AUCTION",
    priceCents: null,
    startPriceCents: 10000,
    auctionEndsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    offersEnabled: false,
    minOfferCents: null,
    shippingDays: 2,
    shipSfCod: true,
    shipMeetup: false,
    shipPickup: false,
    meetupDistrict: null,
    meetupWindow: null,
    meetupNotes: null,
    quantity: 1,
    game: "Pokémon",
    setName: "Smoke",
    cardName: "拍賣測試",
    language: "日文",
    personName: null,
    seasonYear: null,
    brandSeries: null,
    conditionTrack: "RAW",
    rawGrade: "B",
    grader: null,
    gradeValue: null,
    certNumber: null,
    videoUrl: null,
    photos: [
      { url: "/demo/luffy.svg", role: "FRONT" },
      { url: "/demo/back.svg", role: "BACK" },
    ],
    publishAt: null,
    intent: "publish",
  });
  assert(auction.ok, "create auction");
  const low = await placeBid(rival.id, auction.id, 10000);
  const high = await placeBid(buyer.id, auction.id, 30000);
  assert(low.ok && high.ok && high.leading, "proxy bid takes the lead");
  const listing = await prisma.listing.findUnique({ where: { id: auction.id } });
  assert(listing?.leaderId === buyer.id && listing.currentBid === 10500, "public price is one increment over the second max");

  await prisma.orderItem.deleteMany({ where: { orderId: bought.ids[0] } });
  await prisma.order.delete({ where: { id: bought.ids[0] } });
  await prisma.bidEvent.deleteMany({ where: { listingId: { in: [created.id, auction.id] } } });
  await prisma.proxyBid.deleteMany({ where: { listingId: auction.id } });
  await prisma.listing.deleteMany({ where: { id: { in: [created.id, auction.id] } } });
  console.log("smoke ok");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
