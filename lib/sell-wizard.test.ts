import {
  validateListing,
  wizardPanels,
  wizardPublishIssues,
  wizardStepForIssue,
  wizardStepIssues,
  type ListingInput,
} from "./sell-wizard";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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

const photosOnly = wizardStepIssues(0, card({ photos: [] }), "tcg", now);
assert(photosOnly.includes("photos") && !photosOnly.includes("title"), "photo step blocks on photos, not title");

assert(
  wizardStepIssues(0, card({ photos: [{ url: "/demo/cards/seed_charizard.svg", role: "FRONT" }] }), "tcg", now).includes("photos"),
  "one photo is not enough",
);
assert(
  wizardStepIssues(0, card({ photos: [{ url: "http://cdn.example/a.jpg", role: "FRONT" }, { url: "/demo/a.svg", role: "BACK" }] }), "tcg", now).includes("photo_url"),
  "http photos are rejected",
);
assert(
  wizardStepIssues(
    0,
    card({
      conditionTrack: "GRADED",
      rawGrade: null,
      grader: "PSA",
      gradeValue: 100,
      photos: [
        { url: "/demo/cards/seed_charizard.svg", role: "FRONT" },
        { url: "/demo/cards/seed_pikachu.svg", role: "GALLERY" },
      ],
    }),
    "tcg",
    now,
  ).includes("front_back"),
  "graded step 0 still requires front and back",
);
assert(wizardStepIssues(0, card(), "tcg", now).length === 0, "two demo photos pass the photo step");

const details = wizardStepIssues(0, card({ title: "卡", description: "  ", game: "" }), "tcg", now);
assert(details.length === 0, "later missing fields do not block the photo step");

const missingDetails = wizardStepIssues(1, card({ title: "卡", description: " ", game: "", videoUrl: "http://v.example/a" }), "tcg", now);
assert(missingDetails.includes("title") && missingDetails.includes("description") && missingDetails.includes("tcg") && missingDetails.includes("video"), "detail step names each gap");
assert(!missingDetails.includes("price"), "detail step ignores price");
assert(
  wizardStepIssues(1, card({ conditionTrack: "GRADED", rawGrade: null, grader: "PSA", gradeValue: null }), "tcg", now).includes("grade"),
  "graded score is required",
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

assert(wizardStepIssues(2, card({ priceCents: null }), "tcg", now).includes("price"), "buy now needs a price");
const auctionGaps = wizardStepIssues(2, card({ saleType: "AUCTION", priceCents: null, quantity: 2 }), "tcg", now);
assert(auctionGaps.includes("start") && auctionGaps.includes("auction_end") && auctionGaps.includes("qty"), "auction needs a floor, an end, and quantity 1");
assert(
  wizardStepIssues(2, card({ saleType: "AUCTION", priceCents: null, startPriceCents: 5000, auctionEndsAt: later }), "tcg", now).length === 0,
  "auction with a floor and end passes",
);
assert(
  wizardStepIssues(2, card({ saleType: "BOTH", startPriceCents: 10000, auctionEndsAt: later }), "tcg", now).includes("both_price"),
  "buy now must be above the start price",
);
assert(
  wizardStepIssues(2, card({ offersEnabled: true, minOfferCents: 10000 }), "tcg", now).includes("offer"),
  "minimum offer must be below buy now",
);

assert(wizardStepIssues(3, card({ shipSfCod: false }), "tcg", now).includes("shipping"), "at least one shipping method");
assert(wizardStepIssues(3, card({ shipSfCod: false, shipMeetup: true }), "tcg", now).includes("meetup"), "meetup needs a district");
assert(
  wizardStepIssues(3, card({ shipSfCod: false, shipMeetup: true, meetupDistrict: "油尖旺" }), "tcg", now).length === 0,
  "meetup with a district passes",
);
assert(
  wizardStepIssues(3, card({ shipSfCod: false, shipPickup: true }), "tcg", now, false).includes("store"),
  "store pickup needs a shop address",
);
assert(
  wizardStepIssues(3, card({ shipSfCod: false, shipPickup: true }), "tcg", now, true).length === 0,
  "store pickup passes when the profile has an address",
);
assert(wizardStepIssues(3, card(), "tcg", now).length === 0, "default shipping passes");

const ready = card();
assert(wizardPublishIssues(ready, "tcg", now).join() === validateListing(ready, "tcg", now).join(), "publish check matches the server rules");
assert(wizardStepIssues(4, ready, "tcg", now).length === 0, "review step is clear when the draft is complete");
assert(wizardPublishIssues(card({ title: "", photos: [], intent: "draft" }), "tcg", now).join() === "title", "draft save only requires a title");
assert(wizardPublishIssues(card({ photos: [], intent: "draft" }), "tcg", now).length === 0, "a titled draft can be saved unfinished");
assert(wizardPublishIssues(card({ intent: "schedule", publishAt: null }), "tcg", now).includes("schedule"), "schedule needs a future time");
assert(wizardPublishIssues(card({ categoryId: " " }), "tcg", now).includes("category"), "missing category is named");

assert(wizardStepForIssue("photos") === 0 && wizardStepForIssue("front_back") === 0, "photo issues return to photos");
assert(wizardStepForIssue("title") === 1 && wizardStepForIssue("price") === 2 && wizardStepForIssue("shipping") === 3, "issues map to their step");
assert(wizardStepForIssue("meetup") === 3 && wizardStepForIssue("store") === 3, "shipping details stay on the shipping step");
assert(wizardStepForIssue("schedule") === 4 && wizardStepForIssue("phone") === null, "unknown server errors stay on the current step");
assert(wizardPanels(["video", "qty", "schedule"]).more && wizardPanels(["video", "qty", "schedule"]).priceExtra && wizardPanels(["video", "qty", "schedule"]).schedule, "panels open for the missing field");

console.log("sell wizard ok");
