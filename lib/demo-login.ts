/** Public demo logins. A handle is not an email or an HK phone. The code stays fixed so it works in production. */
export const DEMO_CODE = "123";

export const DEMO_ACCOUNTS = [
  { id: "user_mars", handle: "mars", nickname: "Mars" },
  { id: "user_tyu", handle: "tyu", nickname: "Tyu" },
  { id: "user_muel", handle: "muel", nickname: "MueL" },
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
