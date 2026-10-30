"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { percentInputToBps } from "@/lib/rules";
import { decideDispute } from "@/lib/orders";
import { unlistListing } from "@/lib/listings";

async function admin() {
  const user = await getViewer();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/?err=forbidden");
  return user;
}

export async function liftBan(formData: FormData) {
  await admin();
  await prisma.user.update({
    where: { id: String(formData.get("userId") || "") },
    data: { bidBanned: false, consecutiveUnpaid: 0 },
  });
  redirect("/admin?tab=users&ok=saved");
}

/** Manual bid ban after a report. No auto / temp ban path. */
export async function banBids(formData: FormData) {
  await admin();
  await prisma.user.update({
    where: { id: String(formData.get("userId") || "") },
    data: { bidBanned: true },
  });
  redirect("/admin?tab=users&ok=saved");
}

export async function adminUnlist(formData: FormData) {
  const user = await admin();
  await unlistListing(user.id, String(formData.get("listingId") || ""), true);
  redirect("/admin?tab=listings&ok=saved");
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
    redirect("/admin?tab=categories&err=category");
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
    redirect("/admin?tab=categories&err=category");
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

export async function adminDecide(formData: FormData) {
  await admin();
  const winner = formData.get("winner") === "buyer" ? "buyer" : "seller";
  const result = await decideDispute(String(formData.get("disputeId") || ""), winner, String(formData.get("note") || ""));
  redirect(`/admin?tab=disputes&${result.ok ? "ok=saved" : `err=${result.error}`}`);
}
