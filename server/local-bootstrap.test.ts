import { describe, expect, it } from "vitest";
import { bootstrapConfig, main } from "../scripts/local-session.mjs";

describe("private local development session bootstrap", () => {
  it("requires an explicit local-only confirmation and loopback app origin", () => {
    expect(() => bootstrapConfig({})).toThrow(/LOCAL_BOOTSTRAP_CONFIRM/);
    expect(() => bootstrapConfig({ LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY", LOCAL_BOOTSTRAP_EMAIL: "dev@example.com", APP_ORIGIN: "https://production.example.com" })).toThrow(/loopback/);
  });

  it("accepts bracketed IPv6 loopback origins", () => {
    expect(bootstrapConfig({
      LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY", LOCAL_BOOTSTRAP_EMAIL: "dev@example.com",
      APP_ORIGIN: "http://[::1]:3000",
    })).toMatchObject({ email: "dev@example.com", origin: "http://[::1]:3000" });
  });

  it("accepts an individually named local account and validated role", () => {
    const config = bootstrapConfig({ LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY", LOCAL_BOOTSTRAP_EMAIL: "Dev@Example.com", LOCAL_BOOTSTRAP_ROLE: "admin", APP_ORIGIN: "http://localhost:3000" });
    expect(config).toMatchObject({ email: "dev@example.com", role: "admin", name: "Local Developer" });
    expect(config).not.toHaveProperty("sessionToken");
  });

  it("never permits arbitrary role claims", () => {
    expect(() => bootstrapConfig({ LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY", LOCAL_BOOTSTRAP_EMAIL: "dev@example.com", LOCAL_BOOTSTRAP_ROLE: "superuser", APP_ORIGIN: "http://127.0.0.1:3000" })).toThrow(/ROLE/);
  });

  it("rejects non-loopback http origins and lookalike hosts", () => {
    const base = { LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY", LOCAL_BOOTSTRAP_EMAIL: "dev@example.com" };
    expect(() => bootstrapConfig({ ...base, APP_ORIGIN: "http://evil.example.com" })).toThrow(/loopback/);
    expect(() => bootstrapConfig({ ...base, APP_ORIGIN: "http://localhost.evil.example.com" })).toThrow(/loopback/);
    expect(() => bootstrapConfig({ ...base, APP_ORIGIN: "https://localhost:3000" })).toThrow(/loopback/);
  });

  it("writes an HttpOnly credential with mode 0600 and never logs the token", async () => {
    const writes: Array<{ path: string; data: string; options: { mode?: number } }> = [];
    const logs: string[] = [];
    const fakeClient = {
      connect: async () => {},
      query: async (sql: string) => (sql.includes("INSERT INTO members") ? { rows: [{ id: "member-local-1" }] } : { rows: [] }),
      end: async () => {},
    };

    await main({
      env: {
        LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY",
        LOCAL_BOOTSTRAP_EMAIL: "dev@example.com",
        APP_ORIGIN: "http://localhost:3000",
      },
      clientFactory: () => fakeClient,
      mkdir: async () => {},
      writeFile: async (path: string, data: string, options: { mode?: number }) => { writes.push({ path, data, options }); },
      log: (message: string) => { logs.push(message); },
      errorLog: (message: string) => { logs.push(message); },
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].options.mode).toBe(0o600);
    expect(writes[0].path.startsWith("/tmp/opencode/")).toBe(true);
    const parsed = JSON.parse(writes[0].data);
    expect(parsed.cookie).toContain("HttpOnly");
    expect(logs.join("\n")).not.toContain(parsed.cookie);
    expect(logs.join("\n")).not.toMatch(/twaz_session=[A-Za-z0-9_-]+/);
  });

  it("rolls back, redacts errors and writes no credential when the database fails", async () => {
    const previousExitCode = process.exitCode;
    const writes: string[] = [];
    const logs: string[] = [];
    const queries: string[] = [];
    const fakeClient = {
      connect: async () => {},
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes("INSERT INTO members")) throw new Error("connection string postgres://u:pw@db/hidden failed");
        return { rows: [] };
      },
      end: async () => {},
    };
    try {
      await main({
        env: {
          LOCAL_BOOTSTRAP_CONFIRM: "LOCAL_ONLY",
          LOCAL_BOOTSTRAP_EMAIL: "dev@example.com",
          APP_ORIGIN: "http://127.0.0.1:3000",
        },
        clientFactory: () => fakeClient,
        mkdir: async () => {},
        writeFile: async (path: string) => { writes.push(path); },
        log: (message: string) => { logs.push(message); },
        errorLog: (message: string) => { logs.push(message); },
      });
      expect(queries.some((sql) => sql.includes("ROLLBACK"))).toBe(true);
      expect(writes).toHaveLength(0);
      expect(logs.join("\n")).toMatch(/Local bootstrap failed/);
      expect(logs.join("\n")).not.toContain("postgres://u:pw@db/hidden");
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
