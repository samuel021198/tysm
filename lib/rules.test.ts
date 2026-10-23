import {
  bidIncrementCents,
  bpsToPercentLabel,
  canSubmitBuyerRound,
  extendedEnd,
  formatGradeValue,
  gradedPhotosOk,
  minimumNextBid,
  nextUnpaidStrike,
  parseGrade,
  percentInputToBps,
  quoteSeller,
  resolveAuction,
  validateMaxBid,
} from "./rules";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const t0 = new Date("2026-01-01T00:00:00Z");
const t1 = new Date("2026-01-01T00:01:00Z");

assert(bidIncrementCents(10000) === 500, "HK$100 increment is HK$5");
assert(bidIncrementCents(80000) === 2000, "HK$800 increment is HK$20");
assert(bidIncrementCents(499900) === 10000, "just under HK$5000 increment is HK$100");
assert(bidIncrementCents(500000) === 20000, "HK$5000 increment is HK$200");

const start = 50000;
const only = resolveAuction(start, [{ bidderId: "A", maxAmount: 120000, updatedAt: t0 }]);
assert(only.leaderId === "A" && only.price === start, "first proxy sits at the start price");

const war = resolveAuction(start, [
  { bidderId: "A", maxAmount: 80000, updatedAt: t0 },
  { bidderId: "B", maxAmount: 120000, updatedAt: t1 },
]);
assert(war.leaderId === "B" && war.price === 82000, "proxy raises one increment over the second max");
assert(minimumNextBid(start, war.price, true) === 84000, "public next bid is one increment, not the hidden max");

const tie = resolveAuction(start, [
  { bidderId: "A", maxAmount: 90000, updatedAt: t0 },
  { bidderId: "B", maxAmount: 90000, updatedAt: t1 },
]);
assert(tie.leaderId === "A" && tie.price === 90000, "earlier equal max wins the tie");

assert(minimumNextBid(start, null, false) === start, "opening bid is the start price");
assert(minimumNextBid(start, 82000, true) === 84000, "next bid is current plus increment");

const ok = validateMaxBid({
  startPrice: start,
  currentPrice: 82000,
  hasBids: true,
  leaderId: "B",
  bidderId: "A",
  maxAmount: 84000,
  existingMax: 80000,
});
assert(ok.ok, "challenger at the minimum is accepted");

const low = validateMaxBid({
  startPrice: start,
  currentPrice: 82000,
  hasBids: true,
  leaderId: "B",
  bidderId: "C",
  maxAmount: 83000,
  existingMax: null,
});
assert(!low.ok && low.reason === "below_min", "under the ladder is rejected");

const now = new Date("2026-01-01T00:10:00Z");
const soon = new Date(now.getTime() + 60 * 1000);
const later = new Date(now.getTime() + 10 * 60 * 1000);
assert(extendedEnd(soon, now).getTime() === now.getTime() + 2 * 60 * 1000, "anti-snipe extends inside 2 minutes");
assert(extendedEnd(later, now).getTime() === later.getTime(), "anti-snipe leaves a longer auction alone");

assert(nextUnpaidStrike(2).banned && nextUnpaidStrike(2).consecutive === 3, "third unpaid win bans bidding");
assert(!nextUnpaidStrike(1).banned, "second strike is only a warning");
assert(canSubmitBuyerRound(2) && !canSubmitBuyerRound(3), "offers stop after 3 buyer rounds");

assert(parseGrade("PSA", "10") === 100, "PSA 10");
assert(parseGrade("PSA", "9.5") === null, "PSA rejects halves");
assert(parseGrade("BGS", "10.5") === 105, "BGS allows 10.5");
assert(parseGrade("BGS", "11") === null, "BGS rejects 11");
assert(parseGrade("TAG", "9.5") === 95, "TAG half grades");
assert(parseGrade("CGC", "10.5") === null, "CGC caps at 10");
assert(formatGradeValue(95) === "9.5" && formatGradeValue(100) === "10", "grade labels");
assert(!gradedPhotosOk([{ role: "FRONT" }]) && gradedPhotosOk([{ role: "FRONT" }, { role: "BACK" }]), "graded needs front and back");

assert(percentInputToBps("8.5") === 850 && percentInputToBps("8") === 800, "commission bps");
assert(percentInputToBps("31") === null && percentInputToBps("8.55") === null, "commission bounds");
assert(bpsToPercentLabel(850) === "8.5" && bpsToPercentLabel(800) === "8", "bps label");
const quote = quoteSeller(128000, 2000, 800);
assert(quote.commissionAmount === 10240 && quote.proceeds === 119760, "commission comes out of the item price only");

console.log("rules ok");
