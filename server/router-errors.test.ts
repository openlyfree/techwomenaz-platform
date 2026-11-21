import { describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type Context } from "./router";
import type { Database } from "./db";
import { runtimeEnv } from "./env";

const failingDb = {
  insert: () => { throw new Error("sensitive SQL with member@example.com and secret parameters"); },
} as unknown as Database;

function makeRouter() {
  return appRouter;
}

describe("tRPC error boundaries", () => {
  it("does not expose database queries, parameters, or driver messages", async () => {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("http://localhost/api/trpc/public.site"),
      router: makeRouter(),
      createContext(): Context {
        return { db: failingDb, env: runtimeEnv(), request: new Request("http://localhost/api/trpc"), responseHeaders: new Headers() };
      },
    });
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(body).not.toContain("member@example.com");
    expect(body).not.toContain("sensitive SQL");
    expect(body).toMatch(/backend|temporarily|try again/i);
  });
});
