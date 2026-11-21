import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { ContentState, SiteDocument } from "../lib/contracts";
import type { Database, Transaction } from "./db";
import { content, contentRevisions } from "./db/schema";
import { defaultSiteDocument, parseSiteDocument } from "./content-utils";

type Store = Database | Transaction;

async function ensureContent(db: Store): Promise<void> {
  const initial = defaultSiteDocument(1);
  await db.insert(content).values({ id: 1, draft: initial, published: initial }).onConflictDoNothing();
}

async function state(db: Store): Promise<ContentState> {
  await ensureContent(db);
  const rows = await db.select().from(content).where(eq(content.id, 1)).limit(1);
  const revisions = await db.select().from(contentRevisions).orderBy(desc(contentRevisions.createdAt)).limit(50);
  return {
    draft: parseSiteDocument(rows[0].draft),
    published: parseSiteDocument(rows[0].published),
    revisions: revisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      createdAt: revision.createdAt.toISOString(),
      name: revision.name,
    })),
  };
}

export const getContentState = state;

function checkVersion(actual: number, baseVersion: number): void {
  if (actual !== baseVersion) {
    throw new TRPCError({ code: "CONFLICT", message: `Content changed since version ${baseVersion}. Reload before saving.` });
  }
}

/** A publish must leave the public site with at least one visible section. */
function assertPublishable(document: SiteDocument): void {
  if (!document.sections.some((section) => section.enabled)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enable at least one section before publishing; the public site would otherwise be blank." });
  }
}

export async function saveContent(db: Database, input: SiteDocument, baseVersion: number): Promise<ContentState> {
  return db.transaction(async (tx) => {
    await ensureContent(tx);
    const rows = await tx.select().from(content).where(eq(content.id, 1)).for("update");
    checkVersion(parseSiteDocument(rows[0].draft).version, baseVersion);
    const draft = { ...parseSiteDocument(input), version: baseVersion + 1 };
    await tx.update(content).set({ draft, updatedAt: new Date() }).where(eq(content.id, 1));
    await tx.insert(contentRevisions).values({ id: crypto.randomUUID(), version: draft.version, document: draft, name: `Draft v${draft.version}` });
    return state(tx);
  });
}

export async function publishContent(db: Database, baseVersion: number): Promise<ContentState> {
  return db.transaction(async (tx) => {
    await ensureContent(tx);
    const rows = await tx.select().from(content).where(eq(content.id, 1)).for("update");
    const current = parseSiteDocument(rows[0].draft);
    checkVersion(current.version, baseVersion);
    assertPublishable(current);
    const published = { ...current, version: baseVersion + 1 };
    await tx.update(content).set({ draft: published, published, updatedAt: new Date() }).where(eq(content.id, 1));
    await tx.insert(contentRevisions).values({ id: crypto.randomUUID(), version: published.version, document: published, name: `Published v${published.version}` });
    return state(tx);
  });
}

export async function rollbackContent(db: Database, revisionId: string, baseVersion: number): Promise<ContentState> {
  return db.transaction(async (tx) => {
    await ensureContent(tx);
    const rows = await tx.select().from(content).where(eq(content.id, 1)).for("update");
    checkVersion(parseSiteDocument(rows[0].draft).version, baseVersion);
    const revisions = await tx.select().from(contentRevisions).where(eq(contentRevisions.id, revisionId)).limit(1);
    if (!revisions[0]) throw new TRPCError({ code: "NOT_FOUND", message: "That content revision no longer exists." });
    const restored = parseSiteDocument(revisions[0].document);
    const draft = { ...restored, version: baseVersion + 1 };
    await tx.update(content).set({ draft, updatedAt: new Date() }).where(eq(content.id, 1));
    await tx.insert(contentRevisions).values({ id: crypto.randomUUID(), version: draft.version, document: draft, name: `Rollback to v${restored.version} (unpublished)` });
    return state(tx);
  });
}
