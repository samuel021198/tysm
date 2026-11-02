import { normalizePhone } from "./format";

/** Public demo logins. The code stays fixed so the login footer works in production. */
export const DEMO_CODE = "123";

/** Phones match the seeded Mars / Tyu / MueL rows. Not the Wave-1 soft-seed sellers. */
export const DEMO_ACCOUNTS = [
  { id: "user_mars", handle: "mars", nickname: "Mars", phone: "+85291000001" },
  { id: "user_tyu", handle: "tyu", nickname: "Tyu", phone: "+85291000002" },
  { id: "user_muel", handle: "muel", nickname: "MueL", phone: "+85291000003" },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

/** Extra trial logins. Same code as the three buttons. Not shown on the login footer. */
export const TRIAL_ACCOUNTS = [
  { id: "user_kai", handle: "kai", nickname: "Kai" },
  { id: "user_hoi", handle: "hoi", nickname: "Hoi" },
  { id: "user_suki", handle: "suki", nickname: "Suki" },
  { id: "user_lok", handle: "lok", nickname: "Lok" },
  { id: "user_yan", handle: "yan", nickname: "Yan" },
  { id: "user_jun", handle: "jun", nickname: "Jun" },
  { id: "user_mika", handle: "mika", nickname: "Mika" },
  { id: "user_bao", handle: "bao", nickname: "Bao" },
  { id: "user_rafa", handle: "rafa", nickname: "Rafa" },
  { id: "user_ace", handle: "ace", nickname: "Ace" },
] as const;

export function demoAccountByHandle(input: string): { id: string; handle: string; nickname: string } | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return DEMO_ACCOUNTS.find((row) => row.handle === key) ?? TRIAL_ACCOUNTS.find((row) => row.handle === key) ?? null;
}

export function demoAccountById(id: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((row) => row.id === id) ?? null;
}

export function demoAccountByPhone(input: string): DemoAccount | null {
  const phone = normalizePhone(input.trim());
  if (!phone) return null;
  return DEMO_ACCOUNTS.find((row) => row.phone === phone) ?? null;
}

/** Eight digits for the login field. The stored value stays +852. */
export function demoPhoneInput(phone: string): string {
  return phone.startsWith("+852") ? phone.slice(4) : phone;
}

/** The shared code is only accepted for the three demo phones. Other accounts stay at the normal minimum. */
export function acceptsDemoPassword(phone: string, password: string): boolean {
  return password === DEMO_CODE && demoAccountByPhone(phone) !== null;
}
