/**
 * Idempotent, migration-safe content refresher.
 *
 * Replaces [synthetic] placeholder copy in the singleton content row (id = 1)
 * with the approved TechWomen Arizona branding document. It only touches the
 * content row and appends one content_revisions row; member, event, team and
 * partner records are never read or written. Safe to run repeatedly.
 *
 * Run with: node --env-file=.env.local scripts/update-site-content.mjs
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { connectionString, redact } from "./migrate.mjs";

/** Approved public copy; must stay identical to seed.mjs's makeDocument(). */
const BRANDED_SECTIONS = [
  {
    id: "hero",
    type: "hero",
    title: "TechWomen Arizona",
    body: "Connecting women across Arizona who build, secure and lead in technology through mentorship, community and real opportunities.",
    enabled: true,
  },
  {
    id: "mission",
    type: "mission",
    title: "Our mission",
    body: "TechWomenAZ connects women in technology across Arizona. We pair mentors and mentees, host community events, and create space for students, career changers and seasoned engineers to learn from each other.",
    enabled: true,
  },
  {
    id: "mentorship",
    type: "mentorship",
    title: "Mentorship",
    body: "Set your weekly availability and meeting preferences, browse compatible profiles, and choose your own matches. Mentors and mentees decide together what to work on.",
    enabled: true,
  },
];

/** Builds a fresh document so no caller can mutate the shared template. */
export function buildBrandedDocument(version) {
  return {
    version,
    theme: "desert",
    sections: BRANDED_SECTIONS.map((section) => ({ ...section })),
  };
}

/** Checks only section title/body, exactly as the migration condition requires. */
export function documentHasSynthetic(document) {
  const sections = document && Array.isArray(document.sections) ? document.sections : [];
  return sections.some((section) =>
    ["title", "body"].some(
      (key) => typeof section?.[key] === "string" && /\[synthetic/i.test(section[key]),
    ),
  );
}

function baseVersion(document) {
  const version = document && document.version;
  return Number.isInteger(version) && version >= 0 ? version : null;
}

/** Pure plan: null when already branded, otherwise one update plus one revision. */
export function buildContentUpdate(draft, published) {
  if (!documentHasSynthetic(draft) && !documentHasSynthetic(published)) return null;
  const known = [baseVersion(draft), baseVersion(published)].filter((v) => v !== null);
  const version = (known.length ? Math.max(...known) : 1) + 1;
  const document = buildBrandedDocument(version);
  return {
    version,
    document,
    revision: {
      id: randomUUID(),
      version,
      document,
      name: "Branded site content",
    },
  };
}

/** Must be called with a pg client; runs entirely inside one transaction. */
export async function refreshSiteContent(client) {
  await client.query("BEGIN");
  try {
    const { rows } = await client.query(
      "SELECT draft, published FROM content WHERE id = 1 FOR UPDATE",
    );
    const row = rows[0];
    if (!row) {
      await client.query("COMMIT");
      return { changed: false, reason: "no-content-row" };
    }
    const update = buildContentUpdate(row.draft, row.published);
    if (!update) {
      await client.query("COMMIT");
      return { changed: false, reason: "already-branded" };
    }
    const { rowCount } = await client.query(
      "UPDATE content SET draft = $1, published = $2, updated_at = now() WHERE id = 1",
      [JSON.stringify(update.document), JSON.stringify(update.document)],
    );
    await client.query(
      "INSERT INTO content_revisions (id, version, document, name) VALUES ($1,$2,$3,$4)",
      [
        update.revision.id,
        update.version,
        JSON.stringify(update.document),
        update.revision.name,
      ],
    );
    await client.query("COMMIT");
    return { changed: true, version: update.version, contentRows: rowCount, revisionId: update.revision.id };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction may already be aborted; report the original error.
    }
    throw error;
  }
}

export async function main() {
  const client = new pg.Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    const result = await refreshSiteContent(client);
    if (result.changed) {
      console.log(
        `Branded site content refreshed to v${result.version}: ` +
          `${result.contentRows} content row updated, 1 content_revisions row inserted.`,
      );
    } else {
      console.log(`Site content already branded (${result.reason}); 0 rows changed.`);
    }
  } catch (error) {
    console.error(`Site content refresh failed: ${redact(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
