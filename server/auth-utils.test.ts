import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashAuthToken, normalizeEmail, sessionIsActive } from "./auth-utils";

describe("authentication utilities", () => {
  it("normalizes email claims without changing their individual identity", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("stores only a deterministic hash of an opaque token", async () => {
    const token = crypto.randomUUID();
    expect(await hashAuthToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashAuthToken(token)).toBe(await hashAuthToken(token));
    expect(await hashAuthToken(token)).not.toBe(token);
  });

  it("rejects expired sessions at the expiry boundary", () => {
    const now = new Date("2026-11-21T18:00:00.000Z");
    expect(sessionIsActive(new Date("2026-11-21T18:00:01.000Z"), now)).toBe(true);
    expect(sessionIsActive(new Date("2026-11-21T18:00:00.000Z"), now)).toBe(false);
  });

  it("creates URL-safe, unpredictable opaque tokens", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(encodeURIComponent(first)).toBe(first);
  });

  it("does not confuse two different tokens after hashing", async () => {
    expect(await hashAuthToken("token-a")).not.toBe(await hashAuthToken("token-b"));
  });
});
