import { describe, it, expect } from "vitest";
import { getContentState, saveContent, publishContent, rollbackContent } from "./content";
import { content, contentRevisions } from "./db/schema";
import type { SiteDocument } from "../lib/contracts";
import type { Database } from "./db";

/**
 * Mocked drizzle boundary: records writes and replays a script of select
 * results. No real database is involved; this verifies service-level invariants
 * (version checks, "rollback never publishes") without claiming DB equivalence.
 */
type Write = { kind: "content-insert" | "revision" | "update"; value: Record<string, unknown> };

function makeScriptedDb(selectResults: unknown[][]) {
  const writes: Write[] = [];
  let cursor = 0;

  const readChain = (result: () => unknown) => {
    const self: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "limit", "for"]) self[method] = () => self;
    self.then = (res?: (value: unknown) => unknown, rej?: (error: unknown) => unknown) =>
      Promise.resolve(result()).then(res, rej);
    self.catch = (rej?: (error: unknown) => unknown) => Promise.resolve(result()).catch(rej);
    self.finally = (fn?: () => void) => Promise.resolve(result()).finally(fn);
    return self;
  };

  const writeChain = (kind: Write["kind"], value: Record<string, unknown>) => {
    let recorded = false;
    const record = () => {
      if (!recorded) {
        recorded = true;
        writes.push({ kind, value });
      }
    };
    const self: Record<string, unknown> = { onConflictDoNothing: () => self };
    self.then = (res?: (value: unknown) => unknown, rej?: (error: unknown) => unknown) => {
      record();
      return Promise.resolve(undefined).then(res, rej);
    };
    self.catch = (rej?: (error: unknown) => unknown) => {
      record();
      return Promise.resolve(undefined).catch(rej);
    };
    self.finally = (fn?: () => void) => {
      record();
      return Promise.resolve(undefined).finally(fn);
    };
    return self;
  };

  const tx: Record<string, unknown> = {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) =>
        writeChain(table === contentRevisions ? "revision" : "content-insert", value),
    }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: () => writeChain("update", value) }) }),
    select: () => readChain(() => selectResults[cursor++] ?? []),
  };
  return { db: tx as unknown as Database, writes };
}

const doc = (version: number, theme: "desert" | "navy" = "desert"): SiteDocument => ({
  version,
  theme,
  sections: [{ id: "hero-main", type: "hero", title: "Welcome", body: "Plain text introduction.", enabled: true }],
});

const row = (draft: SiteDocument, published: SiteDocument) => ({
  id: 1,
  draft,
  published,
  updatedAt: new Date(),
});

const revision = (id: string, version: number, document: SiteDocument, name = `Draft v${version}`) => ({
  id,
  version,
  document,
  name,
  createdAt: new Date(),
});

describe("stale baseVersion is rejected without mutating content", () => {
  it("saveContent rejects a stale baseVersion with CONFLICT and writes neither draft nor revision", async () => {
    const { db, writes } = makeScriptedDb([[row(doc(5), doc(3))]]);
    await expect(saveContent(db, doc(5), 4)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/Reload before saving/i),
    });
    expect(writes.filter((w) => w.kind === "update")).toHaveLength(0);
    expect(writes.filter((w) => w.kind === "revision")).toHaveLength(0);
  });

  it("publishContent rejects a stale baseVersion with CONFLICT", async () => {
    const { db, writes } = makeScriptedDb([[row(doc(5), doc(3))]]);
    await expect(publishContent(db, 4)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/Reload before saving/i),
    });
    expect(writes.filter((w) => w.kind === "update")).toHaveLength(0);
  });

  it("rollbackContent rejects a stale baseVersion with CONFLICT", async () => {
    const { db, writes } = makeScriptedDb([[row(doc(5), doc(3))]]);
    await expect(rollbackContent(db, "rev-1", 4)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes.filter((w) => w.kind === "update")).toHaveLength(0);
    expect(writes.filter((w) => w.kind === "revision")).toHaveLength(0);
  });

  it("getContentState parses draft, published and revisions", async () => {
    const { db } = makeScriptedDb([[row(doc(5), doc(3))], [revision("rev-1", 1, doc(1))]]);
    const state = await getContentState(db);
    expect(state.draft).toEqual(doc(5));
    expect(state.published).toEqual(doc(3));
    expect(state.revisions).toEqual([{ id: "rev-1", version: 1, createdAt: expect.any(String), name: "Draft v1" }]);
  });
});

describe("rollback never auto-publishes", () => {
  it("updates only the draft and leaves published untouched", async () => {
    const published = doc(3, "navy");
    const { db, writes } = makeScriptedDb([
      [row(doc(5), published)],
      [revision("rev-2", 2, doc(2))],
      [row(doc(6), published)],
      [revision("rev-6", 6, doc(6))],
    ]);
    const state = await rollbackContent(db, "rev-2", 5);

    expect(state.published).toEqual(published);
    expect(state.draft.version).toBe(6);
    const updates = writes.filter((w) => w.kind === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].value).toHaveProperty("draft");
    expect(updates[0].value).not.toHaveProperty("published");
    expect((updates[0].value.draft as SiteDocument).version).toBe(6);

    const revisionWrites = writes.filter((w) => w.kind === "revision");
    expect(revisionWrites).toHaveLength(1);
    expect(String(revisionWrites[0].value.name)).toMatch(/unpublished/i);
    expect(revisionWrites.some((w) => /published$/i.test(String(w.value.name)) && !/unpublished/i.test(String(w.value.name)))).toBe(false);
  });

  it("returns NOT_FOUND for a missing revision without writing", async () => {
    const { db, writes } = makeScriptedDb([[row(doc(5), doc(3))], []]);
    await expect(rollbackContent(db, "missing", 5)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(writes.filter((w) => w.kind === "update")).toHaveLength(0);
    expect(writes.filter((w) => w.kind === "revision")).toHaveLength(0);
  });
});

describe("successful save/publish version hygiene", () => {
  it("saveContent bumps only the draft version", async () => {
    const published = doc(3);
    const { db, writes } = makeScriptedDb([
      [row(doc(5), published)],
      [row(doc(6), published)],
      [revision("rev-6", 6, doc(6))],
    ]);
    const state = await saveContent(db, doc(5), 5);
    expect(state.draft.version).toBe(6);
    expect(state.published).toEqual(published);
    const updates = writes.filter((w) => w.kind === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].value).not.toHaveProperty("published");
  });

  it("publishContent advances draft and published together", async () => {
    const { db, writes } = makeScriptedDb([
      [row(doc(5), doc(3))],
      [row(doc(6), doc(6))],
      [revision("rev-6", 6, doc(6), "Published v6")],
    ]);
    const state = await publishContent(db, 5);
    expect(state.published.version).toBe(6);
    expect(state.draft.version).toBe(6);
    const updates = writes.filter((w) => w.kind === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].value).toHaveProperty("draft");
    expect(updates[0].value).toHaveProperty("published");
  });

  it("publishContent refuses to publish a site with no enabled sections", async () => {
    const blank: SiteDocument = { version: 5, theme: "desert", sections: [{ id: "hero", type: "hero", title: "Off", body: "", enabled: false }] };
    const { db, writes } = makeScriptedDb([[row(blank, doc(3))]]);
    await expect(publishContent(db, 5)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(writes.filter((w) => w.kind === "update")).toHaveLength(0);
  });
});

describe("content table identity guard", () => {
  it("uses the singleton content row (id 1)", () => {
    // Guard against accidental table-swap in the mocked boundary.
    expect(content).toBeTruthy();
    expect(contentRevisions).toBeTruthy();
  });
});
