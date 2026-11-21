import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { ImportPreview } from "../lib/contracts";
import type { Database } from "./db";
import { importBatches, members } from "./db/schema";
import { parseImportCsv } from "./import-utils";
import { createOpaqueToken, hashAuthToken } from "./auth-utils";

export async function previewImport(db: Database, staffId: string, csv: string): Promise<ImportPreview> {
  const existing = await db.select({ email: members.email }).from(members);
  const preview = parseImportCsv(csv, existing.map((row) => row.email));
  const token = createOpaqueToken();
  await db.insert(importBatches).values({
    id: crypto.randomUUID(),
    tokenHash: await hashAuthToken(token),
    createdBy: staffId,
    rows: preview.rows,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { ...preview, token };
}

export async function commitImport(db: Database, staffId: string, token: string): Promise<{ imported: number; duplicates: number }> {
  const tokenHash = await hashAuthToken(token);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(importBatches).where(eq(importBatches.tokenHash, tokenHash)).for("update").limit(1);
    const batch = rows[0];
    if (!batch || batch.createdBy !== staffId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Import preview not found or owned by another staff account." });
    }
    const eligible = batch.rows.filter((row) => row.status === "new");
    if (batch.committedAt) return { imported: 0, duplicates: batch.rows.filter((row) => row.status !== "invalid").length };
    if (batch.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This import preview expired. Upload the CSV again." });
    }
    const inserted = eligible.length ? await tx.insert(members).values(eligible.map((row) => ({
      id: crypto.randomUUID(),
      name: row.name,
      email: row.email,
      status: "pending" as const,
      newsletterConsent: "unknown",
    }))).onConflictDoNothing().returning({ id: members.id }) : [];
    await tx.update(importBatches).set({ committedAt: new Date() }).where(and(eq(importBatches.id, batch.id), eq(importBatches.createdBy, staffId)));
    return { imported: inserted.length, duplicates: batch.rows.filter((row) => row.status === "duplicate").length + eligible.length - inserted.length };
  });
}
