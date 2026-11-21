/**
 * Controller-approved private local-development bootstrap. No HTTP endpoint.
 * Usage (after setting the four LOCAL_BOOTSTRAP_* values privately):
 *   node --env-file=.env.local scripts/local-session.mjs
 * The raw session cookie is written mode 0600 under /tmp/opencode, never logged.
 */
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { connectionString, redact } from "./migrate.mjs";

const ROLES = ["member", "coordinator", "editor", "admin"];
const SESSION_DIRECTORY = "/tmp/opencode";
const SESSION_COOKIE = "twaz_session";

/** Validate and normalize the explicit local-only account claim. */
export function bootstrapConfig(env = process.env) {
  if (env.LOCAL_BOOTSTRAP_CONFIRM !== "LOCAL_ONLY") {
    throw new Error("Set LOCAL_BOOTSTRAP_CONFIRM=LOCAL_ONLY for this private local bootstrap.");
  }
  let origin;
  try { origin = new URL(env.APP_ORIGIN || "http://localhost:3000"); } catch { throw new Error("APP_ORIGIN must be a loopback URL."); }
  const host = origin.hostname.replace(/^\[|\]$/g, "");
  if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("Local bootstrap requires a loopback APP_ORIGIN; production hosted bootstrap is forbidden.");
  }
  const email = String(env.LOCAL_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("LOCAL_BOOTSTRAP_EMAIL must be an individual valid email address.");
  const role = env.LOCAL_BOOTSTRAP_ROLE || "member";
  if (!ROLES.includes(role)) throw new Error(`LOCAL_BOOTSTRAP_ROLE must be one of ${ROLES.join(", ")}.`);
  const name = String(env.LOCAL_BOOTSTRAP_NAME || "Local Developer").trim().slice(0, 120);
  if (!name) throw new Error("LOCAL_BOOTSTRAP_NAME cannot be empty.");
  return { email, role, name, origin: origin.origin };
}

/** Build the private credential payload; the caller owns the actual write. */
export function sessionCredential(config, memberId, token, expiresAt) {
  return {
    path: path.join(SESSION_DIRECTORY, `techwomenaz-local-session-${memberId}.json`),
    data: JSON.stringify({
      origin: config.origin,
      cookieName: SESSION_COOKIE,
      cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`,
      memberId,
      role: config.role,
      expiresAt: expiresAt.toISOString(),
    }, null, 2),
    options: { mode: 0o600 },
  };
}

/** Dependencies are injectable so the credential write can be unit tested without a database. */
export async function main(deps = {}) {
  const config = bootstrapConfig(deps.env ?? process.env);
  const client = deps.clientFactory
    ? deps.clientFactory()
    : new pg.Client({ connectionString: connectionString(), connectionTimeoutMillis: 10_000 });
  const mkdirFn = deps.mkdir ?? mkdir;
  const writeFileFn = deps.writeFile ?? writeFile;
  const log = deps.log ?? console.log;
  const errorLog = deps.errorLog ?? console.error;
  await client.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO members (id,email,name,role,status,email_verified_at)
       VALUES ($1,$2,$3,$4,'approved',now())
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,status='approved',email_verified_at=COALESCE(members.email_verified_at,now()),updated_at=now()
       RETURNING id`,
      [randomBytes(16).toString("hex"), config.email, config.name, config.role],
    );
    const memberId = claimed.rows[0].id;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await client.query("INSERT INTO sessions (id,token_hash,member_id,expires_at) VALUES ($1,$2,$3,$4)", [randomBytes(16).toString("hex"), tokenHash, memberId, expiresAt]);
    await client.query("COMMIT");
    const credential = sessionCredential(config, memberId, token, expiresAt);
    await mkdirFn(path.dirname(credential.path), { recursive: true, mode: 0o700 });
    await writeFileFn(credential.path, credential.data, credential.options);
    log(`Private local ${config.role} session created. Cookie file (mode 0600): ${credential.path}`);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Original error is redacted below. */ }
    errorLog(`Local bootstrap failed: ${redact(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
