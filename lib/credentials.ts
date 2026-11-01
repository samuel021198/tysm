import { normalizePhone } from "./format";

/** Seeded system admin. Login field must be this exact lowercase handle. */
export const ADMIN_HANDLE = "admin";
export const ADMIN_USER_ID = "user_admin";
export const PASSWORD_MIN = 8;

/**
 * 8-digit HK mobile, stored as +852XXXXXXXX.
 * Strips spaces, hyphens, and a leading +852 / 852. Landlines (2/3) are not accounts.
 */
export function normalizeHkMobile(input: string): string | null {
  const phone = normalizePhone(input.trim());
  if (!phone || !/^\+852[4-9]\d{7}$/.test(phone)) return null;
  return phone;
}

export function parseLoginAccount(input: string): { kind: "admin" } | { kind: "phone"; phone: string } | { kind: "invalid" } {
  const value = input.trim();
  if (value === ADMIN_HANDLE) return { kind: "admin" };
  const phone = normalizeHkMobile(value);
  if (!phone) return { kind: "invalid" };
  return { kind: "phone", phone };
}

/** Registering the admin handle is refused. It is not a phone number. */
export function registerPhone(input: string): { ok: true; phone: string } | { ok: false; error: "phone_format" } {
  if (input.trim().toLowerCase() === ADMIN_HANDLE) return { ok: false, error: "phone_format" };
  const phone = normalizeHkMobile(input);
  if (!phone) return { ok: false, error: "phone_format" };
  return { ok: true, phone };
}

export function passwordIssue(password: string): "password_short" | null {
  if (password.length < PASSWORD_MIN) return "password_short";
  return null;
}
