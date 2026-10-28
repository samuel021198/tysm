"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { hkdToCents } from "@/lib/format";
import { importCsv, parseListingForm, relistListing, saveListing, unlistListing, deleteDraft } from "@/lib/listings";
import { placeBid } from "@/lib/bids";
import { makeOffer, respondOffer } from "@/lib/offers";
import {
  arrangeMeetup,
  cancelDeal,
  confirmReceived,
  confirmSellerPaid,
  markDealSold,
  uploadProof,
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
  const max = hkdToCents(String(formData.get("max") || ""));
  if (max == null || max <= 0) redirect(`/listing/${id}?err=below_min`);
  const result = await placeBid(user.id, id, max);
  revalidatePath(`/listing/${id}`);
  redirect(`/listing/${id}?${result.ok ? "ok=bid" : `err=${result.error}`}`);
}

export async function offerAction(formData: FormData) {
  const id = String(formData.get("listingId") || "");
  const user = await viewer(`/listing/${id}`);
  const amount = hkdToCents(String(formData.get("amount") || ""));
  if (amount == null) redirect(`/listing/${id}?err=offer`);
  const result = await makeOffer(user.id, id, amount);
  redirect(`/listing/${id}?${result.ok ? "ok=offer" : `err=${result.error}`}`);
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

export async function confirmAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmReceived(user.id, id);
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=done" : `err=${result.error}`}`);
}

export async function arrangeDealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await arrangeMeetup(user.id, id);
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function proofAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await uploadProof(user.id, id, String(formData.get("imageUrl") || ""));
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function sellerPaidAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await confirmSellerPaid(user.id, id);
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function markSoldAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await markDealSold(user.id, id);
  revalidatePath("/");
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function cancelDealAction(formData: FormData) {
  const id = String(formData.get("orderId") || "");
  const user = await viewer(dealNext(formData, id));
  const result = await cancelDeal(user.id, id);
  redirect(`${dealNext(formData, id)}?${result.ok ? "ok=saved" : `err=${result.error}`}`);
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
