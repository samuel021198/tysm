import { ADMIN_USER_ID, PASSWORD_MIN } from "./credentials";
import { prisma } from "./db";
import { hashPassword, passwordMatches } from "./password";

/**
 * Sets user_admin's password from ADMIN_PASSWORD.
 * No-op when the env is missing or shorter than 8. Does not clear an existing hash.
 * The plaintext is never read from a request body.
 */
export async function syncAdminPasswordFromEnv(): Promise<"updated" | "unchanged" | "skipped" | "missing"> {
  const plain = process.env.ADMIN_PASSWORD ?? "";
  if (plain.length < PASSWORD_MIN) return "skipped";
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });
  if (!admin || admin.role !== "ADMIN") return "missing";
  if (await passwordMatches(plain, admin.passwordHash)) return "unchanged";
  await prisma.user.update({
    where: { id: ADMIN_USER_ID },
    data: { passwordHash: await hashPassword(plain) },
  });
  return "updated";
}
