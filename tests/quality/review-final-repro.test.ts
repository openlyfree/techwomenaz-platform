import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { verifyPassword } from "../../server/auth-utils";
import type { Database } from "../../server/db";
import type { RuntimeEnv } from "../../server/env";
import { appRouter, type Context } from "../../server/router";

/**
 * Read-only reproducer tests written by tw-review (docs/FINISH-MISSION.md).
 * These document findings in docs/review/final/REVIEW.md. They are EXPECTED TO
 * FAIL against the current diff (RED reproducer tests); the owning agent should
 * make them green with the smallest safe fix, or the controller should accept
 * and delete them with a written rationale.
 */

/**
 * REVIEW finding R6 (medium): verifyPassword throws instead of returning false
 * when the stored hash is corrupted (e.g. iterations "0", or an invalid base64
 * salt). auth.signIn then surfaces an INTERNAL error instead of the uniform
 * 401 "email and password combination doesn't match" response, and — worse — a
 * corrupted row can never authenticate again while every other code path
 * degrades gracefully.
 *
 * Reproduction: node -e "import('./server/auth-utils.ts').then(m =>
 *   m.verifyPassword('x','pbkdf2$0$aaaa$bbbb').catch(e => console.log(e.constructor.name)))"
 * → TypeError, expected: false
 */
describe("verifyPassword robustness (review reproducer — currently RED)", () => {
  it("returns false (not a throw) when the stored iteration count is 0", async () => {
    await expect(verifyPassword("correct horse", "pbkdf2$0$aaaa$bbbb")).resolves.toBe(false);
  });

  it("returns false (not a throw) when the stored salt is not valid base64", async () => {
    await expect(verifyPassword("correct horse", "pbkdf2$100000$!!!invalid!!!$digest")).resolves.toBe(false);
  });
});

/**
 * REVIEW finding R1 (high): cloudflare.config.ts sets REQUIRE_MATCH_APPROVAL to
 * "false", so mutual-interest matches self-activate without coordinator
 * approval. AGENTS.md and docs/API-CONTRACT.md say coordinator approval is the
 * default ("true") and "false" is allowed only after a verified user
 * instruction — which tw-review has no record of. This guard documents the
 * contract default; flipping the config legitimately requires updating
 * docs/API-CONTRACT.md in the same change.
 *
 * Reproduction: grep -n "REQUIRE_MATCH_APPROVAL" cloudflare.config.ts
 * → bindings.text("false"), expected: bindings.text("true")
 */
describe("config sync guard (review reproducer — currently RED)", () => {
  it("keeps coordinator approval as the match-approval default in cloudflare.config.ts", () => {
    const source = readFileSync(
      resolve(__dirname, "../../cloudflare.config.ts"),
      "utf8",
    );
    expect(source).toMatch(/REQUIRE_MATCH_APPROVAL:\s*bindings\.text\("true"\)/);
  });
});

/**
 * Minimal router context: scripted select results and a recorder for values
 * written through insert/update. No PostgreSQL is contacted.
 */
function routerCtx(selectRows: unknown[][]): { ctx: Context; calls: Array<{ op: string; values?: unknown }> } {
  const calls: Array<{ op: string; values?: unknown }> = [];
  let selectIndex = 0;
  class Builder {
    constructor(
      private op: string,
      private result: unknown,
    ) {}
    from() { return this; }
    where() { return this; }
    limit() { return this; }
    orderBy() { return this; }
    innerJoin() { return this; }
    values(values: unknown) { calls.push({ op: this.op, values }); return this; }
    set(values: unknown) { calls.push({ op: this.op, values }); return this; }
    returning() { return this; }
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(this.result).then(resolve, reject);
    }
  }
  const db = {
    select: () => new Builder("select", selectRows[selectIndex++] ?? []),
    insert: () => new Builder("insert", [{}]),
    update: () => new Builder("update", [{}]),
    delete: () => new Builder("delete", [{}]),
  } as unknown as Database;
  return {
    ctx: {
      db,
      env: { APP_ORIGIN: "https://portal.example.org" } as RuntimeEnv,
      request: new Request("https://portal.example.org/"),
      responseHeaders: new Headers(),
    },
    calls,
  };
}

const UNIFORM_SIGNIN_ERROR =
  "That email and password combination doesn't match an account. Try again or reset your password.";

/** REVIEW finding H2: only magic-link verification may claim email ownership. */
describe("membership.join email ownership (review reproducer — currently RED)", () => {
  it("leaves emailVerifiedAt null for a password join", async () => {
    const { ctx, calls } = routerCtx([[]]);
    const result = await appRouter.createCaller(ctx).membership.join({
      name: "Applicant", email: "victim@example.com", experience: [], interests: [],
      password: "longenough1", newsletterConsent: false,
    });
    expect(result.id).toEqual(expect.any(String));
    const insert = calls.find((call) => call.op === "insert");
    expect(insert?.values).toMatchObject({
      email: "victim@example.com", status: "pending", emailVerifiedAt: null,
    });
    expect((insert?.values as { passwordHash?: unknown }).passwordHash).toBeTruthy();
  });
});

/** REVIEW finding M1: failed sign-ins must pay the same PBKDF2 cost as real ones. */
describe("auth.signIn constant work (review reproducer — currently RED)", () => {
  it("runs PBKDF2 and returns the uniform error for an unknown email", async () => {
    const deriveSpy = vi.spyOn(crypto.subtle, "deriveBits");
    try {
      const { ctx } = routerCtx([[]]);
      const error = await appRouter.createCaller(ctx).auth.signIn({
        email: "nobody@example.com", password: "wrong-password",
      }).catch((cause: unknown) => cause);
      expect((error as Error).message).toBe(UNIFORM_SIGNIN_ERROR);
      expect(deriveSpy).toHaveBeenCalledTimes(1);
    } finally {
      deriveSpy.mockRestore();
    }
  });

  it("runs PBKDF2 and returns the same error for a member with no password hash", async () => {
    const deriveSpy = vi.spyOn(crypto.subtle, "deriveBits");
    try {
      const { ctx } = routerCtx([[
        { id: "m1", email: "passwordless@example.com", name: "P", status: "approved", passwordHash: null },
      ]]);
      const error = await appRouter.createCaller(ctx).auth.signIn({
        email: "passwordless@example.com", password: "wrong-password",
      }).catch((cause: unknown) => cause);
      expect((error as Error).message).toBe(UNIFORM_SIGNIN_ERROR);
      expect(deriveSpy).toHaveBeenCalledTimes(1);
    } finally {
      deriveSpy.mockRestore();
    }
  });
});
