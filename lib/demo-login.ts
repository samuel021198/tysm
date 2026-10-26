/** Public demo logins. A handle is not an email or an HK phone. The code stays fixed so it works in production. */
export const DEMO_CODE = "123";

export const DEMO_ACCOUNTS = [
  { id: "user_mars", handle: "mars", nickname: "Mars" },
  { id: "user_tyu", handle: "tyu", nickname: "Tyu" },
  { id: "user_muel", handle: "muel", nickname: "MueL" },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

export function demoAccountByHandle(input: string): DemoAccount | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return DEMO_ACCOUNTS.find((row) => row.handle === key) ?? null;
}

export function demoAccountById(id: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((row) => row.id === id) ?? null;
}
