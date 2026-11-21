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
