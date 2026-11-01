"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { percentInputToBps } from "@/lib/rules";
import { decideDispute } from "@/lib/orders";
import { unlistListing } from "@/lib/listings";
import { planVerificationReview } from "@/lib/verification";

async function admin() {
  const user = await getViewer();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/?err=forbidden");
  return user;
}

function usersBack(formData: FormData, flag: "ok" | "err", code: string) {
  const q = String(formData.get("q") || "").trim().slice(0, 40);
  const query = q ? `&q=${encodeURIComponent(q)}` : "";
  return `/admin?tab=users&${flag}=${code}${query}`;
}

export async function liftBan(formData: FormData) {
  await admin();
  await prisma.user.update({
    where: { id: String(formData.get("userId") || "") },
    data: { bidBanned: false, consecutiveUnpaid: 0 },
  });
  redirect(usersBack(formData, "ok", "saved"));
}

/** Manual bid ban after a report. No auto / temp ban path. */
export async function banBids(formData: FormData) {
  await admin();
  await prisma.user.update({
    where: { id: String(formData.get("userId") || "") },
    data: { bidBanned: true },
  });
  redirect(usersBack(formData, "ok", "saved"));
}

/** Account ban. Does not change role, and does not apply to an admin. */
export async function setAccountDisabled(formData: FormData) {
  await admin();
  const id = String(formData.get("userId") || "");
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user || user.role === "ADMIN") redirect(usersBack(formData, "err", "forbidden"));
  await prisma.user.update({ where: { id }, data: { disabled: formData.get("disabled") === "1" } });
  redirect(usersBack(formData, "ok", "saved"));
}

/** Manual badge. Never changes role. */
export async function setUserTier(formData: FormData) {
  await admin();
  const tier = formData.get("tier");
  if (tier !== "TRUSTED" && tier !== "MERCHANT") redirect(usersBack(formData, "err", "forbidden"));
  const id = String(formData.get("userId") || "");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) redirect(usersBack(formData, "err", "forbidden"));
  await prisma.user.update({ where: { id }, data: { verificationTier: tier } });
  redirect(usersBack(formData, "ok", "saved"));
}

export async function adminUnlist(formData: FormData) {
  const user = await admin();
  const id = String(formData.get("listingId") || "");
  const listing = await prisma.listing.findUnique({ where: { id }, select: { status: true } });
  if (!listing || listing.status !== "ACTIVE") redirect("/admin?tab=listings&err=state");
  const result = await unlistListing(user.id, id, true);
  redirect(`/admin?tab=listings&${result.ok ? "ok=saved" : `err=${result.error}`}`);
}

export async function reviewApplication(decision: string, formData: FormData) {
  await admin();
  const id = String(formData.get("id") || "");
  if (decision !== "APPROVED" && decision !== "REJECTED") redirect("/admin?tab=applications&err=verify_state");
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const application = await prisma.verificationApplication.findUnique({
    where: { id },
    select: { id: true, userId: true, track: true, status: true, user: { select: { verificationTier: true } } },
  });
  if (!application) redirect("/admin?tab=applications&err=verify_state");
  const plan = planVerificationReview({
    applicationStatus: application.status,
    track: application.track,
    currentTier: application.user.verificationTier,
    decision,
  });
  if (!plan.ok) redirect("/admin?tab=applications&err=verify_state");
  const wrote = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationApplication.updateMany({
      where: { id: application.id, status: "PENDING" },
      data: { status: plan.applicationStatus, decidedAt: new Date(), reviewNote: note || null },
    });
    if (updated.count !== 1) return false;
    if (plan.setTier) {
      await tx.user.update({ where: { id: application.userId }, data: { verificationTier: plan.tier } });
    }
    return true;
  });
  if (!wrote) redirect("/admin?tab=applications&err=verify_state");
  redirect("/admin?tab=applications&ok=saved");
}

export async function resolveReport(formData: FormData) {
  await admin();
  await prisma.report.update({ where: { id: String(formData.get("id") || "") }, data: { status: "RESOLVED" } });
  redirect("/admin?tab=reports&ok=saved");
}

export async function addCategory(formData: FormData) {
  await admin();
  const parent = await prisma.category.findUnique({ where: { id: String(formData.get("parentId") || "") } });
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const nameZh = String(formData.get("nameZh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  if (!parent || parent.level !== "GROUP" || !/^[a-z0-9-]{2,40}$/.test(slug) || nameZh.length < 1 || nameEn.length < 1) {
    redirect("/admin?tab=categories&err=category_form");
  }
  try {
    await prisma.category.create({
      data: {
        parentId: parent.id,
        slug,
        nameZh,
        nameEn,
        level: "LEAF",
        groupKey: parent.groupKey,
        sort: 100,
      },
    });
  } catch {
    redirect("/admin?tab=categories&err=category_form");
  }
  redirect("/admin?tab=categories&ok=saved");
}

export async function setCommission(formData: FormData) {
  await admin();
  const bps = percentInputToBps(String(formData.get("percent") || ""));
  if (bps == null) redirect("/admin?tab=commission&err=offer");
  const label = String(formData.get("percent") || "").trim();
  await prisma.siteSetting.upsert({
    where: { key: "commission_percent" },
    create: { key: "commission_percent", value: label },
    update: { value: label },
  });
  redirect("/admin?tab=commission&ok=saved");
}

export async function adminDecide(winner: string, formData: FormData) {
  await admin();
  if (winner !== "buyer" && winner !== "seller") redirect("/admin?tab=disputes&err=state");
  const result = await decideDispute(String(formData.get("disputeId") || ""), winner, String(formData.get("note") || ""));
  redirect(`/admin?tab=disputes&${result.ok ? "ok=saved" : `err=${result.error}`}`);
}
