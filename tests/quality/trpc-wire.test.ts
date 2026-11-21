import { afterEach, describe, expect, it, vi } from "vitest";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { mutate, query } from "../../lib/api";

const t = initTRPC.create();
const router = t.router({
  ping: t.procedure.query(() => ({ ok: true })),
  echo: t.procedure.input(z.object({ value: z.string() }).strict()).query(({ input }) => input),
  save: t.procedure.input(z.object({ value: z.string() }).strict()).mutation(({ input }) => input),
});

function installTrpcFetch() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, "http://quality.invalid");
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request(url, init),
      router,
      createContext: () => ({}),
    });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("lib/api against the installed tRPC v11 server", () => {
  it("unwraps a real v11 query result", async () => {
    installTrpcFetch();
    await expect(query<{ ok: boolean }>("ping")).resolves.toEqual({ ok: true });
  });

  it("encodes query input in the real v11 wire format", async () => {
    installTrpcFetch();
    await expect(query<{ value: string }>("echo", { value: "schedule" })).resolves.toEqual({ value: "schedule" });
  });

  it("encodes mutation input in the real v11 wire format", async () => {
    installTrpcFetch();
    await expect(mutate<{ value: string }>("save", { value: "draft" })).resolves.toEqual({ value: "draft" });
  });
});
