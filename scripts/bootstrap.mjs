/**
 * Private local credential bootstrap for demo accounts.
 * Usage: node --env-file=.env.local scripts/bootstrap.mjs <email> <password> [role] [name]
 * Passwords are hashed with PBKDF2; raw passwords are never stored or logged.
 */
import { normalizeEmail, hashPassword, passwordIsAcceptable } from "../server/auth-utils.ts";
import { connectionString, redact } from "./migrate.mjs";
import pg from "pg";

const ROLES = ["member", "coordinator", "editor", "admin"];

const email = normalizeEmail(process.argv[2] || "");
const password = process.argv[3] || "";
const role = process.argv[4] || "member";
const name = process.argv[5] || "Demo Staff";

if (!email || !email.includes("@")) { console.error("Usage: node --env-file=.env.local scripts/bootstrap.mjs <email> <password> [role] [name]"); process.exit(1); }
if (!passwordIsAcceptable(password)) { console.error("Password must be 8-200 characters."); process.exit(1); }
if (!ROLES.includes(role)) { console.error(`Role must be one of: ${ROLES.join(", ")}`); process.exit(1); }

const client = new pg.Client({ connectionString: connectionString(), connectionTimeoutMillis: 10_000 });
await client.connect();
try {
  await client.query("BEGIN");
  const passwordHash = await hashPassword(password);
  const existing = await client.query("SELECT id FROM members WHERE email = $1", [email]);
  let memberId;
  if (existing.rows.length) {
    memberId = existing.rows[0].id;
    await client.query("UPDATE members SET password_hash = $1, role = $2, status = 'approved', email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $3", [passwordHash, role, memberId]);
  } else {
    const inserted = await client.query(
      "INSERT INTO members (id, email, name, role, status, password_hash, email_verified_at) VALUES ($1,$2,$3,$4,'approved',$5, now()) RETURNING id",
      [crypto.randomUUID(), email, name, role, passwordHash],
    );
    memberId = inserted.rows[0].id;
  }
  await client.query("COMMIT");
  console.log(`Credential set for ${email} (role: ${role}). Sign in with these credentials on /login.`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error(`Bootstrap failed: ${redact(error instanceof Error ? error.message : error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
