/**
 * PostgreSQL schema for TechWomenAZ.
 *
 * TypeScript field names are camelCase; every column is explicitly mapped to a
 * snake_case SQL identifier so the generated migration and the DTO layer stay
 * in sync. This module is imported by services and by drizzle-kit generation.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Weekly availability slot; day is 0-6 (Sunday-Saturday), times are HH:MM. */
export interface AvailabilitySlot {
  day: number;
  start: string;
  end: string;
}

/** Newsletter consent is never inferred from AI suggestions or imports. */
export type NewsletterConsent = "unknown" | "subscribed" | "unsubscribed";

/** A parsed CSV row retained with an import preview until it is committed. */
export interface ImportBatchRow {
  index: number;
  name: string;
  email: string;
  status: "new" | "duplicate" | "invalid";
  message: string;
}

export interface SiteSectionRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  enabled: boolean;
}

export interface SiteDocumentRecord {
  version: number;
  theme: "desert" | "navy";
  sections: SiteSectionRecord[];
}

const emptyArray = sql`'[]'::jsonb`;
const emptyDocument = sql`'{"version":1,"theme":"desert","sections":[]}'::jsonb`;
const timestamptz = { withTimezone: true } as const;

export const memberRole = pgEnum("member_role", ["member", "coordinator", "editor", "admin"]);
export const participationRole = pgEnum("participation_role", ["mentor", "mentee", "both"]);
export const memberStatus = pgEnum("member_status", ["pending", "approved", "paused"]);
export const meetingFormat = pgEnum("meeting_format", ["online", "in-person", "either"]);
export const decisionRole = pgEnum("decision_role", ["mentor", "mentee"]);
export const decisionValue = pgEnum("decision_value", ["interested", "pass"]);
export const matchStatus = pgEnum("match_status", [
  "awaiting-coordinator",
  "active",
  "paused",
  "completed",
  "declined",
]);

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  // Services are responsible for lowercasing before insert/lookup.
  email: text("email").notNull().unique(),
  // Optional password credential (PBKDF2). Null members can only use magic links.
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: memberRole("role").notNull().default("member"),
  participation: participationRole("participation"),
  status: memberStatus("status").notNull().default("pending"),
  experience: jsonb("experience").$type<string[]>().notNull().default(emptyArray),
  expertise: jsonb("expertise").$type<string[]>().notNull().default(emptyArray),
  goals: jsonb("goals").$type<string[]>().notNull().default(emptyArray),
  interests: jsonb("interests").$type<string[]>().notNull().default(emptyArray),
  availability: jsonb("availability").$type<AvailabilitySlot[]>().notNull().default(emptyArray),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  timezone: text("timezone").notNull().default("America/Phoenix"),
  meetingFormat: meetingFormat("meeting_format").notNull().default("either"),
  location: text("location").notNull().default(""),
  major: text("major").notNull().default(""),
  career: text("career").notNull().default(""),
  interestAnswer: text("interest_answer").notNull().default(""),
  capacity: integer("capacity").notNull().default(1),
  discoverable: boolean("discoverable").notNull().default(false),
  aiConsent: boolean("ai_consent").notNull().default(false),
  newsletterConsent: text("newsletter_consent").notNull().default("unknown"),
  emailVerifiedAt: timestamp("email_verified_at", timestamptz),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", timestamptz).notNull().defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", timestamptz).notNull(),
  consumedAt: timestamp("consumed_at", timestamptz),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", timestamptz).notNull(),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    // The desired role of the candidate, not the role of the actor deciding.
    role: decisionRole("role").notNull(),
    decision: decisionValue("decision").notNull(),
    createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
  },
  (table) => ({
    actorCandidateRoleUnique: unique("decisions_actor_candidate_role_unique").on(
      table.actorId,
      table.candidateId,
      table.role,
    ),
  }),
);

export const matches = pgTable("matches", {
  id: text("id").primaryKey(),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  menteeId: text("mentee_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  // Writers always set status explicitly. Mutual interest creates an active
  // match; "awaiting-coordinator" remains only for legacy/staff records.
  status: matchStatus("status").notNull().default("awaiting-coordinator"),
  goal: text("goal").notNull().default(""),
  nextMeeting: timestamp("next_meeting", timestamptz),
  meetingUrl: text("meeting_url").notNull().default(""),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", timestamptz).notNull().defaultNow(),
});

export const checkins = pgTable("checkins", {
  id: text("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  met: boolean("met").notNull(),
  useful: boolean("useful").notNull(),
  continue: boolean("continue").notNull(),
  privateNote: text("private_note").notNull().default(""),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

export const content = pgTable("content", {
  // Singleton row: id is always 1 (draft/published/rollback share one row).
  id: integer("id").primaryKey(),
  draft: jsonb("draft").$type<SiteDocumentRecord>().notNull().default(emptyDocument),
  published: jsonb("published").$type<SiteDocumentRecord>().notNull().default(emptyDocument),
  updatedAt: timestamp("updated_at", timestamptz).notNull().defaultNow(),
});

export const contentRevisions = pgTable("content_revisions", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  document: jsonb("document").$type<SiteDocumentRecord>().notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

export const newsletterDrafts = pgTable("newsletter_drafts", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  updatedAt: timestamp("updated_at", timestamptz).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  endDate: text("end_date"),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  registerUrl: text("register_url").notNull().default(""),
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  photo: text("photo").notNull().default(""),
});

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo").notNull().default(""),
  url: text("url").notNull().default(""),
});

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: text("created_by").notNull(),
  rows: jsonb("rows").$type<ImportBatchRow[]>().notNull().default(emptyArray),
  expiresAt: timestamp("expires_at", timestamptz).notNull(),
  committedAt: timestamp("committed_at", timestamptz),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

/** Durable staff audit trail; rows are append-only and never updated. */
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", timestamptz).notNull().defaultNow(),
});

export type MemberRow = typeof members.$inferSelect;
export type NewMemberRow = typeof members.$inferInsert;
export type AuthTokenRow = typeof authTokens.$inferSelect;
export type NewAuthTokenRow = typeof authTokens.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type DecisionRow = typeof decisions.$inferSelect;
export type NewDecisionRow = typeof decisions.$inferInsert;
export type MatchRow = typeof matches.$inferSelect;
export type NewMatchRow = typeof matches.$inferInsert;
export type CheckinRow = typeof checkins.$inferSelect;
export type NewCheckinRow = typeof checkins.$inferInsert;
export type ContentRow = typeof content.$inferSelect;
export type NewContentRow = typeof content.$inferInsert;
export type ContentRevisionRow = typeof contentRevisions.$inferSelect;
export type NewContentRevisionRow = typeof contentRevisions.$inferInsert;
export type NewsletterDraftRow = typeof newsletterDrafts.$inferSelect;
export type NewNewsletterDraftRow = typeof newsletterDrafts.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type TeamRow = typeof team.$inferSelect;
export type NewTeamRow = typeof team.$inferInsert;
export type PartnerRow = typeof partners.$inferSelect;
export type NewPartnerRow = typeof partners.$inferInsert;
export type ImportBatchRowRecord = typeof importBatches.$inferSelect;
export type NewImportBatchRow = typeof importBatches.$inferInsert;
