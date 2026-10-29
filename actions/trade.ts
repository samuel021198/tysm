"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { cleanOfferNote, offerAckGate } from "@/lib/deal-phase";
import { hkdToCents, safeNext } from "@/lib/format";
import { importCsv, markListingSold, parseListingForm, relistAuctionFixed, relistListing, saveListing, unlistListing, updateListingPrice, deleteDraft } from "@/lib/listings";
import { placePublicBid } from "@/lib/bids";
import { respondOffer } from "@/lib/offers";
import {
  acceptDealOffer,
  arrangeMeetup,
  cancelDeal,
  confirmDeal,
  confirmDirectBuy,
  confirmHandover,
  confirmReceived,
  confirmSellerPaid,
  declineDealOffer,
  markDealSold,
  proposeDealOffer,
  releaseReserve,
  replyDirectSold,
  uploadProof,
  withdrawDealOffer,
} from "@/lib/deals";
import {
  advanceShipment,
  appealDispute,
  cancelUnpaidOrder,
  chooseOrderShip,
  openDispute,
} from "@/lib/orders";
import { prisma } from "@/lib/db";

async function viewer(next: string) {
  const user = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function saveListingAction(_prev: { error?: string } | null, formData: FormData) {
  const user = await viewer("/sell");
  if (!user.phoneVerified) return { error: "phone" };
  const input = parseListingForm(formData);
  if (!input) return { error: "category" };
  const listingId = String(formData.get("listingId") || "") || undefined;
  const collectionItemId = String(formData.get("collectionItemId") || "") || undefined;
  const result = await saveListing(user.id, input, listingId, collectionItemId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath(`/listing/${result.id}`);
  const ok = input.intent === "draft" ? "draft" : input.intent === "schedule" ? "scheduled" : "published";
  if (formData.get("alsoPost") === "on" && result.postId) redirect(`/post/${result.postId}?ok=posted`);
  redirect(`/listing/${result.id}?ok=${ok}`);
}

export async function unlistAction(formData: FormData) {
  const user = await viewer("/sell");
  const id = String(formData.get("listingId") || "");
  const result = await unlistListing(user.id, id, user.role === "ADMIN" && formData.get("asAdmin") === "1");
  if (!result.ok) redirect(`/listing/${id}?err=${result.error}`);
  revalidatePath("/");
  redirect(`/listing/${id}?ok=saved`);
}

function shopFlash(formData: FormData, key: "ok" | "err", value: string) {
  const url = new URL(safeNext(formData.get("next")), "http://local");
  if (url.pathname !== "/me" && !/^\/shop\/[^/]+$/.test(url.pathname)) {
    url.pathname = "/me";
    url.search = "";
  }
  url.searchParams.set("tab", "selling");
  url.searchParams.delete("ok");
  url.searchParams.delete("err");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

export async function updateShopPrice(formData: FormData) {
  const back = shopFlash(formData, "ok", "saved");
  const user = await viewer(back);
  const cents = hkdToCents(String(formData.get("price") || ""));
  const id = String(formData.get("listingId") || "");
  if (cents == null || cents <= 0) redirect(shopFlash(formData, "err", "price"));
  const result = await updateListingPrice(user.id, id, cents);
  if (!result.ok) redirect(shopFlash(formData, "err", result.error));
  revalidatePath("/me");
  revalidatePath(new URL(back, "http://local").pathname);
  revalidatePath(`/listing/${id}`);
  redirect(back);
}

export async function unlistShopListing(formData: FormData) {
  const back = shopFlash(formData, "ok", "saved");
  const user = await viewer(back);
  const id = String(formData.get("listingId") || "");
  const result = await unlistListing(user.id, id);
  if (!result.ok) redirect(shopFlash(formData, "err", result.error));
  revalidatePath("/me");
  revalidatePath(new URL(back, "http://local").pathname);
  revalidatePath(`/listing/${id}`);
  redirect(back);
}

export async function markShopSold(formData: FormData) {
  const back = shopFlash(formData, "ok", "saved");
  const user = await viewer(back);
  const id = String(formData.get("listingId") || "");
  const result = await markListingSold(user.id, id);
  if (!result.ok) redirect(shopFlash(formData, "err", result.error));
  revalidatePath("/me");
  revalidatePath(new URL(back, "http://local").pathname);
  revalidatePath(`/listing/${id}`);
  redirect(back);
}

export async function relistFixedAction(formData: FormData) {
  const id = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${id}`);
  const price = hkdToCents(String(formData.get("price") || ""));
  if (price == null || price <= 0) redirect(`/listing/${id}?err=price`);
  const result = await relistAuctionFixed(user.id, id, price);
  if (!result.ok) redirect(`/listing/${id}?err=${result.error}`);
  redirect(`/listing/${id}?ok=saved`);
}

export async function relistAction(formData: FormData) {
  const user = await viewer("/sell");
  const id = String(formData.get("listingId") || "");
  const result = await relistListing(user.id, id);
  if (!result.ok) redirect(`/listing/${id}?err=${result.error}`);
  redirect(`/listing/${id}?ok=saved`);
}

export async function deleteDraftAction(formData: FormData) {
  const user = await viewer("/sell");
  const id = String(formData.get("listingId") || "");
  const result = await deleteDraft(user.id, id);
  if (!result.ok) redirect(`/listing/${id}?err=${result.error}`);
  redirect("/?ok=saved");
}

export async function importCsvAction(_prev: { error?: string; rows?: { row: number; code: string }[] } | null, formData: FormData) {
  const user = await viewer("/sell/bulk");
  if (!user.phoneVerified) return { error: "phone" };
  const file = formData.get("file");
  const text = file instanceof File ? await file.text() : String(formData.get("csv") || "");
  const result = await importCsv(user.id, String(formData.get("categoryId") || ""), text);
  if (!result.ok) return { error: result.error, rows: result.errors };
  revalidatePath("/");
  redirect(`/?ok=imported`);
}

export async function bidAction(formData: FormData) {
  const id = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${id}`);
  const amount = hkdToCents(String(formData.get("amount") || formData.get("max") || ""));
  if (amount == null || amount <= 0) redirect(`/listing/${id}?err=below_min`);
  const result = await placePublicBid(user.id, id, amount);
  revalidatePath(`/listing/${id}`);
  redirect(`/listing/${id}?${result.ok ? "ok=bid" : `err=${result.error}`}`);
}

export async function offerRespondAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${listingId}`);
  const counter = hkdToCents(String(formData.get("counter") || ""));
  const result = await respondOffer(user.id, String(formData.get("offerId") || ""), String(formData.get("act") || ""), counter);
  if (result.ok && result.threadId) redirect(`/messages/${result.threadId}`);
  if (result.ok && result.orderId) redirect(`/orders/${result.orderId}?ok=offer`);
  redirect(`/listing/${listingId}?${result.ok ? "ok=offer" : `err=${result.error}`}`);
}

export async function cartAdd(formData: FormData) {
  const id = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${id}`);
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.sellerId === user.id || listing.saleType === "AUCTION" || listing.status !== "ACTIVE") {
    redirect(`/listing/${id}?err=unavailable`);
  }
  const quantity = Math.max(1, Math.min(listing.quantityAvailable, Number(formData.get("quantity") || 1)));
  await prisma.cartItem.upsert({
    where: { userId_listingId: { userId: user.id, listingId: id } },
    create: { userId: user.id, listingId: id, quantity },
    update: { quantity },
  });
  revalidatePath("/cart");
  redirect("/cart?ok=cart");
}

export async function cartUpdate(formData: FormData) {
  const user = await viewer("/cart");
  const id = String(formData.get("listingId") || "");
  if (formData.get("remove") === "1") {
    await prisma.cartItem.deleteMany({ where: { userId: user.id, listingId: id } });
  } else {
    const quantity = Number(formData.get("quantity") || 1);
    if (quantity < 1) await prisma.cartItem.deleteMany({ where: { userId: user.id, listingId: id } });
    else await prisma.cartItem.updateMany({ where: { userId: user.id, listingId: id }, data: { quantity } });
  }
  redirect("/cart");
}

export async function checkoutAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "");
  if (listingId) redirect(`/listing/${listingId}`);
  redirect("/checkout");
}

export async function chooseShipAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${id}`);
  const result = await chooseOrderShip(user.id, id, String(formData.get("shipMethod") || ""), String(formData.get("addressId") || "") || null);
  redirect(`/orders/${id}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function payAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  await viewer(`/orders/${id}`);
  redirect(`/orders/${id}`);
}

export async function cancelOrderAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${id}`);
  const result = await cancelUnpaidOrder(id, "buyer", user.id);
  redirect(`/orders/${id}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function shipAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${id}`);
  const step = formData.get("step") === "ship" ? "ship" : "pack";
  const result = await advanceShipment(user.id, id, step, {
    courier: String(formData.get("courier") || ""),
    tracking: String(formData.get("tracking") || ""),
  });
  redirect(`/orders/${id}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

function dealNext(formData: FormData, orderId: string) {
  const next = String(formData.get("next") || "").split("?")[0];
  if (next.startsWith("/messages/") || next === `/orders/${orderId}`) return next;
  return `/orders/${orderId}`;
}

type DealOutcome = { ok: true } | { ok: false; error: string };

/** Thread CTAs stay on the open chat. Order pages still redirect so the flash banner can show. */
function settleDeal(formData: FormData, orderId: string, result: DealOutcome, okCode: string) {
  const next = dealNext(formData, orderId);
  if (result.ok && next.startsWith("/messages/")) {
    revalidatePath(next);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/me/footprint");
    return;
  }
  redirect(`${next}?${result.ok ? `ok=${okCode}` : `err=${result.error}`}`);
}

export async function confirmAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmReceived(user.id, id);
  settleDeal(formData, id, result, "done");
}

/** Records the one-time private-handover ack. Signup terms are a different flag. */
export async function ackP2pRisk() {
  const user = await getViewer();
  if (!user || user.p2pRiskAckAt) return;
  await prisma.user.update({ where: { id: user.id }, data: { p2pRiskAckAt: new Date() } });
}

export async function makeDealOfferAction(formData: FormData) {
  const threadId = String(formData.get("threadId") || "");
  const user = await viewer(`/messages/${threadId}`);
  const gate = offerAckGate(Boolean(user.p2pRiskAckAt), formData.get("ack"));
  if (!gate.ok) redirect(`/messages/${threadId}?err=${gate.error}`);
  if (gate.record) await prisma.user.update({ where: { id: user.id }, data: { p2pRiskAckAt: new Date() } });
  const amount = hkdToCents(String(formData.get("price") || ""));
  const note = cleanOfferNote(String(formData.get("note") || ""));
  if (amount == null || amount <= 0) redirect(`/messages/${threadId}?err=deal_price`);
  if (!note.ok) redirect(`/messages/${threadId}?err=offer_note`);
  const result = await proposeDealOffer(user.id, threadId, String(formData.get("listingId") || ""), amount, note.note);
  if (!result.ok) redirect(`/messages/${threadId}?err=${result.error}`);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
}

export async function confirmDirectBuyAction(formData: FormData) {
  const threadId = String(formData.get("threadId") || "");
  const user = await viewer(`/messages/${threadId}`);
  const result = await confirmDirectBuy(user.id, threadId);
  if (!result.ok) redirect(`/messages/${threadId}?err=${result.error}`);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  revalidatePath(`/listing/${result.listingId}`);
  revalidatePath("/me/footprint");
}

export async function markDirectSoldAction(formData: FormData) {
  const threadId = String(formData.get("threadId") || "");
  const user = await viewer(`/messages/${threadId}`);
  const result = await replyDirectSold(user.id, threadId);
  if (!result.ok) redirect(`/messages/${threadId}?err=${result.error}`);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  revalidatePath(`/listing/${result.listingId}`);
  revalidatePath("/");
}

export async function acceptDealOfferAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await acceptDealOffer(user.id, id);
  settleDeal(formData, id, result, "accepted");
}

export async function confirmDealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmDeal(user.id, id);
  settleDeal(formData, id, result, "locked");
}

export async function declineDealOfferAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await declineDealOffer(user.id, id);
  settleDeal(formData, id, result, "declined");
}

export async function withdrawDealOfferAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await withdrawDealOffer(user.id, id);
  settleDeal(formData, id, result, "withdrawn");
}

export async function releaseReserveAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await releaseReserve(user.id, id);
  settleDeal(formData, id, result, "released");
}

export async function arrangeDealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await arrangeMeetup(user.id, id);
  settleDeal(formData, id, result, "saved");
}

export async function proofAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await uploadProof(user.id, id, String(formData.get("imageUrl") || ""));
  settleDeal(formData, id, result, "saved");
}

export async function confirmHandoverAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmHandover(user.id, id);
  if (result.ok && result.done) revalidatePath("/");
  settleDeal(formData, id, result, result.ok && result.done ? "done" : "handover");
}

export async function sellerPaidAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmSellerPaid(user.id, id);
  settleDeal(formData, id, result, "saved");
}

export async function markSoldAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await markDealSold(user.id, id);
  revalidatePath("/");
  settleDeal(formData, id, result, "saved");
}

export async function cancelDealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await cancelDeal(user.id, id);
  settleDeal(formData, id, result, "saved");
}

export async function disputeAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${id}`);
  const result = await openDispute(user.id, id, String(formData.get("reason") || ""));
  redirect(`/orders/${id}?${result.ok ? "ok=dispute" : `err=${result.error}`}`);
}

export async function appealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(`/orders/${id}`);
  const result = await appealDispute(user.id, id, String(formData.get("reason") || ""));
  redirect(`/orders/${id}?${result.ok ? "ok=dispute" : `err=${result.error}`}`);
}
