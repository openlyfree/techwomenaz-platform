export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashAuthToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sessionIsActive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

/** Defence in depth: re-check magic-token usability after the row is loaded. */
export function magicTokenIsUsable<T extends { consumedAt: Date | null; expiresAt: Date }>(
  row: T | undefined,
  now = new Date(),
): row is T {
  return !!row && row.consumedAt == null && row.expiresAt.getTime() > now.getTime();
}

/** A paused account must never receive or retain an authenticated session. */
export function memberCanAuthenticate<T extends { status: string }>(member: T | undefined): member is T {
  return !!member && member.status !== "paused";
}

export function createOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

const PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;

/**
 * Precomputed PBKDF2-SHA256 hash of a value that belongs to no account. Failed
 * sign-ins verify against it so response latency does not reveal whether an
 * email address or password hash exists (see auth.signIn).
 */
export const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$AQIDBAUGBwgJCgsMDQ4PEA$1CJ7SaW_Cr_sQbuDq7sIXJhpLRORfMWf_bZnNQ74D88";

/** Always performs a PBKDF2 verification, using the dummy hash when no real one exists. */
export async function verifyPasswordForSignIn(password: string, stored: string | null | undefined): Promise<boolean> {
  return verifyPassword(password, stored || DUMMY_PASSWORD_HASH);
}

/** PBKDF2-SHA256 password hash; salt is stored alongside the digest. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const digest = await derivePassword(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${btoa(String.fromCharCode(...salt)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}$${digest}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, digest] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !digest) return false;
  try {
    // Stored hashes are untrusted input: a corrupted or downgraded row must
    // degrade to an ordinary authentication failure, never an INTERNAL 500.
    const parsed = Number(iterations);
    const count = Number.isFinite(parsed)
      ? Math.min(MAX_PBKDF2_ITERATIONS, Math.max(1, Math.trunc(parsed)))
      : 1;
    const saltBytes = Uint8Array.from(atob(salt.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
    const candidate = await derivePassword(password, saltBytes, count);
    // Constant-time comparison to avoid leaking the digest through timing.
    if (candidate.length !== digest.length) return false;
    let difference = 0;
    for (let index = 0; index < candidate.length; index += 1) difference |= candidate.charCodeAt(index) ^ digest.charCodeAt(index);
    return difference === 0;
  } catch {
    // Malformed base64 salt, invalid iteration input or a failed derive must all
    // look exactly like a wrong password to the caller.
    return false;
  }
}

async function derivePassword(password: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Minimum accepted password length; matching a common-password blocklist is out of scope for this demo. */
export function passwordIsAcceptable(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}
