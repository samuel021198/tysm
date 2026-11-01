import bcrypt from "bcryptjs";

const ROUNDS = 12;

/**
 * ponytail: bcrypt only mixes the first 72 bytes. A longer passphrase is stored truncated.
 * Upgrade path: argon2id if we need the tail to matter.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

let dummy: Promise<string> | null = null;

function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash("tysm-dummy-password-not-a-login", ROUNDS);
  return dummy;
}

/** Constant-time bcrypt compare. A missing hash still runs a compare against a dummy. */
export async function passwordMatches(plain: string, hash: string | null | undefined): Promise<boolean> {
  const stored = hash && hash.startsWith("$2") ? hash : await dummyHash();
  const ok = await bcrypt.compare(plain, stored);
  return Boolean(hash && hash.startsWith("$2")) && ok;
}
