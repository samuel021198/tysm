/** Public showcase login. `123` is not an email or an HK phone; the code stays fixed so it works in production. */
export const DEMO_SHOWCASE_TARGET = "123";
export const DEMO_SHOWCASE_CODE = "123";
export const DEMO_SHOWCASE_USER_ID = "user_showcase";
export const DEMO_SHOWCASE_NICKNAME = "卡桌阿傑";

export function demoShowcaseLogin(input: string): { channel: "demo"; target: typeof DEMO_SHOWCASE_TARGET } | null {
  if (input.trim() !== DEMO_SHOWCASE_TARGET) return null;
  return { channel: "demo", target: DEMO_SHOWCASE_TARGET };
}
