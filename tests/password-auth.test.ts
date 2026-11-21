import { describe, expect, it } from "vitest";
import { hashPassword, memberCanAuthenticate, passwordIsAcceptable, verifyPassword } from "../server/auth-utils";

describe("password credentials", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^pbkdf2\$100000\$/);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("uses a unique salt so identical passwords produce different hashes", async () => {
    const left = await hashPassword("same-password");
    const right = await hashPassword("same-password");
    expect(left).not.toBe(right);
  });

  it("rejects malformed or short credentials", async () => {
    expect(passwordIsAcceptable("short")).toBe(false);
    expect(passwordIsAcceptable("long-enough-password")).toBe(true);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("refuses to authenticate paused or missing accounts", () => {
    expect(memberCanAuthenticate({ status: "approved" })).toBe(true);
    expect(memberCanAuthenticate({ status: "pending" })).toBe(true);
    expect(memberCanAuthenticate({ status: "paused" })).toBe(false);
    expect(memberCanAuthenticate(undefined)).toBe(false);
  });
});
