"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { syncAdminPasswordFromEnv } from "@/lib/admin-password";
import { clearSessionCookie, getViewer, setSessionCookie } from "@/lib/auth";
import { ADMIN_USER_ID, parseLoginAccount, passwordIssue, registerPhone } from "@/lib/credentials";
import { DEMO_CODE, demoAccountByHandle, demoAccountById } from "@/lib/demo-login";
import { hashPassword, passwordMatches } from "@/lib/password";
import { DISTRICTS, isAllowedMediaUrl, parseTarget, safeNext } from "@/lib/format";
import {
  USERNAME_CHANGE_LIMIT,
  USERNAME_CHANGE_WINDOW_MS,
  cleanBio,
  cleanHandoverPlace,
  normalizeUsername,
  parseInterestTags,
  parseProfileLinks,
} from "@/lib/profile-edit";
import { PhotoStoreError, storeUploadedImage } from "@/lib/r2";
import { headers } from "next/headers";
import { PROMO_GRANT } from "@/lib/promo";

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

export async function loginWithPassword(_prev: { error?: string } | null, formData: FormData) {
  const parsed = parseLoginAccount(String(formData.get("account") || ""));
  const password = String(formData.get("password") || "");
  if (parsed.kind === "invalid") return { error: "phone_format" };
  if (passwordIssue(password)) return { error: "password_short" };
  if (parsed.kind === "admin") {
    await syncAdminPasswordFromEnv();
    const admin = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });
    const eligible = admin?.role === "ADMIN" ? admin : null;
    const ok = await passwordMatches(password, eligible?.passwordHash);
    if (!eligible || !ok) return { error: "credentials" };
    if (eligible.disabled) return { error: "disabled" };
    await setSessionCookie(eligible.id);
    redirect("/admin");
  }
  const user = await prisma.user.findUnique({ where: { phone: parsed.phone } });
  const account = user?.role === "USER" ? user : null;
  const matches = await passwordMatches(password, account?.passwordHash);
  if (!account || !matches) return { error: "credentials" };
  if (account.disabled) return { error: "disabled" };
  await setSessionCookie(account.id);
  redirect(safeNext(formData.get("next")));
}

export async function registerWithPassword(_prev: { error?: string } | null, formData: FormData) {
  if (String(formData.get("username") || "").trim().toLowerCase() === "admin") return { error: "phone_format" };
  const phone = registerPhone(String(formData.get("phone") || ""));
  if (!phone.ok) return { error: phone.error };
  const password = String(formData.get("password") || "");
  if (passwordIssue(password)) return { error: "password_short" };
  if (String(formData.get("confirm") || "") !== password) return { error: "password_mismatch" };
  const nickname = String(formData.get("nickname") || "").trim();
  if (!nickname) return { error: "nickname_required" };
  if (nickname.length > 24) return { error: "nickname" };
  if (formData.get("accept") !== "on") return { error: "terms_tick" };
  const taken = await prisma.user.findUnique({ where: { phone: phone.phone } });
  if (taken) return { error: "phone_taken" };
  try {
    const user = await prisma.user.create({
      data: {
        phone: phone.phone,
        passwordHash: await hashPassword(password),
        nickname,
        role: "USER",
        phoneVerified: false,
        termsAcceptedAt: new Date(),
        promoBalance: PROMO_GRANT,
        promoToast: "earn",
      },
    });
    await setSessionCookie(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "phone_taken" };
    throw error;
  }
  redirect(safeNext(formData.get("next")));
}

export async function requestOtp(_prev: { error?: string; code?: string; target?: string } | null, formData: FormData) {
  const raw = String(formData.get("target") || "");
  const demo = demoAccountByHandle(raw);
  const parsed = demo ? { channel: "demo" as const, target: demo.handle } : parseTarget(raw);
  if (!parsed) return { error: "target" };
  const recent = await prisma.otpChallenge.findFirst({
    where: { target: parsed.target },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < 30_000) {
    return { error: "rate", target: parsed.target };
  }
  const code = demo ? DEMO_CODE : String(randomInt(100000, 999999));
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

/** One tap on the login footer. Only the three seeded demo ids. Hidden on /login this turn. */
export async function enterDemo(formData: FormData) {
  const account = demoAccountById(String(formData.get("userId") || ""));
  if (!account) redirect("/login?err=showcase");
  const user = await prisma.user.findUnique({ where: { id: account.id } });
  if (!user) redirect("/login?err=showcase");
  await setSessionCookie(user.id);
  const next = safeNext(formData.get("next"));
  redirect(next === "/" || next.startsWith("/login") ? "/me" : next);
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

const settings = "/me/settings";
const editPath = "/me/edit";

class UsernameRateError extends Error {}
class UsernameTakenError extends Error {}

async function readAvatar(formData: FormData, current: string | null): Promise<{ ok: true; url: string | null } | { ok: false }> {
  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (file.size > 120_000 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false };
    const data = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    try {
      const stored = await storeUploadedImage(data, "uploads/avatars");
      if (!isAllowedMediaUrl(stored)) return { ok: false };
      return { ok: true, url: stored };
    } catch (error) {
      if (error instanceof PhotoStoreError) return { ok: false };
      throw error;
    }
  }
  const typed = String(formData.get("avatarUrl") || "").trim();
  if (!typed) return { ok: true, url: current };
  if (!isAllowedMediaUrl(typed)) return { ok: false };
  return { ok: true, url: typed };
}

export async function saveProfile(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${editPath}`);
  const nickname = String(formData.get("nickname") || "").trim();
  if (nickname.length < 2 || nickname.length > 24) redirect(`${editPath}?err=nickname`);
  const bio = cleanBio(String(formData.get("bio") || ""));
  if (!bio.ok) redirect(`${editPath}?err=bio`);
  const place = cleanHandoverPlace(String(formData.get("handoverPlace") || ""));
  if (!place.ok) redirect(`${editPath}?err=place`);
  const links = parseProfileLinks(formData.getAll("link").map((value) => String(value)));
  if (!links.ok) redirect(`${editPath}?err=${links.error}`);
  const tags = parseInterestTags(String(formData.get("interestTags") || ""));
  if (!tags.ok) redirect(`${editPath}?err=tags`);
  const avatar = await readAvatar(formData, viewer.avatarUrl);
  if (!avatar.ok) redirect(`${editPath}?err=photo_url`);

  const rawName = String(formData.get("username") || "");
  const nextName = rawName.trim() ? normalizeUsername(rawName) : null;
  if (rawName.trim() && !nextName) redirect(`${editPath}?err=username`);
  if (!nextName && viewer.username) redirect(`${editPath}?err=username`);
  const usernameChanged = Boolean(nextName && nextName !== viewer.username);

  try {
    await prisma.$transaction(async (tx) => {
      if (usernameChanged && nextName) {
        const since = new Date(Date.now() - USERNAME_CHANGE_WINDOW_MS);
        const used = await tx.usernameChange.count({ where: { userId: viewer.id, createdAt: { gte: since } } });
        if (used >= USERNAME_CHANGE_LIMIT) throw new UsernameRateError();
        const taken = await tx.user.findFirst({ where: { username: nextName, NOT: { id: viewer.id } }, select: { id: true } });
        if (taken) throw new UsernameTakenError();
      }
      await tx.user.update({
        where: { id: viewer.id },
        data: {
          nickname,
          bio: bio.bio,
          avatarUrl: avatar.url,
          handoverPlace: place.place,
          profileLinks: links.links,
          interestTags: tags.tags,
          ...(usernameChanged && nextName ? { username: nextName } : {}),
        },
      });
      if (usernameChanged && nextName) {
        await tx.usernameChange.create({ data: { userId: viewer.id, username: nextName } });
      }
    });
  } catch (error) {
    if (error instanceof UsernameRateError) redirect(`${editPath}?err=username_rate`);
    if (error instanceof UsernameTakenError) redirect(`${editPath}?err=username_taken`);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect(`${editPath}?err=username_taken`);
    throw error;
  }
  revalidatePath("/me");
  revalidatePath(editPath);
  revalidatePath(`/shop/${viewer.id}`);
  redirect(`${editPath}?ok=saved`);
}

export async function saveNotifications(formData: FormData) {
  const viewer = await getViewer();
  const next = `${settings}/notifications`;
  if (!viewer) redirect(`/login?next=${next}`);
  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      notifyBids: formData.get("notifyBids") === "on",
      notifyOffers: formData.get("notifyOffers") === "on",
      notifyOrders: formData.get("notifyOrders") === "on",
      notifyMessages: formData.get("notifyMessages") === "on",
      notifyEmail: formData.get("notifyEmail") === "on",
    },
  });
  revalidatePath(next);
  redirect(`${next}?ok=saved`);
}

export async function saveShop(formData: FormData) {
  const viewer = await getViewer();
  const next = `${settings}/account`;
  if (!viewer) redirect(`/login?next=${next}`);
  const storeName = String(formData.get("storeName") || "").trim();
  const storeDistrict = String(formData.get("storeDistrict") || "").trim();
  const storeLine1 = String(formData.get("storeLine1") || "").trim();
  const storeHours = String(formData.get("storeHours") || "").trim();
  const storeTouched = Boolean(storeName || storeDistrict || storeLine1 || storeHours);
  const districtOk = DISTRICTS.some(([name]) => name === storeDistrict);
  if (storeTouched && (!districtOk || storeLine1.length < 4 || storeLine1.length > 120 || storeName.length > 40 || storeHours.length > 80)) {
    redirect(`${next}?err=store`);
  }
  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      storeName: storeTouched ? storeName || null : null,
      storeDistrict: storeTouched ? storeDistrict : null,
      storeLine1: storeTouched ? storeLine1 : null,
      storeHours: storeTouched ? storeHours || null : null,
    },
  });
  revalidatePath(next);
  redirect(`${next}?ok=saved`);
}

export async function saveAddress(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${settings}`);
  const recipient = String(formData.get("recipient") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const line1 = String(formData.get("line1") || "").trim();
  const district = String(formData.get("district") || "").trim();
  if (recipient.length < 2 || phone.length < 8 || line1.length < 4 || !district) redirect(`${settings}/account?err=address`);
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
  redirect(`${settings}/account?ok=saved`);
}

export async function deleteAddress(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${settings}`);
  await prisma.address.deleteMany({ where: { id: String(formData.get("id") || ""), userId: viewer.id } });
  redirect(`${settings}/account?ok=saved`);
}

export async function clearHistory() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${settings}/privacy`);
  await prisma.viewHistory.deleteMany({ where: { userId: viewer.id } });
  redirect(`${settings}/privacy?ok=saved`);
}
