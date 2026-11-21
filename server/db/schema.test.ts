import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
// @ts-ignore - executable .mjs scripts intentionally have no emitted declaration files.
import { connectionString, readMigrations, redact, splitSqlStatements } from "../../scripts/migrate.mjs";
// @ts-ignore - executable .mjs scripts intentionally have no emitted declaration files.
import { buildSeedPlan } from "../../scripts/seed.mjs";
import {
  authTokens,
  checkins,
  content,
  contentRevisions,
  decisions,
  events,
  importBatches,
  matches,
  members,
  newsletterDrafts,
  partners,
  sessions,
  team,
} from "./schema";

const allTables = {
  members,
  authTokens,
  sessions,
  decisions,
  matches,
  checkins,
  content,
  contentRevisions,
  newsletterDrafts,
  events,
  team,
  partners,
  importBatches,
};

const snakeCase = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const columnsOf = (table: Parameters<typeof getTableColumns>[0]) =>
  getTableColumns(table) as unknown as Record<string, PgColumn>;

interface MigrationFile {
  name: string;
  sql: string;
}

interface SeedMember {
  id: string;
  email: string;
  name: string;
  role: string;
  participation: string;
  availability: unknown[];
  [key: string]: unknown;
}

interface SeedDecision {
  actorId: string;
  candidateId: string;
  role: string;
  decision: string;
}

interface SeedMatch {
  id: string;
  mentorId: string;
  menteeId: string;
  status: string;
}

interface SeedCheckin {
  privateNote: string;
}

interface SeedPlan {
  members: SeedMember[];
  decisions: SeedDecision[];
  matches: SeedMatch[];
  checkins: SeedCheckin[];
  content: { id: number }[];
  events: unknown[];
  team: unknown[];
  partners: unknown[];
  authTokens: unknown[];
  sessions: unknown[];
  importBatches: unknown[];
  newsletterDrafts: unknown[];
}

/** Drizzle keeps inline FK definitions on a table-level symbol. */
const foreignKeysOf = (table: unknown) => {
  const source = table as Record<symbol, unknown>;
  return ((source[Symbol.for("drizzle:PgInlineForeignKeys")] ?? []) as {
    reference(): { foreignTable: Record<symbol, string>; foreignColumns: { name: string }[] };
  }[]).map((fk) => {
    const reference = fk.reference();
    return {
      table: reference.foreignTable[Symbol.for("drizzle:Name")],
      columns: reference.foreignColumns.map((column) => column.name),
    };
  });
};

const uniqueConstraintsOf = (table: unknown) => {
  const source = table as Record<symbol, unknown>;
  const build = source[Symbol.for("drizzle:ExtraConfigBuilder")] as
    | ((table: unknown) => Record<string, { name: string; columns: { name: string }[] }>)
    | undefined;
  return build ? Object.values(build(table)) : [];
};

describe("PostgreSQL Drizzle schema", () => {
  it("declares every required table with its exact SQL name", () => {
    expect(
      Object.fromEntries(
        Object.entries(allTables).map(([key, table]) => [key, getTableName(table)]),
      ),
    ).toEqual({
      members: "members",
      authTokens: "auth_tokens",
      sessions: "sessions",
      decisions: "decisions",
      matches: "matches",
      checkins: "checkins",
      content: "content",
      contentRevisions: "content_revisions",
      newsletterDrafts: "newsletter_drafts",
      events: "events",
      team: "team",
      partners: "partners",
      importBatches: "import_batches",
    });
  });

  it("maps every camelCase TS field to snake_case SQL columns", () => {
    for (const [tableName, table] of Object.entries(allTables)) {
      for (const [key, column] of Object.entries(getTableColumns(table))) {
        expect(column.name, `${tableName}.${key}`).toBe(snakeCase(key));
      }
    }
  });

  it("gives every table a primary key of the expected SQL type", () => {
    for (const table of Object.values(allTables)) {
      const columns = getTableColumns(table);
      expect(Object.values(columns).filter((column) => column.primary)).toHaveLength(1);
    }
    expect(getTableColumns(content).id.columnType).toContain("Integer");
    expect(columnsOf(members).id.columnType).toContain("Text");
  });

  it("stores typed arrays in jsonb columns and uses timezone-aware timestamps", () => {
    const memberColumns = columnsOf(members);
    for (const key of ["experience", "expertise", "goals", "interests", "availability"]) {
      expect(memberColumns[key].columnType, key).toContain("Jsonb");
      expect(memberColumns[key].notNull, key).toBe(true);
      expect(memberColumns[key].hasDefault, key).toBe(true);
    }
    const tokenColumns = columnsOf(authTokens);
    expect(tokenColumns.expiresAt.columnType).toContain("Timestamp");
    expect(
      (tokenColumns.expiresAt as unknown as { config: { withTimezone: boolean } }).config
        .withTimezone,
    ).toBe(true);
    expect(memberColumns.emailVerifiedAt.notNull).toBe(false);
  });

  it("enforces required member profile fields and enum domains", () => {
    const columns = columnsOf(members);
    for (const key of [
      "id", "email", "name", "role", "status", "headline", "bio", "timezone",
      "meetingFormat", "location", "major", "career", "interestAnswer", "capacity",
      "discoverable", "aiConsent", "newsletterConsent", "createdAt", "updatedAt",
    ]) {
      expect(columns[key].notNull, key).toBe(true);
    }
    expect(columns.role.enumValues).toEqual(["member", "coordinator", "editor", "admin"]);
    expect(columns.participation.enumValues).toEqual(["mentor", "mentee", "both"]);
    expect(columns.status.enumValues).toEqual(["pending", "approved", "paused"]);
    expect(columns.meetingFormat.enumValues).toEqual(["online", "in-person", "either"]);
    expect(columns.newsletterConsent.dataType).toBe("string");
    expect(columns.participation.notNull).toBe(false);
    expect(columns.emailVerifiedAt.notNull).toBe(false);
    expect(String(columns.role.default)).toContain("member");
    expect(String(columns.status.default)).toContain("pending");
    expect(String(columns.newsletterConsent.default)).toContain("unknown");
  });

  it("enforces decision/match domains and the composite decision uniqueness", () => {
    const decisionColumns = columnsOf(decisions);
    expect(decisionColumns.role.enumValues).toEqual(["mentor", "mentee"]);
    expect(decisionColumns.decision.enumValues).toEqual(["interested", "pass"]);
    const [unique] = uniqueConstraintsOf(decisions);
    expect(unique.columns.map((column) => column.name)).toEqual([
      "actor_id", "candidate_id", "role",
    ]);
    expect(getTableColumns(matches).status.enumValues).toEqual([
      "awaiting-coordinator", "active", "paused", "completed", "declined",
    ]);
  });

  it("keeps nullable lifecycle columns nullable and token hashes unique", () => {
    expect(columnsOf(authTokens).tokenHash.isUnique).toBe(true);
    expect(getTableColumns(sessions).tokenHash.isUnique).toBe(true);
    expect(getTableColumns(importBatches).tokenHash.isUnique).toBe(true);
    expect(columnsOf(members).email.isUnique).toBe(true);
    expect(columnsOf(authTokens).consumedAt.notNull).toBe(false);
    expect(getTableColumns(matches).nextMeeting.notNull).toBe(false);
    expect(getTableColumns(checkins).continue.name).toBe("continue");
    expect(getTableColumns(events).endDate.notNull).toBe(false);
    expect(getTableColumns(importBatches).committedAt.notNull).toBe(false);
    expect(getTableColumns(importBatches).rows.columnType).toContain("Jsonb");
  });

  it("declaring foreign keys to the correct parent tables", () => {
    expect(foreignKeysOf(sessions)).toEqual([{ table: "members", columns: ["id"] }]);
    expect(foreignKeysOf(decisions)).toEqual([
      { table: "members", columns: ["id"] },
      { table: "members", columns: ["id"] },
    ]);
    expect(foreignKeysOf(matches)).toEqual([
      { table: "members", columns: ["id"] },
      { table: "members", columns: ["id"] },
    ]);
    expect(foreignKeysOf(checkins)).toEqual([
      { table: "matches", columns: ["id"] },
      { table: "members", columns: ["id"] },
    ]);
  });
});

describe("idempotent SQL migration", () => {
  it("ships at least one SQL migration creating every table safely", async () => {
    const migrations: MigrationFile[] = await readMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    const sql = migrations.map((migration) => migration.sql).join("\n");
    for (const table of Object.values(allTables)) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${getTableName(table)}"`));
    }
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/postgresql:\/\//i);
  });

  it("splits statement-breakpoint SQL without losing statements", () => {
    const statements = splitSqlStatements(
      ["CREATE TABLE a (id text);", "CREATE TABLE b (id text);", "CREATE INDEX c ON a (id);"].join(
        "\n--> statement-breakpoint\n",
      ),
    );
    expect(statements).toEqual([
      "CREATE TABLE a (id text);",
      "CREATE TABLE b (id text);",
      "CREATE INDEX c ON a (id);",
    ]);
    expect(splitSqlStatements("  \n--> statement-breakpoint\n  ")).toEqual([]);
  });
});

describe("migration runner safety", () => {
  it("redacts connection strings and secret assignments from error output", () => {
    const message = redact("connect ECONNREFUSED postgresql://user:hunter2@db.internal:5432/app");
    expect(message).toContain("[redacted connection string]");
    expect(message).not.toContain("hunter2");
    expect(redact("password=hunter2")).toBe("password=[redacted]");
  });

  it("prefers DATABASE_URL_UNPOOLED over DATABASE_URL", () => {
    const unpooledBefore = process.env.DATABASE_URL_UNPOOLED;
    const pooledBefore = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL_UNPOOLED = "postgresql://unpooled.invalid/db";
      process.env.DATABASE_URL = "postgresql://pooled.invalid/db";
      expect(connectionString()).toBe("postgresql://unpooled.invalid/db");
      delete process.env.DATABASE_URL_UNPOOLED;
      expect(connectionString()).toBe("postgresql://pooled.invalid/db");
    } finally {
      if (unpooledBefore === undefined) delete process.env.DATABASE_URL_UNPOOLED;
      else process.env.DATABASE_URL_UNPOOLED = unpooledBefore;
      if (pooledBefore === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = pooledBefore;
    }
  });
});

describe("synthetic seed plan", () => {
  it("only seeds clearly synthetic members with no privileged roles or credentials", () => {
    const plan = buildSeedPlan();
    expect(plan.members.length).toBeGreaterThan(0);
    for (const member of plan.members) {
      expect(member.email).toMatch(/@example\.invalid$/);
      expect(member.name).toMatch(/^\[(synthetic|fictional)\]/);
      expect(member.role).toBe("member");
      expect(member).not.toHaveProperty("password");
      expect(member).not.toHaveProperty("passwordHash");
    }
    expect(plan.authTokens).toEqual([]);
    expect(plan.sessions).toEqual([]);
    expect(plan.importBatches).toEqual([]);
    expect(plan.newsletterDrafts).toEqual([]);
  });

  it("seeds rich profiles, a singleton content document and demo public records", () => {
    const plan = buildSeedPlan();
    const participations = new Set(plan.members.map((member) => member.participation));
    expect(participations).toEqual(new Set(["mentor", "mentee", "both"]));
    expect(plan.members.every((member) => member.availability.length > 0)).toBe(true);
    expect(plan.content).toHaveLength(1);
    expect(plan.content[0].id).toBe(1);
    expect(plan.events.length + plan.team.length + plan.partners.length).toBeGreaterThan(0);
    for (const record of [...plan.team, ...plan.partners] as Array<{ name: string }>) {
      expect(JSON.stringify(record)).toMatch(/synthetic|fictional/);
    }
    // Events carry real public copy; the demo event's registration URL must be
    // the official organizer link rather than a placeholder domain.
    for (const record of plan.events) {
      expect(JSON.stringify(record)).not.toMatch(/\[?synthetic/i);
      expect((record as { registerUrl: string }).registerUrl).toMatch(/^https:\/\//);
    }
  });

  it("uses desired candidate roles, respects capacity and restricts private notes", () => {
    const plan = buildSeedPlan();
    const byId = new Map(plan.members.map((member) => [member.id, member]));
    for (const decision of plan.decisions) {
      const candidate = byId.get(decision.candidateId);
      expect(candidate).toBeDefined();
      expect(["mentor", "mentee"]).toContain(decision.role);
      if (candidate?.participation !== "both") {
        expect(decision.role).toBe(candidate?.participation);
      }
    }
    expect(plan.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: "demo-mentor-001",
          candidateId: "demo-mentee-002",
          role: "mentee",
        }),
        expect.objectContaining({
          actorId: "demo-mentee-002",
          candidateId: "demo-mentor-001",
          role: "mentor",
        }),
      ]),
    );
    for (const member of plan.members) {
      const reservations = plan.matches.filter(
        (match) => match.mentorId === member.id || match.menteeId === member.id,
      ).length;
      expect(member.capacity as number, member.id).toBeGreaterThanOrEqual(reservations);
    }
    for (const checkin of plan.checkins) {
      expect(checkin.privateNote).toContain("author");
      expect(checkin.privateNote).not.toContain("staff");
    }
  });
});
