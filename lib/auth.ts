import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { normalizePhone } from "./format";
import type { Locale } from "./i18n";

const SESSION = "tysm_session";

function secret() {
  return process.env.SESSION_SECRET || "tysm-dev-session-secret-change-me";
}

export function encodeSession(userId: string): string {
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodeSession(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

async function promoteAdmin(user: User): Promise<User> {
  const emails = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const phones = (process.env.ADMIN_PHONE || "")
    .split(",")
    .map((s) => normalizePhone(s.trim()) || s.trim())
    .filter(Boolean);
  const match =
    (user.email && emails.includes(user.email.toLowerCase())) || (user.phone && phones.includes(user.phone));
  if (match && user.role !== "ADMIN") {
    return prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  return user;
}

export const getViewer = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION)?.value;
  if (!token) return null;
  const id = decodeSession(token);
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return promoteAdmin(user);
});

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION);
}

export const getPrefs = cache(async (): Promise<{ locale: Locale; theme: "light" | "dark" }> => {
  const jar = await cookies();
  const locale = jar.get("tysm_locale")?.value === "en" ? "en" : "zh-HK";
  const theme = jar.get("tysm_theme")?.value === "dark" ? "dark" : "light";
  return { locale, theme };
});

export async function getCommissionBps(): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "commission_percent" } });
  if (!row) return 800;
  const { percentInputToBps } = await import("./rules");
  return percentInputToBps(row.value) ?? 800;
}
