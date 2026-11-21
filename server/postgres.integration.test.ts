import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import { appRouter, type Context } from "./router";
import { openDatabase, type Database } from "./db";
import { checkins, content, contentRevisions, decisions, events, importBatches, matches, members, newsletterDrafts, sessions } from "./db/schema";
import { runtimeEnv } from "./env";
import { hashAuthToken, hashPassword, verifyPassword } from "./auth-utils";
import { SESSION_COOKIE } from "./auth";

const enabled = Boolean(process.env.DATABASE_URL);
const describePostgres = enabled ? describe : describe.skip;
const suffix = crypto.randomUUID().slice(0, 8);
/** Private synthetic credentials used only by these tests; never real accounts. */
const TEST_PASSWORD = `Synthetic-Pass-${suffix}-!`;
const TEST_JOIN_PASSWORD = `Synthetic-Join-${suffix}-!`;
const BOOTSTRAP_PASSWORD = `Synthetic-Bootstrap-${suffix}-!`;
const joinPwEmail = `joinpw-${suffix}@example.invalid`;
const bootstrapEmail = `bootstrap-${suffix}@example.invalid`;
const ids = {
  mentor: `test-mentor-${suffix}`,
  mentee: `test-mentee-${suffix}`,
  admin: `test-admin-${suffix}`,
  outsider: `test-outsider-${suffix}`,
  editor: `test-editor-${suffix}`,
  coordinator: `test-coordinator-${suffix}`,
  subjectMentor: `test-subject-mentor-${suffix}`,
  subjectMentee: `test-subject-mentee-${suffix}`,
  signout: `test-signout-${suffix}`,
  pwMember: `test-pw-member-${suffix}`,
  pwPaused: `test-pw-paused-${suffix}`,
};
const tokens = Object.fromEntries(
  Object.keys(ids).map((key) => [key, crypto.randomUUID()]),
) as Record<keyof typeof ids, string>;
let db: Database;
let close: () => Promise<void>;
let matchId = "";
const createdEventIds: string[] = [];
const createdDraftIds: string[] = [];

function caller(as: keyof typeof ids | null = null, responseHeaders = new Headers()) {
  const token = as ? tokens[as] : null;
  const request = new Request("http://localhost/api/trpc", { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} });
  const ctx: Context = { db, env: runtimeEnv(), request, responseHeaders };
  return appRouter.createCaller(ctx);
}

/** Rebuild a caller from a cookie issued by signIn to prove the session works. */
function callerWithCookie(cookieValue: string) {
  const request = new Request("http://localhost/api/trpc", { headers: { cookie: `${SESSION_COOKIE}=${cookieValue}` } });
  const ctx: Context = { db, env: runtimeEnv(), request, responseHeaders: new Headers() };
  return appRouter.createCaller(ctx);
}

/** Capture the tRPC code and message so error parity (no enumeration) can be asserted. */
async function signInFailure(email: string, password: string): Promise<{ code: string; message: string }> {
  try {
    await caller().auth.signIn({ email, password });
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    if (typeof failure.code === "string") return { code: failure.code, message: failure.message ?? "" };
    throw error;
  }
  throw new Error("Expected auth.signIn to reject the supplied credentials");
}

describePostgres("PostgreSQL-backed contracted procedures", () => {
  beforeAll(async () => {
    ({ db, close } = await openDatabase(runtimeEnv()));
    const testPasswordHash = await hashPassword(TEST_PASSWORD);
    await db.insert(members).values([
      { id: ids.mentor, email: `${ids.mentor}@example.invalid`, name: "[synthetic test] Mentor", role: "member", participation: "mentor", status: "approved", availability: [{ day: 2, start: "17:00", end: "18:00" }], timezone: "America/Phoenix", meetingFormat: "either", goals: ["Learning AI"], expertise: ["Security"], capacity: 2, discoverable: true },
      { id: ids.mentee, email: `${ids.mentee}@example.invalid`, name: "[synthetic test] Mentee", role: "member", participation: "mentee", status: "approved", availability: [{ day: 2, start: "17:30", end: "18:30" }], timezone: "America/Phoenix", meetingFormat: "online", goals: ["Learning AI"], capacity: 1, discoverable: true },
      { id: ids.admin, email: `${ids.admin}@example.invalid`, name: "[synthetic test] Admin", role: "admin", participation: null, status: "approved", discoverable: false },
      { id: ids.outsider, email: `${ids.outsider}@example.invalid`, name: "[synthetic test] Outsider", role: "member", participation: "both", status: "approved", timezone: "America/Phoenix", meetingFormat: "either", discoverable: false },
      { id: ids.editor, email: `${ids.editor}@example.invalid`, name: "[synthetic test] Editor", role: "editor", participation: null, status: "approved", discoverable: false },
      { id: ids.coordinator, email: `${ids.coordinator}@example.invalid`, name: "[synthetic test] Coordinator", role: "coordinator", participation: null, status: "approved", discoverable: false },
      { id: ids.subjectMentor, email: `${ids.subjectMentor}@example.invalid`, name: "[synthetic test] Subject Mentor", role: "member", participation: "mentor", status: "approved", availability: [{ day: 2, start: "17:00", end: "18:00" }], timezone: "America/Phoenix", meetingFormat: "either", goals: ["Learning AI"], capacity: 2, discoverable: true },
      { id: ids.subjectMentee, email: `${ids.subjectMentee}@example.invalid`, name: "[synthetic test] Subject Mentee", role: "member", participation: "mentee", status: "approved", availability: [{ day: 2, start: "17:30", end: "18:30" }], timezone: "America/Phoenix", meetingFormat: "online", capacity: 2, discoverable: true },
      { id: ids.signout, email: `${ids.signout}@example.invalid`, name: "[synthetic test] Signout", role: "member", participation: null, status: "approved", discoverable: false },
      { id: ids.pwMember, email: `${ids.pwMember}@example.invalid`, name: "[synthetic test] Password Member", role: "member", participation: null, status: "approved", discoverable: false, passwordHash: testPasswordHash },
      { id: ids.pwPaused, email: `${ids.pwPaused}@example.invalid`, name: "[synthetic test] Paused Member", role: "member", participation: null, status: "paused", discoverable: false, passwordHash: testPasswordHash },
    ]);
    const sessionRows = await Promise.all(Object.entries(ids).map(async ([key, memberId]) => ({
      id: `test-session-${key}-${suffix}`,
      tokenHash: await hashAuthToken(tokens[key as keyof typeof tokens]),
      memberId,
      expiresAt: new Date(Date.now() + 60_000),
    })));
    await db.insert(sessions).values(sessionRows);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(checkins).where(inArray(checkins.authorId, Object.values(ids)));
    const memberIds = Object.values(ids);
    await db.delete(matches).where(or(inArray(matches.mentorId, memberIds), inArray(matches.menteeId, memberIds))!);
    await db.delete(decisions).where(inArray(decisions.actorId, memberIds));
    await db.delete(importBatches).where(inArray(importBatches.createdBy, memberIds));
    await db.delete(newsletterDrafts).where(inArray(newsletterDrafts.id, createdDraftIds.length ? createdDraftIds : ["none"]));
    await db.delete(events).where(inArray(events.id, createdEventIds.length ? createdEventIds : ["none"]));
    await db.delete(members).where(inArray(members.email, [`import-${suffix}@example.invalid`, joinPwEmail, bootstrapEmail]));
    await db.delete(sessions).where(inArray(sessions.memberId, memberIds));
    await db.delete(members).where(inArray(members.id, memberIds));
    await close();
  });

  it("filters discovery, keeps decisions private, and activates a mutual match without approval", async () => {
    const found = await caller("mentee").mentorship.discover({ role: "mentor" });
    expect(found.cards.some((card) => card.id === ids.mentor)).toBe(true);
    expect(await caller("mentee").mentorship.decide({ candidateId: ids.mentor, role: "mentor", decision: "interested" })).toEqual({ mutual: false });
    const stillFound = await caller("mentor").mentorship.discover({ role: "mentee" });
    expect(stillFound.cards.some((card) => card.id === ids.mentee)).toBe(true);
    const mutual = await caller("mentor").mentorship.decide({ candidateId: ids.mentee, role: "mentee", decision: "interested" });
    expect(mutual.mutual).toBe(true);
    matchId = mutual.matchId!;
    const relationships = await caller("mentee").mentorship.matches();
    expect(relationships.find((match) => match.id === matchId)?.status).toBe("active");
  });

  it("returns private notes only to their author, including for staff", async () => {
    await caller("mentee").mentorship.checkin({ matchId, met: true, useful: true, continue: true, privateNote: "sensitive synthetic note" });
    expect((await caller("mentee").mentorship.checkins({ matchId }))[0].privateNote).toBe("sensitive synthetic note");
    expect((await caller("mentor").mentorship.checkins({ matchId }))[0].privateNote).toBe("");
    expect((await caller("admin").mentorship.checkins({ matchId }))[0].privateNote).toBe("");
  });

  it("enforces optimistic content versions and unpublished rollback", async () => {
    const admin = caller("admin");
    const before = await admin.content.state();
    const originalRevisionIds = before.revisions.map((revision) => revision.id);
    const changed = { ...before.draft, sections: before.draft.sections.map((section, index) => index === 0 ? { ...section, title: `[synthetic test] ${suffix}` } : section) };
    try {
      const saved = await admin.content.save({ document: changed, baseVersion: before.draft.version });
      expect(saved.draft.version).toBe(before.draft.version + 1);
      await expect(admin.content.save({ document: changed, baseVersion: before.draft.version })).rejects.toThrow(/changed/i);
      const published = await admin.content.publish({ baseVersion: saved.draft.version });
      expect(published.published.version).toBe(saved.draft.version + 1);
      const rollback = await admin.content.rollback({ revisionId: saved.revisions[0].id, baseVersion: published.draft.version });
      expect(rollback.draft.version).toBe(published.draft.version + 1);
      expect(rollback.published.version).toBe(published.published.version);
    } finally {
      await db.delete(contentRevisions).where(notInArray(contentRevisions.id, originalRevisionIds.length ? originalRevisionIds : ["none"]));
      await db.update(content).set({ draft: before.draft, published: before.published }).where(eq(content.id, 1));
    }
  });

  it("commits an import at most once and reports real duplicate counts", async () => {
    const admin = caller("admin");
    const preview = await admin.imports.preview({ csv: `name,email\nTest Import,import-${suffix}@example.invalid` });
    expect(preview.newCount).toBe(1);
    expect(await admin.imports.commit({ token: preview.token })).toEqual({ imported: 1, duplicates: 0 });
    expect(await admin.imports.commit({ token: preview.token })).toEqual({ imported: 0, duplicates: 1 });
  });

  it("fails closed and truthfully when email delivery is unconfigured", async () => {
    if (!process.env.EMAIL || !process.env.EMAIL_FROM) {
      await expect(caller().auth.requestLink({ email: `${ids.mentor}@example.invalid` })).rejects.toThrow(/Email sending is unavailable/);
    }
  });

  it("keeps public queries open and blocks unauthenticated private access", async () => {
    const site = await caller().public.site();
    expect(site).toEqual(expect.objectContaining({
      document: expect.any(Object), events: expect.any(Array),
      team: expect.any(Array), partners: expect.any(Array), demo: expect.any(Boolean),
    }));
    expect(await caller().auth.session()).toBeNull();
    const privateCalls = [
      () => caller().membership.me(),
      () => caller().admin.stats(),
      () => caller().admin.members(),
      () => caller().admin.matches(),
      () => caller().admin.events(),
      () => caller().admin.integrations(),
      () => caller().content.state(),
      () => caller().mailing.drafts(),
    ];
    for (const makeCall of privateCalls) {
      await expect(makeCall()).rejects.toThrow(/Sign in with your individual account/);
    }
    expect(await caller("mentor").auth.session()).toEqual({
      id: ids.mentor, name: "[synthetic test] Mentor",
      email: `${ids.mentor}@example.invalid`, role: "member",
    });
  });

  it("separates member, coordinator and editor permissions", async () => {
    const denied = /authorized individual staff/;
    await expect(caller("mentor").admin.stats()).rejects.toThrow(denied);
    await expect(caller("mentor").admin.members()).rejects.toThrow(denied);
    await expect(caller("mentor").content.state()).rejects.toThrow(denied);
    await expect(caller("mentor").mailing.drafts()).rejects.toThrow(denied);

    const coordinator = caller("coordinator");
    expect((await coordinator.admin.members()).some((member) => Boolean(member.email))).toBe(true);
    expect(Array.isArray(await coordinator.admin.matches())).toBe(true);
    expect((await coordinator.mailing.exportContacts()).count).toBeGreaterThanOrEqual(0);
    await expect(coordinator.content.state()).rejects.toThrow(denied);

    const editor = caller("editor");
    expect((await editor.content.state()).draft).toEqual(expect.any(Object));
    expect(Array.isArray(await editor.mailing.drafts())).toBe(true);
    await expect(editor.admin.members()).rejects.toThrow(denied);
    await expect(editor.mailing.exportContacts()).rejects.toThrow(denied);

    expect(await caller("admin").admin.integrations()).toEqual(expect.objectContaining({
      database: true, hubspot: false, jev: expect.any(Boolean),
      workersAi: expect.any(Boolean), email: expect.any(Boolean),
      turnstile: expect.any(Boolean), demo: expect.any(Boolean),
    }));
  });

  it("rejects invalid availability, timezone and profile input without writing", async () => {
    const outsider = caller("outsider");
    const valid = {
      name: "[synthetic test] Outsider", participation: "both" as const,
      headline: "", bio: "", expertise: [], goals: [], timezone: "America/Phoenix",
      availability: [{ day: 2, start: "17:00", end: "18:00" }], meetingFormat: "either" as const,
      location: "", capacity: 1, discoverable: false, aiConsent: false,
      major: "", career: "", interests: [], interestAnswer: "",
    };
    await expect(outsider.membership.updateProfile({ ...valid, availability: [{ day: 2, start: "18:00", end: "17:00" }] })).rejects.toThrow(/Availability/);
    await expect(outsider.membership.updateProfile({ ...valid, availability: [{ day: 7, start: "17:00", end: "18:00" }] })).rejects.toThrow();
    await expect(outsider.membership.updateProfile({ ...valid, availability: [{ day: 2, start: "5pm", end: "6pm" }] })).rejects.toThrow();
    await expect(outsider.membership.updateProfile({ ...valid, timezone: "Mars/Olympus" })).rejects.toThrow(/timezone/i);
    await expect(outsider.membership.updateProfile({ ...valid, capacity: 0 })).rejects.toThrow();
    await expect(outsider.membership.updateProfile({ ...valid, name: "" })).rejects.toThrow();
    await expect(outsider.membership.updateProfile({ ...valid, extra: true } as unknown as typeof valid)).rejects.toThrow();
    const updated = await outsider.membership.updateProfile(valid);
    expect(updated).toEqual(expect.objectContaining({
      id: ids.outsider, participation: "both", availability: valid.availability,
      major: "", career: "", interests: [], interestAnswer: "",
    }));
  });

  it("enforces relationship ownership for updates, check-ins and lists", async () => {
    const ownedMatchId = `test-owned-match-${suffix}`;
    await db.insert(matches).values({
      id: ownedMatchId, mentorId: ids.subjectMentor, menteeId: ids.subjectMentee,
      status: "awaiting-coordinator", goal: "[synthetic test] ownership",
    });
    const outsider = caller("outsider");
    const notAccessible = /not found|not accessible/i;
    await expect(outsider.mentorship.updateMatch({ id: ownedMatchId, goal: "hijack" })).rejects.toThrow(notAccessible);
    await expect(outsider.mentorship.checkins({ matchId: ownedMatchId })).rejects.toThrow(notAccessible);
    await expect(outsider.mentorship.checkin({ matchId: ownedMatchId, met: true, useful: true, continue: true, privateNote: "x" })).rejects.toThrow(notAccessible);
    expect((await outsider.mentorship.matches()).some((match) => match.id === ownedMatchId)).toBe(false);
    expect((await caller("subjectMentor").mentorship.matches()).some((match) => match.id === ownedMatchId)).toBe(true);

    const participant = caller("subjectMentor");
    await expect(participant.mentorship.updateMatch({ id: ownedMatchId, status: "paused" })).rejects.toThrow(/awaiting coordinator/i);
    expect((await caller("admin").admin.approveMatch({ id: ownedMatchId, approve: true })).status).toBe("active");
    const updated = await participant.mentorship.updateMatch({
      id: ownedMatchId, goal: "[synthetic test] updated", meetingUrl: "https://example.invalid/meet",
      nextMeeting: "2026-12-01T18:00:00Z", status: "paused",
    });
    expect(updated).toEqual(expect.objectContaining({
      id: ownedMatchId, status: "paused", goal: "[synthetic test] updated",
      meetingUrl: "https://example.invalid/meet", mentorName: expect.any(String), menteeName: expect.any(String),
    }));
    const checkin = await caller("subjectMentee").mentorship.checkin({
      matchId: ownedMatchId, met: true, useful: true, continue: true, privateNote: "[synthetic test] owner-only note",
    });
    expect(checkin.privateNote).toBe("[synthetic test] owner-only note");
    expect((await caller("subjectMentor").mentorship.checkins({ matchId: ownedMatchId }))[0].privateNote).toBe("");
    expect((await caller("admin").admin.matches()).some((match) => match.id === ownedMatchId)).toBe(true);
  });

  it("destroys the session and clears the cookie on sign-out", async () => {
    const responseHeaders = new Headers();
    const signedIn = caller("signout", responseHeaders);
    expect((await signedIn.auth.session())?.id).toBe(ids.signout);
    expect(await signedIn.auth.signOut({})).toEqual({ success: true });
    const cookie = responseHeaders.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    for (const part of ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"]) {
      expect(cookie).toContain(part);
    }
    expect(await caller("signout").auth.session()).toBeNull();
    const anonymousHeaders = new Headers();
    expect(await caller(null, anonymousHeaders).auth.signOut({})).toEqual({ success: true });
    expect(anonymousHeaders.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
  });

  it("returns contracted shapes for member, staff and write procedures", async () => {
    const me = await caller("mentor").membership.me();
    expect(me).toEqual(expect.objectContaining({
      id: ids.mentor, email: `${ids.mentor}@example.invalid`, role: "member",
      participation: "mentor", status: "approved", createdAt: expect.any(String),
      expertise: expect.any(Array), goals: expect.any(Array), interests: expect.any(Array),
      major: expect.any(String), career: expect.any(String), interestAnswer: expect.any(String),
      availability: expect.any(Array),
    }));
    const stats = await caller("admin").admin.stats();
    expect(stats).toEqual(expect.objectContaining({
      members: expect.any(Number), mentors: expect.any(Number), mentees: expect.any(Number),
      pendingApplications: expect.any(Number), pendingMatches: expect.any(Number),
      activeMatches: expect.any(Number), recordedMeetings: expect.any(Number), checkins: expect.any(Number),
    }));
    expect(stats.signupTrend).toHaveLength(14);
    expect((await caller().public.site()).document).toEqual(expect.objectContaining({
      version: expect.any(Number), sections: expect.any(Array),
    }));
    expect(await caller("admin").content.state()).toEqual(expect.objectContaining({
      draft: expect.any(Object), published: expect.any(Object), revisions: expect.any(Array),
    }));

    const event = await caller("admin").admin.saveEvent({
      title: "[synthetic test] Event", date: "2026-12-12T18:00:00Z",
      description: "[synthetic test] description", location: "Phoenix",
      registerUrl: "https://example.invalid/register",
    });
    createdEventIds.push(event.id);
    expect(event).toEqual(expect.objectContaining({
      id: expect.any(String), title: "[synthetic test] Event", location: "Phoenix",
      description: "[synthetic test] description", registerUrl: "https://example.invalid/register",
    }));
    expect((await caller().public.site()).events.some((item) => item.id === event.id)).toBe(true);

    const draft = await caller("admin").mailing.saveDraft({
      subject: "[synthetic test] Subject", body: "[synthetic test] body",
    });
    createdDraftIds.push(draft.id);
    expect(draft).toEqual(expect.objectContaining({
      id: expect.any(String), subject: "[synthetic test] Subject",
      body: "[synthetic test] body", updatedAt: expect.any(String),
    }));
    expect((await caller("admin").mailing.drafts()).some((item) => item.id === draft.id)).toBe(true);
  });

  it("auth.signIn accepts valid password credentials and issues a usable session cookie", async () => {
    const responseHeaders = new Headers();
    const result = await caller(null, responseHeaders).auth.signIn({
      email: `${ids.pwMember}@example.invalid`,
      password: TEST_PASSWORD,
    });
    expect(result).toEqual({ success: true, name: "[synthetic test] Password Member" });
    const cookie = responseHeaders.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    for (const part of ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age="]) {
      expect(cookie).toContain(part);
    }
    const token = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(cookie)?.[1];
    expect(token).toBeTruthy();
    expect((await callerWithCookie(token!).auth.session())?.id).toBe(ids.pwMember);
  });

  it("auth.signIn does not disclose whether the email, password or hash exists", async () => {
    const wrongPassword = await signInFailure(`${ids.pwMember}@example.invalid`, "definitely-wrong-password");
    const unknownEmail = await signInFailure(`absent-${suffix}@example.invalid`, TEST_PASSWORD);
    const noPasswordHash = await signInFailure(`${ids.mentor}@example.invalid`, TEST_PASSWORD);
    for (const failure of [wrongPassword, unknownEmail, noPasswordHash]) {
      expect(failure.code).toBe("UNAUTHORIZED");
      expect(failure.message).toBe(wrongPassword.message);
    }
    expect(wrongPassword.message).toMatch(/email and password combination/i);
  });

  it("auth.signIn blocks a paused member even with the correct password", async () => {
    const paused = await signInFailure(`${ids.pwPaused}@example.invalid`, TEST_PASSWORD);
    const unknown = await signInFailure(`absent-paused-${suffix}@example.invalid`, TEST_PASSWORD);
    expect(paused.code).toBe("UNAUTHORIZED");
    expect(paused.message).toBe(unknown.message);
    expect(paused.message).not.toMatch(/paused/i);
  });

  it("membership.join stores only a PBKDF2 hash for a submitted password", async () => {
    const joined = await caller().membership.join({
      name: "[synthetic test] Password Joiner",
      email: joinPwEmail,
      experience: ["Security"],
      interests: ["Learning AI"],
      password: TEST_JOIN_PASSWORD,
      newsletterConsent: false,
    });
    expect(joined).toEqual(expect.objectContaining({
      id: expect.any(String), message: expect.stringContaining("sign in"),
    }));

    const rows = await db.select().from(members).where(eq(members.email, joinPwEmail)).limit(1);
    expect(rows).toHaveLength(1);
    const stored = rows[0].passwordHash;
    expect(stored).toMatch(/^pbkdf2\$/);
    expect(stored).not.toContain(TEST_JOIN_PASSWORD);
    expect(await verifyPassword(TEST_JOIN_PASSWORD, stored!)).toBe(true);
    expect(await verifyPassword("not-the-join-password", stored!)).toBe(false);

    const responseHeaders = new Headers();
    expect(await caller(null, responseHeaders).auth.signIn({ email: joinPwEmail, password: TEST_JOIN_PASSWORD })).toEqual({
      success: true, name: "[synthetic test] Password Joiner",
    });
    expect(responseHeaders.get("set-cookie") ?? "").toContain(`${SESSION_COOKIE}=`);
  });

  it("scripts/bootstrap.mjs writes a PBKDF2 hash to Postgres and never the plaintext", async () => {
    const run = promisify(execFile);
    const args = (password: string) => [
      "--env-file=.env.local", "scripts/bootstrap.mjs", bootstrapEmail, password,
      "coordinator", "[synthetic test] Bootstrap Staff",
    ];
    await run(process.execPath, args(BOOTSTRAP_PASSWORD), { cwd: process.cwd() });
    const rows = await db.select().from(members).where(eq(members.email, bootstrapEmail)).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("coordinator");
    expect(rows[0].status).toBe("approved");
    expect(rows[0].passwordHash).toMatch(/^pbkdf2\$/);
    expect(rows[0].passwordHash).not.toContain(BOOTSTRAP_PASSWORD);
    expect(await verifyPassword(BOOTSTRAP_PASSWORD, rows[0].passwordHash!)).toBe(true);

    // Re-running rotates the salted hash on the same row instead of duplicating it.
    await run(process.execPath, args(BOOTSTRAP_PASSWORD), { cwd: process.cwd() });
    const again = await db.select().from(members).where(eq(members.email, bootstrapEmail)).limit(1);
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(rows[0].id);
    expect(again[0].passwordHash).not.toBe(rows[0].passwordHash);
  });
});
