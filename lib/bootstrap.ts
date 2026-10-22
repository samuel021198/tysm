import { createHash, timingSafeEqual } from "crypto";

/** Bearer token check for one-shot ops. Empty secret never authorizes. */
export function authorizedBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
