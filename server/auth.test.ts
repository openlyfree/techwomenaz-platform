import { describe, expect, it, vi } from "vitest";
import type { Database } from "./db";
import type { RuntimeEnv } from "./env";
import { hashAuthToken } from "./auth-utils";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  destroySession,
  getSessionUser,
  sendMagicLink,
  sessionCookie,
  verifyMagicLink,
} from "./auth";

const FIXED_NOW = new Date("2026-11-21T18:00:00.000Z");
const ORIGIN = "https://portal.example.org";

function request(origin = ORIGIN, cookie = ""): Request {
  return new Request(`${origin}/portal`, { headers: cookie ? { cookie } : {} });
}

function envWithEmail(send: (message: unknown) => Promise<void> = async () => {}): RuntimeEnv {
  return { APP_ORIGIN: ORIGIN, EMAIL_FROM: "no-reply@example.org", EMAIL: { send } } as RuntimeEnv;
}

/**
 * Minimal injectable Database stand-in. It records the table/values used by each
 * query and returns scripted rows in call order; no real PostgreSQL is contacted.
 */
interface FakeResults {
  select?: unknown[][];
  insert?: unknown[];
  update?: unknown[];
  delete?: unknown[];
}

function fakeDb(results: FakeResults = {}) {
  const calls: Array<{ op: string; table?: unknown; values?: unknown }> = [];
  const cursor = { select: 0, insert: 0, update: 0, delete: 0 };

  class Builder {
    constructor(
      private op: string,
      private table: unknown,
      private result: unknown,
    ) {}

    from(table: unknown) { this.table = table; calls.push({ op: this.op, table }); return this; }
    innerJoin() { return this; }
    where() { return this; }
    limit() { return this; }
    values(values: unknown) { calls.push({ op: this.op, table: this.table, values }); return this; }
    set(values: unknown) { calls.push({ op: this.op, table: this.table, values }); return this; }
    returning() { return this; }
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(this.result).then(resolve, reject);
    }
  }

  const take = (op: keyof FakeResults) => {
    const list = (results[op] as unknown[] | undefined) ?? [];
    return list[cursor[op]++] ?? [];
  };

  const db = {
    select: () => new Builder("select", undefined, take("select")),
    insert: (table: unknown) => new Builder("insert", table, take("insert")),
    update: (table: unknown) => new Builder("update", table, take("update")),
    delete: (table: unknown) => {
      calls.push({ op: "delete", table });
      return new Builder("delete", table, take("delete"));
    },
    async transaction<T>(fn: (tx: unknown) => Promise<T>) { return fn(db); },
    calls,
  };
  return db as unknown as Database & { calls: typeof calls };
}

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1", email: "dev@example.com", name: "Dev", role: "member",
    status: "approved", emailVerifiedAt: null, ...overrides,
  };
}

const validToken = () => ({
  id: "tok-1", email: "dev@example.com",
  consumedAt: null, expiresAt: new Date("2030-01-01T00:00:00.000Z"),
});

function verifyDb(tokenRow: unknown, member = memberRow()) {
  return fakeDb({
    select: [[tokenRow], [member]],
    // First update consumes the token (returning), second marks the email verified.
    update: [[{ id: "tok-1" }], [{}]],
    insert: [{}],
  });
}

describe("sendMagicLink", () => {
  it("hashes the token at rest and never returns or logs the raw value", async () => {
    const raws: string[] = [];
    const db = fakeDb({ select: [[{ count: 0 }]], insert: [{}] });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await sendMagicLink(
        db, envWithEmail(), request(), " Dev@Example.com ",
        {
          now: () => FIXED_NOW,
          token: () => "magic-token-abc123",
          deliver: async (_env: RuntimeEnv, message: { raw: string }) => { raws.push(message.raw); },
        },
      );

      expect(result).toBeUndefined();
      const insert = db.calls.find((call) => call.op === "insert");
      const values = insert?.values as Record<string, unknown>;
      expect(values).toMatchObject({ email: "dev@example.com" });
      expect(values.tokenHash).toBe(await hashAuthToken("magic-token-abc123"));
      expect((values.expiresAt as Date).toISOString()).toBe("2026-11-21T18:15:00.000Z");
      expect(JSON.stringify(values)).not.toContain("magic-token-abc123");
      expect(raws).toHaveLength(1);
      expect(raws[0]).toContain("token=magic-token-abc123");
      expect(logSpy.mock.calls.flat().join(" ")).not.toContain("magic-token-abc123");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("magic-token-abc123");
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("fails truthfully when the Cloudflare EMAIL binding is missing and writes nothing", async () => {
    const db = fakeDb();
    const deliver = vi.fn();
    await expect(
      sendMagicLink(
        db,
        { APP_ORIGIN: ORIGIN, EMAIL_FROM: "no-reply@example.org" } as RuntimeEnv,
        request(), "dev@example.com",
        { deliver },
      ),
    ).rejects.toThrow(/not configured/i);
    expect(db.calls.filter((call) => call.op === "insert")).toHaveLength(0);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("stops issuing links after the hourly request cap", async () => {
    const db = fakeDb({ select: [[{ count: 5 }]] });
    await expect(
      sendMagicLink(db, envWithEmail(), request(), "dev@example.com", { token: () => "t" }),
    ).rejects.toThrow(/too many/i);
    expect(db.calls.filter((call) => call.op === "insert")).toHaveLength(0);
  });

  it("reports delivery failure honestly without echoing the token", async () => {
    const db = fakeDb({ select: [[{ count: 0 }]], insert: [{}] });
    const failure = sendMagicLink(db, envWithEmail(), request(), "dev@example.com", {
      token: () => "secret-magic-token",
      deliver: async () => { throw new Error("SMTP secret-magic-token refused"); },
    });
    await expect(failure).rejects.toThrow(/could not send/i);
    await failure.catch((error: Error) => expect(error.message).not.toContain("secret-magic-token"));
  });
});

describe("verifyMagicLink", () => {
  it("rejects an expired token even when a token row is supplied", async () => {
    const db = verifyDb({ ...validToken(), expiresAt: new Date("2000-01-01T00:00:00.000Z") });
    await expect(verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW })).rejects.toThrow(/expired|invalid/i);
  });

  it("rejects an already consumed token (single use)", async () => {
    const db = verifyDb({ ...validToken(), consumedAt: new Date("2026-11-21T17:00:00.000Z") });
    await expect(verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW })).rejects.toThrow(/used|invalid/i);
  });

  it("does not issue a session to a paused member", async () => {
    const db = verifyDb(validToken(), memberRow({ status: "paused" }));
    await expect(verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW })).rejects.toThrow(/paused|unavailable|active/i);
  });

  it("rejects a token with no matching row", async () => {
    const db = fakeDb({ select: [[]] });
    await expect(verifyMagicLink(db, "unknown-token", { now: () => FIXED_NOW })).rejects.toThrow(/invalid/i);
  });

  it("rejects a token whose membership application no longer exists", async () => {
    const db = fakeDb({ select: [[validToken()], []] });
    await expect(verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW })).rejects.toThrow(/application/i);
  });

  it("rejects a token when the conditional consume updates no row", async () => {
    const db = fakeDb({
      select: [[validToken()], [memberRow()]],
      update: [[], [{}]],
    });
    await expect(verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW })).rejects.toThrow(/already used/i);
  });

  it("consumes a valid token once and returns only a fresh opaque session token", async () => {
    const db = verifyDb(validToken());
    const result = await verifyMagicLink(db, "magic-token-abc123", { now: () => FIXED_NOW });
    expect(result).toMatchObject({ memberId: "member-1" });
    expect(typeof result.sessionToken).toBe("string");
    expect(result.sessionToken).not.toBe("magic-token-abc123");
    const consume = db.calls.find((call) => call.op === "update" && (call.values as { consumedAt?: unknown } | undefined)?.consumedAt);
    expect(consume).toBeDefined();
    const sessionInsert = db.calls.find((call) => call.op === "insert");
    const sessionValues = sessionInsert?.values as Record<string, unknown>;
    expect(sessionValues.tokenHash).toBe(await hashAuthToken(result.sessionToken));
    expect(JSON.stringify(sessionValues)).not.toContain(result.sessionToken);
  });
});

describe("getSessionUser", () => {
  const future = new Date("2030-01-01T00:00:00.000Z");

  it("returns null for an expired session row", async () => {
    const db = fakeDb({ select: [[{
      id: "member-1", name: "Dev", email: "dev@example.com", role: "member",
      status: "approved", sessionId: "s1", sessionExpiresAt: new Date("2000-01-01T00:00:00.000Z"),
    }]] });
    const user = await getSessionUser(db, request(ORIGIN, `${SESSION_COOKIE}=anything`), { now: () => FIXED_NOW });
    expect(user).toBeNull();
  });

  it("returns null for a paused staff member even with a live session row", async () => {
    const db = fakeDb({ select: [[{
      id: "member-1", name: "Dev", email: "dev@example.com", role: "admin",
      status: "paused", sessionId: "s1", sessionExpiresAt: future,
    }]] });
    const user = await getSessionUser(db, request(ORIGIN, `${SESSION_COOKIE}=anything`), { now: () => FIXED_NOW });
    expect(user).toBeNull();
  });

  it("never grants admin from request headers; the role comes from the database", async () => {
    const db = fakeDb({ select: [[{
      id: "member-1", name: "Dev", email: "dev@example.com", role: "member",
      status: "approved", sessionId: "s1", sessionExpiresAt: future,
    }]] });
    const req = new Request(`${ORIGIN}/portal`, {
      headers: { cookie: `${SESSION_COOKIE}=valid`, "x-role": "admin", "x-user-role": "admin" },
    });
    const user = await getSessionUser(db, req, { now: () => FIXED_NOW });
    expect(user?.role).toBe("member");
  });

  it("returns null for a forged cookie that has no matching session", async () => {
    const db = fakeDb({ select: [[]] });
    expect(await getSessionUser(db, request(ORIGIN, `${SESSION_COOKIE}=forged`))).toBeNull();
  });

  it("returns null without touching the database when no session cookie is present", async () => {
    const db = fakeDb();
    expect(await getSessionUser(db, request())).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it("ignores an oversized cookie value", async () => {
    const db = fakeDb();
    expect(await getSessionUser(db, request(ORIGIN, `${SESSION_COOKIE}=${"a".repeat(300)}`))).toBeNull();
    expect(db.calls).toHaveLength(0);
  });
});

describe("destroySession", () => {
  it("deletes exactly the presented session", async () => {
    const db = fakeDb({ delete: [{}] });
    await destroySession(db, request(ORIGIN, `${SESSION_COOKIE}=secret-token`));
    expect(db.calls.filter((call) => call.op === "delete")).toHaveLength(1);
  });
});

describe("session cookies", () => {
  it("sets HttpOnly, SameSite=Lax, Secure and a bounded Max-Age on HTTPS", () => {
    const cookie = sessionCookie("opaque.session.token", request(), envWithEmail());
    expect(cookie).toContain(`${SESSION_COOKIE}=opaque.session.token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it("omits Secure for all recognized loopback forms only", () => {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
      const cookie = sessionCookie("t", request(origin), { APP_ORIGIN: origin } as RuntimeEnv);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).not.toContain("; Secure");
    }
  });

  it("keeps Secure on a non-loopback http origin", () => {
    const origin = "http://production.example.com";
    const env = { APP_ORIGIN: origin } as RuntimeEnv;
    expect(sessionCookie("t", request(origin), env)).toContain("Secure");
    expect(clearSessionCookie(request(origin), env)).toContain("Secure");
  });

  it("expires the cookie immediately on clear", () => {
    const cookie = clearSessionCookie(request(), envWithEmail());
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });
});
