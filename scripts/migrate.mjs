/**
 * Applies the checked-in Drizzle SQL migrations to PostgreSQL.
 * Run with: node --env-file=.env.local scripts/migrate.mjs
 * Connection details are read from the environment and are never logged.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, "../drizzle");
const MIGRATION_LOCK_KEY = 7273819401;
const LEDGER_TABLE = "schema_migrations";

/** Drizzle separates statements with a breakpoint comment. */
export function splitSqlStatements(sql) {
  return sql
    .split(/-->\s*statement-breakpoint[^\n]*/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function readMigrations() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(
    files.map(async (name) => ({
      name,
      sql: await readFile(path.join(MIGRATIONS_DIR, name), "utf8"),
    })),
  );
}

/** Keeps connection strings and secret-looking values out of logs. */
export function redact(message) {
  return String(message)
    .replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[redacted connection string]")
    .replace(/\b(password|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]");
}

export function connectionString() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is not configured");
  return url;
}

/** Must be called inside a transaction; safe to call repeatedly. */
export async function applyMigrations(client) {
  await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await client.query(`SELECT name FROM ${LEDGER_TABLE}`);
  const applied = new Set(rows.map((row) => row.name));
  const migrations = await readMigrations();
  const newlyApplied = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    for (const statement of splitSqlStatements(migration.sql)) {
      await client.query(statement);
    }
    await client.query(`INSERT INTO ${LEDGER_TABLE} (name) VALUES ($1)`, [migration.name]);
    newlyApplied.push(migration.name);
  }

  return { applied: newlyApplied, total: migrations.length };
}

export async function main() {
  const client = new pg.Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    const summary = await applyMigrations(client);
    await client.query("COMMIT");
    console.log(
      `Migrations current (${summary.total} total). Applied now: ${
        summary.applied.length ? summary.applied.join(", ") : "none"
      }`,
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction may already be aborted; the original error is reported.
    }
    console.error(`Migration failed: ${redact(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
