"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { clearSessionCookie, getViewer, setSessionCookie } from "@/lib/auth";
import { DISTRICTS, parseTarget, safeNext } from "@/lib/format";
import { headers } from "next/headers";

async function bounce() {
  const ref = safeNext((await headers()).get("referer"));
  redirect(ref);
}

export async function setPrefs(formData: FormData) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const theme = formData.get("theme");
  if (theme === "dark" || theme === "light") {
    jar.set("tysm_theme", theme, cookieOpts());
  }
  const locale = formData.get("locale");
  if (locale === "en" || locale === "zh-HK") {
    jar.set("tysm_locale", locale, cookieOpts());
  }
  await bounce();
}

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function requestOtp(_prev: { error?: string; code?: string; target?: string } | null, formData: FormData) {
  const parsed = parseTarget(String(formData.get("target") || ""));
  if (!parsed) return { error: "target" };
  const recent = await prisma.otpChallenge.findFirst({
    where: { target: parsed.target },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < 30_000) {
    return { error: "rate", target: parsed.target };
  }
  const code = String(randomInt(100000, 999999));
  await prisma.otpChallenge.create({
    data: {
      target: parsed.target,
      channel: parsed.channel,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { code, target: parsed.target };
}

export async function verifyOtp(_prev: { error?: string } | null, formData: FormData) {
  const parsed = parseTarget(String(formData.get("target") || ""));
  const code = String(formData.get("code") || "").trim();
  if (!parsed) return { error: "target" };
  const challenge = await prisma.otpChallenge.findFirst({
    where: { target: parsed.target, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.code !== code) return { error: "code" };
  const existing =
    parsed.channel === "email"
      ? await prisma.user.findUnique({ where: { email: parsed.target } })
      : await prisma.user.findUnique({ where: { phone: parsed.target } });
  if (!existing || !existing.termsAcceptedAt) {
    if (formData.get("accept") !== "on") return { error: "terms" };
  }
  const nickname = String(formData.get("nickname") || "").trim();
  if (!existing && (nickname.length < 2 || nickname.length > 24)) return { error: "nickname" };
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email: parsed.channel === "email" ? parsed.target : null,
        phone: parsed.channel === "phone" ? parsed.target : null,
        emailVerified: parsed.channel === "email",
        phoneVerified: parsed.channel === "phone",
        nickname,
        termsAcceptedAt: new Date(),
      },
    }));
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(parsed.channel === "email" ? { emailVerified: true } : { phoneVerified: true }),
        ...(!existing.termsAcceptedAt ? { termsAcceptedAt: new Date() } : {}),
      },
    });
  }
  await setSessionCookie(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await clearSessionCookie();
  redirect("/");
}

export async function requestPhoneOtp(_prev: { error?: string; code?: string; target?: string } | null, formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return { error: "login" };
  return requestOtp(null, formData);
}

export async function confirmPhone(_prev: { error?: string } | null, formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return { error: "login" };
  const parsed = parseTarget(String(formData.get("target") || ""));
  const code = String(formData.get("code") || "").trim();
  if (!parsed || parsed.channel !== "phone") return { error: "target" };
  const challenge = await prisma.otpChallenge.findFirst({
    where: { target: parsed.target, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.code !== code) return { error: "code" };
  const taken = await prisma.user.findUnique({ where: { phone: parsed.target } });
  if (taken && taken.id !== viewer.id) return { error: "taken" };
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
  await prisma.user.update({
    where: { id: viewer.id },
    data: { phone: parsed.target, phoneVerified: true },
  });
  revalidatePath("/me");
  const next = String(formData.get("next") || "").trim();
  redirect(next ? safeNext(next) : "/me?ok=phone");
}

export async function updateProfile(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  const nickname = String(formData.get("nickname") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const avatarUrl = String(formData.get("avatarUrl") || "").trim();
  if (nickname.length < 2 || nickname.length > 24) redirect("/me?err=nickname");
  if (bio.length > 500) redirect("/me?err=description");
  if (avatarUrl && !avatarUrl.startsWith("https://")) redirect("/me?err=photo_url");
  const storeName = String(formData.get("storeName") || "").trim();
  const storeDistrict = String(formData.get("storeDistrict") || "").trim();
  const storeLine1 = String(formData.get("storeLine1") || "").trim();
  const storeHours = String(formData.get("storeHours") || "").trim();
  const storeTouched = Boolean(storeName || storeDistrict || storeLine1 || storeHours);
  const districtOk = DISTRICTS.some(([name]) => name === storeDistrict);
  if (storeTouched && (!districtOk || storeLine1.length < 4 || storeLine1.length > 120 || storeName.length > 40 || storeHours.length > 80)) {
    redirect("/me?err=store");
  }
  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      nickname,
      bio,
      avatarUrl: avatarUrl || null,
      payoutMethod: String(formData.get("payoutMethod") || "").slice(0, 40) || null,
      payoutHolder: String(formData.get("payoutHolder") || "").slice(0, 80) || null,
      payoutAccount: String(formData.get("payoutAccount") || "").slice(0, 80) || null,
      storeName: storeTouched ? storeName || null : null,
      storeDistrict: storeTouched ? storeDistrict : null,
      storeLine1: storeTouched ? storeLine1 : null,
      storeHours: storeTouched ? storeHours || null : null,
      notifyBids: formData.get("notifyBids") === "on",
      notifyOffers: formData.get("notifyOffers") === "on",
      notifyOrders: formData.get("notifyOrders") === "on",
      notifyMessages: formData.get("notifyMessages") === "on",
    },
  });
  revalidatePath("/me");
  redirect("/me?ok=saved");
}

export async function saveAddress(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  const recipient = String(formData.get("recipient") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const line1 = String(formData.get("line1") || "").trim();
  const district = String(formData.get("district") || "").trim();
  if (recipient.length < 2 || phone.length < 8 || line1.length < 4 || !district) redirect("/me?err=address");
  const count = await prisma.address.count({ where: { userId: viewer.id } });
  if (formData.get("isDefault") === "on" || count === 0) {
    await prisma.address.updateMany({ where: { userId: viewer.id }, data: { isDefault: false } });
  }
  await prisma.address.create({
    data: {
      userId: viewer.id,
      recipient,
      phone,
      line1,
      district,
      isDefault: formData.get("isDefault") === "on" || count === 0,
    },
  });
  redirect("/me?ok=saved");
}

export async function deleteAddress(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  await prisma.address.deleteMany({ where: { id: String(formData.get("id") || ""), userId: viewer.id } });
  redirect("/me?ok=saved");
}

export async function clearHistory() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  await prisma.viewHistory.deleteMany({ where: { userId: viewer.id } });
  redirect("/me?ok=saved");
}
