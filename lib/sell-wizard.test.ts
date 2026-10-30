import {
  listingCatalogId,
  parseListingForm,
  validateListing,
  wizardFocusField,
  wizardPanels,
  wizardPublishIssues,
  wizardStepForIssue,
  wizardStepIssues,
  type CardItemInput,
  type ListingInput,
} from "./sell-wizard";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function item(over: Partial<CardItemInput> = {}): CardItemInput {
  return {
    cardName: "噴火龍",
    catalogCardId: null,
    catalogTitle: null,
    year: null,
    setName: "151",
    setCode: null,
    collectorNumber: null,
    rarity: null,
    language: "日文",
    game: "Pokémon",
    priceCents: 5000,
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: null,
    gradeValue: null,
    certNumber: null,
    ...over,
  };
}

function card(over: Partial<ListingInput> = {}): ListingInput {
  return {
    categoryId: "cat_pokemon",
    title: "噴火龍",
    description: "近全新，見相。",
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
    setName: "151",
    cardName: "噴火龍",
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
      { url: "/demo/cards/seed_charizard.svg", role: "FRONT" },
      { url: "/demo/cards/seed_charizard-back.svg", role: "BACK" },
    ],
    publishAt: null,
    intent: "publish",
    ...over,
  };
}

const now = new Date("2026-06-01T04:00:00Z");
const later = new Date("2026-06-01T08:00:00Z");
const onePhoto = [{ url: "/demo/cards/seed_charizard.svg", role: "GALLERY" as const }];

const basics = wizardStepIssues(0, card({ photos: [] }), "tcg", now);
assert(basics.includes("photos") && !basics.includes("title"), "basics step blocks on photos, not a valid title");
assert(
  !wizardStepIssues(0, card({ photos: onePhoto }), "tcg", now).includes("photos"),
  "one photo is enough",
);
assert(
  wizardStepIssues(0, card({ photos: [{ url: "http://cdn.example/a.jpg", role: "GALLERY" }] }), "tcg", now).includes("photo_url"),
  "http photos are rejected",
);
assert(
  !wizardPublishIssues(
    card({
      conditionTrack: "GRADED",
      rawGrade: null,
      grader: "PSA",
      gradeValue: 100,
      photos: onePhoto,
    }),
    "tcg",
    now,
  ).includes("front_back"),
  "a graded card does not need a separate back photo",
);
assert(wizardStepIssues(0, card({ photos: onePhoto, description: "" }), "tcg", now).length === 0, "title, one photo, and a blank description pass basics");
assert(wizardStepIssues(0, card({ title: "卡", description: "", game: "" }), "tcg", now).join() === "title", "a short title is the only basics issue");
assert(wizardPublishIssues(card({ description: "x".repeat(5001) }), "tcg", now).includes("description"), "description still has a ceiling");

const cardStep = wizardStepIssues(1, card({ title: "卡", description: " ", game: "", videoUrl: "http://v.example/a" }), "tcg", now);
assert(cardStep.includes("tcg") && !cardStep.includes("title") && !cardStep.includes("description") && !cardStep.includes("video"), "card step names the catalog gap and leaves basics alone");
assert(!cardStep.includes("price"), "card step ignores the listing price");
assert(
  wizardStepIssues(1, card({ conditionTrack: "GRADED", rawGrade: null, grader: "PSA", gradeValue: null }), "tcg", now).includes("grade"),
  "graded score is required when the old form omits items",
);
assert(wizardStepIssues(1, card(), "tcg", now).length === 0, "complete raw tcg details pass");
assert(
  wizardStepIssues(
    1,
    card({
      game: null,
      setName: null,
      cardName: null,
      language: null,
      personName: "美斯",
      seasonYear: "2022",
      brandSeries: "Topps",
    }),
    "athlete",
    now,
  ).length === 0,
  "athlete cards use person fields",
);
assert(
  wizardPublishIssues(card({ game: "", setName: "", cardName: "", language: "", items: [item({ game: null, setName: null, cardName: null, language: null })] }), "tcg", now).includes("tcg") === false,
  "the four-step form does not require a catalog match",
);
assert(
  wizardPublishIssues(card({ rawGrade: null, items: [item({ rawGrade: null })] }), "tcg", now).includes("grade") === false,
  "a raw card on the new form can omit the grade",
);
assert(
  wizardStepIssues(1, card({ items: [item({ conditionTrack: "GRADED", rawGrade: null, grader: "PSA", gradeValue: null })] }), "tcg", now).includes("grade"),
  "a graded row still needs a score",
);

const multi = card({ priceCents: null, items: [item(), item({ cardName: "皮卡丘", priceCents: null })] });
assert(wizardPublishIssues(multi, "tcg", now).includes("card_price") && !wizardPublishIssues(multi, "tcg", now).includes("price"), "two cards need a price on each card");
assert(wizardStepIssues(1, multi, "tcg", now).includes("card_price"), "per-card price sits on the card step");
assert(wizardPublishIssues(card({ priceCents: null, items: [item(), item({ cardName: "皮卡丘" })] }), "tcg", now).length === 0, "multi-card prices replace the listing price");

assert(wizardStepIssues(0, card({ priceCents: null }), "tcg", now).includes("price"), "buy now needs a price on basics");
const auctionGaps = wizardStepIssues(0, card({ saleType: "AUCTION", priceCents: null, quantity: 2 }), "tcg", now);
assert(auctionGaps.includes("start") && auctionGaps.includes("qty") && !auctionGaps.includes("auction_end"), "auction floor and quantity sit on basics");
assert(
  wizardStepIssues(3, card({ saleType: "AUCTION", priceCents: null, startPriceCents: null, auctionEndsAt: null }), "tcg", now).includes("auction_end"),
  "auction end is checked before publish",
);
assert(
  wizardPublishIssues(card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionEndsAt: later }), "tcg", now).length === 0,
  "auction with a floor and end passes",
);
assert(
  wizardStepIssues(0, card({ saleType: "BOTH", startPriceCents: 10000, auctionEndsAt: later }), "tcg", now).includes("both_price"),
  "buy now must be above the start price",
);
assert(
  wizardPublishIssues(card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionDays: 3, auctionEndsAt: null }), "tcg", now).length === 0,
  "a 3-day auction does not need a custom end",
);
assert(
  wizardPublishIssues(card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionDays: 14, auctionEndsAt: null }), "tcg", now).includes("auction_days"),
  "a 14-day auction is not a chip length",
);
assert(
  wizardStepIssues(0, card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionDays: 2, auctionEndsAt: null }), "tcg", now).includes("auction_days"),
  "2 days is not 1, 3, 5, or 7",
);
assert(
  wizardStepIssues(0, card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionDays: 15, auctionEndsAt: null }), "tcg", now).includes("auction_days"),
  "duration outside 1, 3, 5, or 7 is rejected",
);
assert(
  wizardStepIssues(0, card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionDays: 3, reserveCents: 1000, auctionEndsAt: null }), "tcg", now).includes("reserve"),
  "reserve cannot sit under the start price",
);
assert(
  wizardStepIssues(0, card({ offersEnabled: true, minOfferCents: 10000 }), "tcg", now).includes("offer"),
  "minimum offer must be below buy now",
);

assert(wizardStepIssues(2, card({ shipSfCod: false }), "tcg", now).includes("shipping"), "at least one shipping method");
assert(wizardStepIssues(2, card({ shipSfCod: false, shipMeetup: true }), "tcg", now).includes("meetup"), "meetup needs a district");
assert(
  wizardStepIssues(2, card({ shipSfCod: false, shipMeetup: true, meetupDistrict: "油尖旺" }), "tcg", now).length === 0,
  "meetup with a district passes",
);
assert(
  wizardStepIssues(2, card({ shipSfCod: false, shipPickup: true }), "tcg", now, false).includes("store"),
  "store pickup needs a shop address",
);
assert(
  wizardStepIssues(2, card({ shipSfCod: false, shipPickup: true }), "tcg", now, true).length === 0,
  "store pickup passes when the profile has an address",
);
assert(wizardStepIssues(2, card(), "tcg", now).length === 0, "default shipping passes");
assert(wizardPublishIssues(card(), "tcg", now).includes("ship_within") === false, "older callers can keep a shippingDays value that is not 3, 7, or 30");
assert(wizardPublishIssues(card({ stockType: "IN_STOCK", shipWithinDays: null }), "tcg", now).includes("ship_within"), "in stock needs 3, 7, or 30 days");
assert(wizardPublishIssues(card({ stockType: "IN_STOCK", shipWithinDays: 2 }), "tcg", now).includes("ship_within"), "two-day shipping is not a stock window");
assert(wizardPublishIssues(card({ stockType: "IN_STOCK", shipWithinDays: 7 }), "tcg", now).length === 0, "seven-day shipping passes");
assert(wizardPublishIssues(card({ stockType: "PREORDER" }), "tcg", now).includes("preorder"), "preorder needs a ship date");
assert(
  wizardPublishIssues(card({ stockType: "PREORDER", preorderShipDate: new Date("2026-05-30T16:00:00Z") }), "tcg", now).includes("preorder"),
  "a past ship date is rejected",
);
assert(
  wizardPublishIssues(card({ stockType: "PREORDER", preorderShipDate: new Date("2026-06-01T16:00:00Z") }), "tcg", now).length === 0,
  "a Hong Kong ship date of today or later passes",
);

const ready = card();
assert(wizardPublishIssues(ready, "tcg", now).join() === validateListing(ready, "tcg", now).join(), "publish check matches the server rules");
assert(wizardStepIssues(3, ready, "tcg", now).length === 0, "preview is the full check when the draft is complete");
assert(wizardStepIssues(4, ready, "tcg", now).length === 0, "a step past preview still runs the full check");
assert(wizardPublishIssues(card({ title: "", photos: [], intent: "draft" }), "tcg", now).join() === "title", "draft save only requires a title");
assert(wizardPublishIssues(card({ photos: [], description: "", intent: "draft" }), "tcg", now).length === 0, "a titled draft can be saved unfinished");
assert(wizardPublishIssues(card({ intent: "schedule", publishAt: null }), "tcg", now).includes("schedule"), "schedule needs a future time");
assert(wizardPublishIssues(card({ categoryId: " " }), "tcg", now).includes("category"), "missing category is named");

assert(wizardStepForIssue("photos") === 0 && wizardStepForIssue("front_back") === null, "photo issues return to basics; front and back are not a rule");
assert(wizardStepForIssue("title") === 0 && wizardStepForIssue("price") === 0 && wizardStepForIssue("shipping") === 2, "issues map to their step");
assert(wizardStepForIssue("meetup") === 2 && wizardStepForIssue("store") === 2 && wizardStepForIssue("preorder") === 2 && wizardStepForIssue("ship_within") === 2, "shipping details stay on the shipping step");
assert(wizardStepForIssue("card_price") === 1 && wizardStepForIssue("schedule") === 3 && wizardStepForIssue("auction_end") === 3, "card price, schedule, and auction end stay on their steps");
assert(wizardStepForIssue("phone") === null, "unknown server errors stay on the current step");
assert(wizardPanels(["video", "qty", "schedule"]).more && wizardPanels(["video", "qty", "schedule"]).priceExtra && wizardPanels(["video", "qty", "schedule"]).schedule, "panels open for the missing field");
assert(wizardPanels(["preorder", "ship_within"]).ship, "stock issues open the shipping panel");

assert(wizardFocusField("photos", card({ photos: [] })) === "photos-add", "too few photos focus the add control");
assert(
  wizardFocusField("photos", card({ photos: Array.from({ length: 11 }, () => ({ url: "/demo/cards/seed_charizard.svg", role: "GALLERY" as const })) })) === "photos",
  "too many photos focus the photo section",
);
assert(wizardFocusField("front_back", card()) === "" && wizardFocusField("photo_url", card()) === "photo_url", "photo role is gone; a bad url still has an anchor");
assert(wizardFocusField("card_price", card()) === "cardPrice", "per-card price focuses the first empty card price");
assert(wizardFocusField("preorder", card()) === "preorderShipDate" && wizardFocusField("ship_within", card()) === "shipWithin", "stock issues focus the date or the day picker");
assert(wizardFocusField("tcg", card({ game: "  ", setName: "151", cardName: "噴火龍", language: "日文" })) === "game", "tcg focuses the first blank field");
assert(wizardFocusField("tcg", card({ game: "Pokémon", setName: "", cardName: "噴火龍", language: "日文" })) === "setName", "tcg moves to the next blank field");
assert(wizardFocusField("person", card({ personName: "美斯", seasonYear: " ", brandSeries: "Topps" })) === "seasonYear", "person focuses the blank season");
assert(wizardFocusField("grade", card()) === "rawGrade", "raw condition focuses the A–D select");
assert(wizardFocusField("grade", card({ conditionTrack: "GRADED", rawGrade: null, grader: "PSA", gradeValue: null })) === "gradeScore", "graded condition focuses the score");
assert(wizardFocusField("shipping", card({ shipSfCod: false, shipMeetup: false, shipPickup: false })) === "shipSfCod", "no method focuses the first shipping choice");
assert(wizardFocusField("meetup", card({ shipMeetup: true, meetupDistrict: "" })) === "meetupDistrict", "meetup without a district focuses the district");
assert(
  wizardFocusField("meetup", card({ shipMeetup: true, meetupDistrict: "油尖旺", meetupWindow: "x".repeat(81) })) === "meetupWindow",
  "a long meetup window is focused before the note",
);
assert(
  wizardFocusField("meetup", card({ shipMeetup: true, meetupDistrict: "油尖旺", meetupNotes: "x".repeat(201) })) === "meetupNotes",
  "a long meetup note is focused",
);
assert(wizardFocusField("store", card({ shipPickup: true })) === "store", "store pickup focuses the profile-address hint");
assert(wizardFocusField("both_price", card()) === "price" && wizardFocusField("auction_end", card()) === "auctionEndsAt", "price and auction end focus their controls");
assert(wizardFocusField("schedule", card()) === "publishAt" && wizardFocusField("phone", card()) === "", "schedule focuses its picker; phone has no sell-form control");

const form = new FormData();
form.set("title", "減價，Sv2a 全陪8折");
form.set("price", "80");
form.set("saleType", "BUY_NOW");
form.set("conditionTrack", "RAW");
form.set("rawGrade", "A");
form.set("intent", "publish");
form.set("categoryId", "cat_pokemon");
form.set("shipSfCod", "on");
form.set("quantity", "1");
form.set("shippingDays", "3");
form.set("stockType", "IN_STOCK");
form.set("shipWithinDays", "7");
form.set("photos", JSON.stringify(onePhoto));
form.set(
  "cards",
  JSON.stringify([
    { cardName: "噴火龍", catalogCardId: "card_zard", conditionTrack: "RAW", rawGrade: "A", price: "40" },
    { cardName: "皮卡丘", catalogCardId: "card_pika", conditionTrack: "RAW", rawGrade: "B", price: "40" },
  ]),
);
const parsed = parseListingForm(form);
assert(parsed?.items?.length === 2 && parsed.shipWithinDays === 7 && parsed.title === "減價，Sv2a 全陪8折", "the form keeps the typed title and per-card prices");
assert(parsed?.catalogCardId === "card_zard" && parsed.items?.[1]?.catalogCardId === "card_pika", "a picked catalog card stays on the listing and on that row");
assert(listingCatalogId([{ catalogCardId: null }, { catalogCardId: "card_pika" }], null) === "card_pika", "a later card still links the listing");
assert(listingCatalogId(undefined, "  ") === null && listingCatalogId([], "card_zard") === "card_zard", "blank ids stay unlinked and a listing-level id is kept");
assert(parsed != null && wizardPublishIssues(parsed, "tcg", now).length === 0, "a minimum multi-card form publishes");

const legacy = new FormData();
legacy.set("title", "煙霧測試卡");
legacy.set("price", "200");
legacy.set("saleType", "BUY_NOW");
legacy.set("conditionTrack", "RAW");
legacy.set("rawGrade", "A");
legacy.set("intent", "publish");
legacy.set("categoryId", "cat_pokemon");
legacy.set("shipSfCod", "on");
legacy.set("quantity", "1");
legacy.set("game", "Pokémon");
legacy.set("setName", "Smoke");
legacy.set("cardName", "測試卡");
legacy.set("language", "日文");
legacy.set("photos", JSON.stringify([{ url: "/demo/charizard.svg", role: "FRONT" }]));
const legacyParsed = parseListingForm(legacy);
assert(legacyParsed?.items === undefined && legacyParsed != null && wizardPublishIssues(legacyParsed, "tcg", now).length === 0, "forms without cards keep the older single-card rules");

console.log("sell wizard ok");
