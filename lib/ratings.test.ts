import { readFileSync } from "node:fs";
import { RatingPill } from "../components/profile-header";
import { aggregateRating, rateDeal, ratingFromAggregate, type RateDealInput } from "./ratings";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const done: RateDealInput = {
  status: "COMPLETED",
  buyerId: "buyer",
  sellerId: "seller",
  authorId: "buyer",
  alreadyRatedBy: [],
  stars: 5,
  comment: "",
};

for (const status of ["PENDING_PAYMENT", "AWAITING_SHIP", "IN_ESCROW", "SHIPPED", "CANCELLED", "DISPUTED", "REFUNDED"]) {
  const early = rateDeal({ ...done, status });
  assert(!early.ok && early.error === "not_done", `${status} cannot be rated`);
}

const buyer = rateDeal(done);
const seller = rateDeal({ ...done, authorId: "seller", alreadyRatedBy: ["buyer"], stars: 4, comment: " 快手交收 " });
assert(buyer.ok && buyer.subjectId === "seller" && buyer.stars === 5 && buyer.comment === "", "the buyer rates the seller, comment optional");
assert(seller.ok && seller.subjectId === "buyer" && seller.comment === "快手交收", "the seller rates the buyer on the same handover");
const again = rateDeal({ ...done, alreadyRatedBy: ["buyer", "seller"] });
assert(!again.ok && again.error === "once", "a second rating from the same party is refused");
const repeatSeller = rateDeal({ ...done, authorId: "seller", alreadyRatedBy: ["seller"], stars: 1, comment: "" });
assert(!repeatSeller.ok && repeatSeller.error === "once", "the other party is also once-only");
const outsider = rateDeal({ ...done, authorId: "other" });
assert(!outsider.ok && outsider.error === "party", "only the two parties rate");
assert(!rateDeal({ ...done, stars: 0 }).ok && !rateDeal({ ...done, stars: 6 }).ok && !rateDeal({ ...done, stars: 4.5 }).ok, "stars are 1 to 5");
assert(!rateDeal({ ...done, comment: "字".repeat(81) }).ok, "the note stays one line");
const folded = rateDeal({ ...done, comment: "一行\n就夠" });
assert(folded.ok && folded.comment === "一行 就夠", "a line break is folded into the one line");

assert(aggregateRating([]) === null && ratingFromAggregate(null, 0) === null, "no ratings is not a score");
assert(aggregateRating([5])?.average === 5 && aggregateRating([5])?.count === 1, "one rating is that score");
const pair = aggregateRating([5, 4]);
assert(pair?.average === 4.5 && pair.count === 2, "two ratings average");
const three = aggregateRating([5, 4, 4]);
assert(three?.average === 4.3 && three.count === 3, "the mean rounds to one decimal");
assert(ratingFromAggregate(4.333333333333333, 3)?.average === 4.3, "a stored average uses the same rounding");
assert(RatingPill({ locale: "zh-HK", average: 5, count: 0 }) === null, "an empty pill draws nothing");

const deal = readFileSync(new URL("../components/deal-panel.tsx", import.meta.url), "utf8");
assert(
  deal.includes('stream && phase === "DONE" && (buyer || seller)') && deal.includes("<DealRatingForm"),
  "the star form sits on the chat bubble only after DONE",
);
const doneBlock = deal.slice(deal.indexOf('phase === "DONE"'));
assert(doneBlock.includes("<DealRatingForm") && !doneBlock.includes("<img") && !doneBlock.includes("imageUrl") && !doneBlock.includes("formatHkd"), "the finished bubble rates in place and does not repeat the pinned listing");
assert(deal.includes("已評分") && !deal.includes("rating.update") && !deal.includes("再評"), "a sent rating is shown and there is no re-rate control");
const ratingForm = readFileSync(new URL("../components/deal-rating-form.tsx", import.meta.url), "utf8");
assert(ratingForm.includes("評分") && ratingForm.includes("一句評語") && !ratingForm.includes("送出評分"), "the submit label is 評分 and the note asks for one written line");
const header = readFileSync(new URL("../components/profile-header.tsx", import.meta.url), "utf8");
const listing = readFileSync(new URL("../app/listing/[id]/page.tsx", import.meta.url), "utf8");
assert(header.includes("<RatingPill") && header.includes("<NameLine"), "the score sits beside the profile name");
assert(listing.includes("<NameLine") && listing.includes("rating={sellerRating}") && listing.includes("listing.seller.verificationTier") && listing.includes("listing.seller.nickname"), "the listing seller row is name, tier, then score");
const feedCard = readFileSync(new URL("../components/listing-card.tsx", import.meta.url), "utf8");
const postCard = readFileSync(new URL("../components/post-card.tsx", import.meta.url), "utf8");
assert(!feedCard.includes("NameLine") && !feedCard.includes("VerificationPill") && !postCard.includes("NameLine") && !postCard.includes("VerificationPill"), "feed cards do not show the pill");
assert(!header.includes("—"), "a profile with no ratings does not show a dash");
const route = readFileSync(new URL("../app/api/orders/[id]/rating/route.ts", import.meta.url), "utf8");
assert(route.includes("rateDeal") && route.includes('error.code === "P2002"') && route.includes('"once"'), "the route uses the gate and the once-only key");
const thread = readFileSync(new URL("../app/messages/[id]/page.tsx", import.meta.url), "utf8");
assert(thread.includes("ratings:") && thread.includes("rating={order.ratings.find"), "the thread loads this viewer's rating");
assert(thread.includes("rating={otherRating}") && thread.includes("tier={other.verificationTier}") && thread.includes("thread.seller.verificationTier") && thread.includes("rating: sellerRating") && !thread.includes("other.username") && !thread.includes("@{"), "chat top and the pin-card seller use the stored tier and average, with no handle");
const pin = readFileSync(new URL("../components/listing-chat-bar.tsx", import.meta.url), "utf8");
assert(pin.includes("<NameLine") && pin.includes("seller.tier") && pin.includes("seller.rating") && pin.includes("/shop/${seller.id}") && pin.indexOf("/shop/${seller.id}") > pin.indexOf("/listing/${listingId}"), "the pinned card seller line sits outside the product link");

console.log("ratings.test.ts ok");
