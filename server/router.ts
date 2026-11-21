import { initTRPC, TRPCError } from "@trpc/server";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Member, SessionUser, StaffRole } from "../lib/contracts";
import type { Database } from "./db";
import { auditEvents, checkins, matches, members, newsletterDrafts, partners, sessions, team, events } from "./db/schema";import type { RuntimeEnv } from "./env";
import { integrationFlags } from "./env";
import { clearSessionCookie, destroySession, getSessionUser, sendMagicLink, sessionCookie } from "./auth";
import { createOpaqueToken, hashAuthToken, hashPassword, normalizeEmail, passwordIsAcceptable, verifyPasswordForSignIn } from "./auth-utils";
import { toEvent, toMember } from "./mappers";
import { isValidAvailability, isValidTimezone } from "./domain";
import { siteDocumentSchema } from "./content-utils";
import { getContentState, publishContent, rollbackContent, saveContent } from "./content";
import { suggestContent, suggestMailing } from "./ai";
import { previewImport, commitImport } from "./imports";
import { categorizeInterest } from "./jev";
import { addCheckin, decideCandidate, discoverMembers, listCheckins, listMatches, updateMatch } from "./mentorship";
import { canCoordinatorApprove } from "./matching";

export interface Context {
  db: Database;
  env: RuntimeEnv;
  request: Request;
  responseHeaders: Headers;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }) {
    if (shape.data.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: "The backend could not complete this request. Check integration configuration and try again.", data: { ...shape.data, stack: undefined } };
    }
    return { ...shape, data: { ...shape.data, stack: undefined } };
  },
});
const publicProcedure = t.procedure;
const authedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const user = await getSessionUser(ctx.db, ctx.request);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in with your individual account to continue." });
  return next({ ctx: { ...ctx, user } });
});

function staffProcedure(roles: StaffRole[]) {
  return authedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "This action requires an authorized individual staff account." });
    return next();
  });
}
const coordinatorProcedure = staffProcedure(["admin", "coordinator"]);
const editorProcedure = staffProcedure(["admin", "editor"]);
const anyStaffProcedure = staffProcedure(["admin", "coordinator", "editor"]);

const shortText = (max: number) => z.string().trim().max(max);
const textList = z.array(z.string().trim().min(1).max(200)).max(30);
const availability = z.array(z.object({ day: z.number().int().min(0).max(6), start: z.string(), end: z.string() }).strict()).max(42)
  .refine(isValidAvailability, "Availability must use HH:mm times with start before end.");
const timezone = z.string().trim().max(64).refine(isValidTimezone, "Use a valid IANA timezone, such as America/Phoenix.");
const optionalHttpUrl = z.string().trim().max(2000).refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Use an http(s) URL or leave this blank.");
const baseVersion = z.number().int().nonnegative();
const profileInput = z.object({
  name: z.string().trim().min(1).max(120),
  participation: z.enum(["mentor", "mentee", "both"]),
  headline: shortText(200), bio: shortText(3000), expertise: textList, goals: textList,
  timezone, availability, meetingFormat: z.enum(["online", "in-person", "either"]), location: shortText(200),
  capacity: z.number().int().min(1).max(20), discoverable: z.boolean(), aiConsent: z.boolean(),
  major: shortText(200), career: shortText(200), interests: textList, interestAnswer: shortText(2000),
}).strict();

async function ownMember(db: Database, user: SessionUser): Promise<Member> {
  const rows = await db.select().from(members).where(eq(members.id, user.id)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Membership record not found." });
  return toMember(rows[0], true);
}

async function verifyTurnstile(env: RuntimeEnv, token: string | undefined): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete the bot verification before applying." });
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const result = await response.json() as { success?: boolean };
  if (!response.ok || !result.success) throw new TRPCError({ code: "FORBIDDEN", message: "Bot verification failed. Please retry without submitting multiple applications." });
}

export const appRouter = t.router({
  public: t.router({
    site: publicProcedure.query(async ({ ctx }) => {
      const contentState = await getContentState(ctx.db);
      const eventRows = await ctx.db.select().from(events).orderBy(events.date);
      const teamRows = await ctx.db.select().from(team).orderBy(team.name);
      const partnerRows = await ctx.db.select().from(partners).orderBy(partners.name);
      return { document: contentState.published, events: eventRows.map(toEvent), team: teamRows, partners: partnerRows, demo: ctx.env.DEMO_MODE === "true" };
    }),
  }),
  auth: t.router({
    session: publicProcedure.query(async ({ ctx }) => getSessionUser(ctx.db, ctx.request)),
    signIn: publicProcedure.input(z.object({
      email: z.string().trim().email().max(254),
      password: z.string().min(1).max(200),
    }).strict()).mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const rows = await ctx.db.select().from(members).where(eq(members.email, email)).limit(1);
      const member = rows[0];
      const stale = { message: "That email and password combination doesn't match an account. Try again or reset your password." };
      // Constant-work path: unknown emails, passwordless members and paused
      // members all verify against a precomputed dummy hash, so the uniform
      // error is not paired with a distinguishable (skipped) PBKDF2 latency.
      const storedHash = member && member.status !== "paused" ? member.passwordHash : undefined;
      const valid = await verifyPasswordForSignIn(input.password, storedHash);
      if (!member || !storedHash || !valid) throw new TRPCError({ code: "UNAUTHORIZED", message: stale.message });
      const sessionToken = createOpaqueToken();
      await ctx.db.insert(sessions).values({
        id: crypto.randomUUID(),
        tokenHash: await hashAuthToken(sessionToken),
        memberId: member.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000),
      });
      ctx.responseHeaders.set("set-cookie", sessionCookie(sessionToken, ctx.request, ctx.env));
      return { success: true as const, name: member.name };
    }),
    requestLink: publicProcedure.input(z.object({ email: z.string().trim().email().max(254) }).strict()).mutation(async ({ ctx, input }) => {
      if (!ctx.env.EMAIL || !ctx.env.EMAIL_FROM) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email sending is unavailable: configure EMAIL_FROM and the Cloudflare EMAIL binding. No sign-in link was sent." });
      }
      const email = normalizeEmail(input.email);
      const rows = await ctx.db.select({ id: members.id }).from(members).where(eq(members.email, email)).limit(1);
      if (rows.length) {
        try { await sendMagicLink(ctx.db, ctx.env, ctx.request, email); }
        catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Email delivery failed; no sign-in link was sent." }); }
      }
      return { message: "If an application exists for that email, a single-use sign-in link has been requested. Check your inbox." };
    }),
    signOut: publicProcedure.input(z.object({}).strict()).mutation(async ({ ctx }) => {
      await destroySession(ctx.db, ctx.request);
      ctx.responseHeaders.set("set-cookie", clearSessionCookie(ctx.request, ctx.env));
      return { success: true as const };
    }),
  }),
  membership: t.router({
    join: publicProcedure.input(z.object({
      name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), experience: textList,
      interests: textList, major: shortText(200).optional(), career: shortText(200).optional(), interestAnswer: shortText(2000).optional(),
      password: z.string().optional(), newsletterConsent: z.boolean(), turnstileToken: z.string().max(4096).optional(),
    }).strict()).mutation(async ({ ctx, input }) => {
      await verifyTurnstile(ctx.env, input.turnstileToken);
      if (input.password !== undefined && !passwordIsAcceptable(input.password)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a password of at least 8 characters." });
      }
      // A password lets the applicant sign in immediately but does NOT prove
      // ownership of the email. Only magic-link verification may set
      // emailVerifiedAt. The CONFLICT risk (someone who knows a person's email
      // can pre-claim it before the real owner applies, locking them out) is
      // accepted for this demo because staff approval gates all discovery and
      // directory visibility; see REVIEW.md finding H2.
      const passwordHash = input.password !== undefined ? await hashPassword(input.password) : null;
      const needsEmailVerification = !ctx.env.EMAIL || !ctx.env.EMAIL_FROM;
      if (needsEmailVerification && passwordHash === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Applications require a password or verified email ownership. Email sending is not configured, so please choose a password to continue." });
      }
      const email = normalizeEmail(input.email);
      const existing = await ctx.db.select({ id: members.id }).from(members).where(eq(members.email, email)).limit(1);
      if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "An application already exists for this email. Sign in instead, or request a sign-in link." });
      const id = crypto.randomUUID();
      await ctx.db.insert(members).values({
        id, name: input.name, email, experience: input.experience, interests: input.interests,
        major: input.major ?? "", career: input.career ?? "", interestAnswer: input.interestAnswer ?? "",
        passwordHash,
        newsletterConsent: input.newsletterConsent ? "subscribed" : "unsubscribed",
        status: "pending",
        emailVerifiedAt: null,
      });
      if (passwordHash !== null) {
        // Password accounts sign in directly with an unverified email; staff
        // approval remains the discovery gate.
        return { id, message: "Application saved. You can now sign in with your email and password." };
      }
      try { await sendMagicLink(ctx.db, ctx.env, ctx.request, email); }
      catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${error instanceof Error ? error.message : "Email delivery failed."} Your application remains pending; request a new link after delivery is configured.` });
      }
      return { id, message: "Application saved as pending. Use the emailed link to verify ownership; staff approval is still required for discovery." };
    }),
    me: authedProcedure.query(async ({ ctx }) => ownMember(ctx.db, ctx.user)),
    updateProfile: authedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.update(members).set({ ...input, updatedAt: new Date() }).where(eq(members.id, ctx.user.id)).returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Membership record not found." });
      return toMember(rows[0], true);
    }),
    categorize: publicProcedure.input(z.object({ answer: z.string().trim().min(1).max(2000) }).strict()).mutation(async ({ ctx, input }) => categorizeInterest(input.answer, ctx.env)),
  }),
  mentorship: t.router({
    discover: authedProcedure.input(z.object({ role: z.enum(["mentor", "mentee"]) }).strict()).query(async ({ ctx, input }) => discoverMembers(ctx.db, ctx.env, ctx.user, input.role)),
    decide: authedProcedure.input(z.object({ candidateId: z.string().max(64), role: z.enum(["mentor", "mentee"]), decision: z.enum(["interested", "pass"]) }).strict()).mutation(async ({ ctx, input }) => decideCandidate(ctx.db, ctx.user, input)),
    matches: authedProcedure.query(async ({ ctx }) => listMatches(ctx.db, ctx.user)),
    updateMatch: authedProcedure.input(z.object({
      id: z.string().max(64), goal: shortText(2000).optional(), nextMeeting: z.string().max(64).refine((value) => !value || !Number.isNaN(Date.parse(value)), "Use a valid meeting date/time.").optional(),
      meetingUrl: optionalHttpUrl.optional(), status: z.enum(["paused", "completed"]).optional(),
    }).strict()).mutation(async ({ ctx, input }) => updateMatch(ctx.db, ctx.user, input)),
    checkins: authedProcedure.input(z.object({ matchId: z.string().max(64) }).strict()).query(async ({ ctx, input }) => listCheckins(ctx.db, ctx.user, input.matchId)),
    checkin: authedProcedure.input(z.object({ matchId: z.string().max(64), met: z.boolean(), useful: z.boolean(), continue: z.boolean(), privateNote: shortText(2000) }).strict()).mutation(async ({ ctx, input }) => addCheckin(ctx.db, ctx.user, input)),
  }),
  admin: t.router({
    stats: anyStaffProcedure.query(async ({ ctx }) => {
      const [memberCounts] = await ctx.db.select({
        total: sql<number>`count(*)::int`,
        mentors: sql<number>`count(*) filter (where ${members.participation} in ('mentor','both'))::int`,
        mentees: sql<number>`count(*) filter (where ${members.participation} in ('mentee','both'))::int`,
        pending: sql<number>`count(*) filter (where ${members.status} = 'pending')::int`,
      }).from(members);
      const [matchCounts] = await ctx.db.select({
        pending: sql<number>`count(*) filter (where ${matches.status} = 'awaiting-coordinator')::int`,
        active: sql<number>`count(*) filter (where ${matches.status} = 'active')::int`,
      }).from(matches);
      const [checkinCounts] = await ctx.db.select({ total: sql<number>`count(*)::int`, meetings: sql<number>`count(*) filter (where ${checkins.met})::int` }).from(checkins);
      const since = new Date(); since.setUTCDate(since.getUTCDate() - 13); since.setUTCHours(0, 0, 0, 0);
      const signups = await ctx.db.select({ createdAt: members.createdAt }).from(members).where(gte(members.createdAt, since));
      const trend = new Map<string, number>();
      for (let offset = 0; offset < 14; offset += 1) { const date = new Date(since); date.setUTCDate(since.getUTCDate() + offset); trend.set(date.toISOString().slice(0, 10), 0); }
      for (const signup of signups) { const date = signup.createdAt.toISOString().slice(0, 10); if (trend.has(date)) trend.set(date, (trend.get(date) ?? 0) + 1); }
      return {
        members: memberCounts.total, mentors: memberCounts.mentors, mentees: memberCounts.mentees,
        pendingApplications: memberCounts.pending, pendingMatches: matchCounts.pending, activeMatches: matchCounts.active,
        recordedMeetings: checkinCounts.meetings, checkins: checkinCounts.total,
        signupTrend: [...trend].map(([date, count]) => ({ date, count })),
      };
    }),
    members: coordinatorProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select().from(members).orderBy(desc(members.createdAt));
      return rows.map((row) => toMember(row, true));
    }),
    approveMember: coordinatorProcedure.input(z.object({ id: z.string().max(64), status: z.enum(["approved", "paused"]) }).strict()).mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.update(members).set({ status: input.status, updatedAt: new Date() }).where(eq(members.id, input.id)).returning({ id: members.id, name: members.name });
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: `membership.${input.status}`, summary: `${input.status === "approved" ? "Approved" : "Paused"} ${rows[0].name}` });
      return { success: true as const };
    }),
    matches: coordinatorProcedure.query(async ({ ctx }) => listMatches(ctx.db, ctx.user, true)),
    approveMatch: coordinatorProcedure.input(z.object({ id: z.string().max(64), approve: z.boolean() }).strict()).mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.select({ status: matches.status }).from(matches).where(eq(matches.id, input.id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found." });
      if (!canCoordinatorApprove(existing[0].status)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This match is not awaiting coordinator approval." });
      }
      const updated = await ctx.db.update(matches).set({ status: input.approve ? "active" : "declined", updatedAt: new Date() }).where(and(eq(matches.id, input.id), eq(matches.status, "awaiting-coordinator"))).returning({ id: matches.id });
      if (!updated.length) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found or already reviewed." });
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: input.approve ? "match.approved" : "match.declined", summary: `${input.approve ? "Approved" : "Declined"} match ${input.id}` });
      const all = await listMatches(ctx.db, ctx.user, true);
      return all.find((match) => match.id === input.id)!;
    }),
    integrations: anyStaffProcedure.query(({ ctx }) => integrationFlags(ctx.env)),
    events: anyStaffProcedure.query(async ({ ctx }) => (await ctx.db.select().from(events).orderBy(events.date)).map(toEvent)),
    saveEvent: anyStaffProcedure.input(z.object({ id: z.string().max(64).optional(), title: z.string().trim().min(1).max(200), date: z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), "Use a valid event date."), description: shortText(5000), location: shortText(500), registerUrl: optionalHttpUrl }).strict()).mutation(async ({ ctx, input }) => {
      const values = { title: input.title, date: input.date, description: input.description, location: input.location, registerUrl: input.registerUrl };
      const rows = input.id
        ? await ctx.db.update(events).set(values).where(eq(events.id, input.id)).returning()
        : await ctx.db.insert(events).values({ ...values, id: crypto.randomUUID() }).returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: "event.saved", summary: `${input.id ? "Updated" : "Created"} event "${input.title}"` });
      return toEvent(rows[0]);
    }),
  }),
  imports: t.router({
    preview: coordinatorProcedure.input(z.object({ csv: z.string().min(1).max(1_000_000) }).strict()).mutation(async ({ ctx, input }) => previewImport(ctx.db, ctx.user.id, input.csv)),
    commit: coordinatorProcedure.input(z.object({ token: z.string().min(20).max(256) }).strict()).mutation(async ({ ctx, input }) => {
      const result = await commitImport(ctx.db, ctx.user.id, input.token);
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: "import.committed", summary: `Imported ${result.imported} members (${result.duplicates} duplicates skipped)` });
      return result;
    }),
  }),
  content: t.router({
    state: editorProcedure.query(async ({ ctx }) => getContentState(ctx.db)),
    save: editorProcedure.input(z.object({ document: siteDocumentSchema, baseVersion }).strict()).mutation(async ({ ctx, input }) => {
      const result = await saveContent(ctx.db, input.document, input.baseVersion);
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: "content.saved", summary: `Saved draft version ${result.draft.version}` });
      return result;
    }),
    suggest: editorProcedure.input(z.object({ prompt: z.string().trim().min(1).max(2000), sectionId: z.string().max(64).optional(), baseVersion }).strict()).mutation(async ({ ctx, input }) => {
      const current = await getContentState(ctx.db);
      if (current.draft.version !== input.baseVersion) throw new TRPCError({ code: "CONFLICT", message: "Content changed. Reload before requesting an AI suggestion." });
      return suggestContent(ctx.env.AI, current.draft, input.prompt, input.sectionId);
    }),
    publish: editorProcedure.input(z.object({ baseVersion }).strict()).mutation(async ({ ctx, input }) => {
      const result = await publishContent(ctx.db, input.baseVersion);
      await ctx.db.insert(auditEvents).values({ id: crypto.randomUUID(), actorName: ctx.user.name, action: "content.published", summary: `Published site version ${result.published.version}` });
      return result;
    }),
    rollback: editorProcedure.input(z.object({ revisionId: z.string().max(64), baseVersion }).strict()).mutation(async ({ ctx, input }) => rollbackContent(ctx.db, input.revisionId, input.baseVersion)),
  }),
  mailing: t.router({
    drafts: editorProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select().from(newsletterDrafts).orderBy(desc(newsletterDrafts.updatedAt));
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    }),
    saveDraft: editorProcedure.input(z.object({ id: z.string().max(64).optional(), subject: z.string().trim().min(1).max(200), body: shortText(20_000) }).strict()).mutation(async ({ ctx, input }) => {
      const rows = input.id
        ? await ctx.db.update(newsletterDrafts).set({ subject: input.subject, body: input.body, updatedAt: new Date() }).where(eq(newsletterDrafts.id, input.id)).returning()
        : await ctx.db.insert(newsletterDrafts).values({ id: crypto.randomUUID(), subject: input.subject, body: input.body }).returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Newsletter draft not found." });
      return { ...rows[0], updatedAt: rows[0].updatedAt.toISOString() };
    }),
    suggest: editorProcedure.input(z.object({ subject: shortText(200), body: shortText(20_000), prompt: z.string().trim().min(1).max(2000) }).strict()).mutation(async ({ ctx, input }) => suggestMailing(ctx.env.AI, input)),
    exportContacts: coordinatorProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select({ name: members.name, email: members.email }).from(members).where(eq(members.newsletterConsent, "subscribed")).orderBy(members.name);
      const cell = (value: string) => {
        // Strip control characters (tab/CR/LF/other) so formula/CSV injection cannot ride in newlines.
        const safe = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
        return `"${/^[=+\-@\t\r\n]/.test(safe) ? `'${safe}` : safe.replaceAll('"', '""')}"`;
      };
      return { csv: ["name,email", ...rows.map((row) => `${cell(row.name)},${cell(row.email)}`)].join("\r\n"), count: rows.length };
    }),
  }),
  directory: t.router({
    list: authedProcedure.query(async ({ ctx }) => {
      // Opt-in professional directory. Contact details, bios and availability
      // stay private; only discoverable members who share a participation role
      // appear, and each viewer sees the same public-safe fields.
      const viewerHasRole = ctx.user.role !== "member";
      const rows = await ctx.db
        .select({
          id: members.id, name: members.name, headline: members.headline,
          expertise: members.expertise, goals: members.goals, interests: members.interests,
          meetingFormat: members.meetingFormat, location: members.location,
          timezone: members.timezone, participation: members.participation, capacity: members.capacity,
        })
        .from(members)
        .where(and(eq(members.discoverable, true), eq(members.status, "approved"), viewerHasRole ? undefined : isNotViewer(ctx.user.id)))
        .orderBy(members.name);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        headline: row.headline,
        expertise: row.expertise,
        goals: row.goals,
        interests: row.interests,
        meetingFormat: row.meetingFormat,
        location: row.location,
        timezone: row.timezone,
        participation: row.participation,
      }));
    }),
  }),
  audit: t.router({
    list: staffProcedure(["admin"]).query(async ({ ctx }) => {
      const rows = await ctx.db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(200);
      return rows.map((row) => ({
        id: row.id,
        actorName: row.actorName,
        action: row.action,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
      }));
    }),
  }),
});

/** Exclude the viewer from their own directory listing without breaking null checks. */
function isNotViewer(viewerId: string) {
  return sql`${members.id} <> ${viewerId}`;
}

export type AppRouter = typeof appRouter;
