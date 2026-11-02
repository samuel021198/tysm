import { demoStores, demoUsers } from "../prisma/demo-catalog";
import { DEMO_ACCOUNTS, DEMO_CODE } from "./demo-login";
import { prisma } from "./db";
import { hashPassword } from "./password";

function sellerProfile(id: string) {
  const person = demoUsers.find((user) => user.id === id);
  const store = demoStores.find((row) => row.userId === id);
  const tier: "NORMAL" | "TRUSTED" | "MERCHANT" =
    person && "verificationTier" in person && (person.verificationTier === "TRUSTED" || person.verificationTier === "MERCHANT")
      ? person.verificationTier
      : "NORMAL";
  return {
    bio: person && "bio" in person ? person.bio : null,
    avatarUrl: person && "avatarUrl" in person ? (person.avatarUrl ?? null) : null,
    verificationTier: tier,
    storeName: store?.storeName ?? null,
    storeDistrict: store?.storeDistrict ?? null,
    storeLine1: store?.storeLine1 ?? null,
    storeHours: store?.storeHours ?? null,
    handoverPlace: store?.storeDistrict ?? null,
  };
}

/**
 * Upserts Mars, Tyu, and MueL so phone + 123 can log in.
 * Does not delete users, posts, or listings. Admin is not touched.
 */
export async function seedDemoLogins() {
  const passwordHash = await hashPassword(DEMO_CODE);
  for (const account of DEMO_ACCOUNTS) {
    const phoneOwner = await prisma.user.findUnique({ where: { phone: account.phone } });
    if (phoneOwner && phoneOwner.id !== account.id) throw new Error("demo_phone_taken");
    const existing = await prisma.user.findUnique({ where: { id: account.id } });
    if (!existing) {
      const email = `${account.handle}@tysm.hk`;
      const [emailOwner, usernameOwner] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.user.findUnique({ where: { username: account.handle } }),
      ]);
      const profile = sellerProfile(account.id);
      await prisma.user.create({
        data: {
          id: account.id,
          phone: account.phone,
          email: emailOwner ? null : email,
          username: usernameOwner ? null : account.handle,
          nickname: account.nickname,
          role: "USER",
          phoneVerified: true,
          emailVerified: true,
          termsAcceptedAt: new Date(),
          passwordHash,
          ...profile,
        },
      });
      continue;
    }
    const usernameTaken = existing.username
      ? null
      : await prisma.user.findUnique({ where: { username: account.handle } });
    await prisma.user.update({
      where: { id: account.id },
      data: {
        passwordHash,
        phone: account.phone,
        phoneVerified: true,
        ...(existing.username || usernameTaken ? {} : { username: account.handle }),
      },
    });
  }
  return { wiped: false as const, users: DEMO_ACCOUNTS.map((row) => row.id) };
}
