import { and, asc, desc, eq, inArray, ne, or, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { AvailabilitySlot, Checkin, DiscoveryCard, DiscoveryResult, Match, MeetingFormat, SessionUser } from "../lib/contracts";
import type { Database, Transaction } from "./db";
import { checkins, decisions, matches, members, type MemberRow, type MatchRow } from "./db/schema";
import { meetingFormatsCompatible, weeklyOverlapMinutes } from "./domain";
import { rankWithJev } from "./jev";
import { toCheckin, toMatch } from "./mappers";
import {
  actorCanSeekRole,
  canAccessMatch,
  canParticipantTransitionStatus,
  candidateOffersRole,
  findExistingMatch,
  hidesFromDiscovery,
  isMutualInterest,
  matchStatusForMutualInterest,
  remainingCapacity,
  reservesCapacity,
} from "./matching";
import type { RuntimeEnv } from "./env";

type Store = Database | Transaction;
type DesiredRole = "mentor" | "mentee";

/** Actor must hold the complementary participation to seek a role. */
export function supportsRole(member: { participation: MemberRow["participation"] }, desired: DesiredRole): boolean {
  return actorCanSeekRole(member.participation, desired);
}

/** A candidate is discoverable for a role only if they actually offer it. */
export function candidateSupportsRole(member: { participation: MemberRow["participation"] }, desired: DesiredRole): boolean {
  return candidateOffersRole(member.participation, desired);
}

/** Capacity is held by active AND awaiting-coordinator matches in either role. */
export function reservationCounts(rows: ReadonlyArray<{ mentorId: string; menteeId: string; status: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of rows) {
    if (!reservesCapacity(match.status)) continue;
    counts.set(match.mentorId, (counts.get(match.mentorId) ?? 0) + 1);
    counts.set(match.menteeId, (counts.get(match.menteeId) ?? 0) + 1);
  }
  return counts;
}

type EligibilityProfile = {
  capacity: number;
  meetingFormat: MeetingFormat;
  timezone: string;
  availability: AvailabilitySlot[];
};

/**
 * All hard filters applied before a candidate reaches Jev. Jev can only ever
 * re-rank this already-filtered set and never grants consent or capacity.
 */
export function candidateEligibility(
  actor: EligibilityProfile,
  candidate: EligibilityProfile & { participation: MemberRow["participation"] },
  role: DesiredRole,
  actorReservations: number,
  candidateReservations: number,
): boolean {
  return (
    candidateOffersRole(candidate.participation, role) &&
    remainingCapacity(actor.capacity, actorReservations) > 0 &&
    remainingCapacity(candidate.capacity, candidateReservations) > 0 &&
    meetingFormatsCompatible(actor.meetingFormat, candidate.meetingFormat) &&
    weeklyOverlapMinutes(actor.timezone, actor.availability, candidate.timezone, candidate.availability) > 0
  );
}

function sharedTerms(a: MemberRow, b: MemberRow): number {
  const terms = new Set([...a.goals, ...a.expertise, ...a.interests].flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#]+/)).filter((term) => term.length > 2));
  return [...b.goals, ...b.expertise, ...b.interests].reduce(
    (score, value) => score + [...terms].filter((term) => value.toLowerCase().includes(term)).length,
    0,
  );
}

export async function discoverMembers(db: Database, env: RuntimeEnv, user: SessionUser, role: DesiredRole): Promise<DiscoveryResult> {
  const actorRows = await db.select().from(members).where(eq(members.id, user.id)).limit(1);
  const actor = actorRows[0];
  if (!actor || actor.status !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "An approved membership is required for discovery." });
  if (!supportsRole(actor, role)) throw new TRPCError({ code: "BAD_REQUEST", message: `Your participation role cannot seek a ${role}. Update your profile first.` });
  const participationFilter = or(eq(members.participation, role), eq(members.participation, "both")) as SQL;
  const rows = await db.select().from(members).where(and(
    ne(members.id, actor.id),
    eq(members.status, "approved"),
    eq(members.discoverable, true),
    participationFilter,
  ));
  const reservations = reservationCounts(await db.select().from(matches).where(or(eq(matches.status, "active"), eq(matches.status, "awaiting-coordinator"))));
  const actorReservations = reservations.get(actor.id) ?? 0;
  if (remainingCapacity(actor.capacity, actorReservations) === 0) {
    return { cards: [], source: "manual", notice: "Your active and pending matches already use your declared capacity." };
  }

  let candidates = rows.filter((candidate) =>
    candidateEligibility(actor, candidate, role, actorReservations, reservations.get(candidate.id) ?? 0),
  );
  if (candidates.length) {
    const ids = candidates.map((candidate) => candidate.id);
    const privateDecisions = await db.select().from(decisions).where(or(
      and(eq(decisions.actorId, actor.id), inArray(decisions.candidateId, ids)),
      and(inArray(decisions.actorId, ids), eq(decisions.candidateId, actor.id)),
    ));
    const reciprocalRole: DesiredRole = role === "mentor" ? "mentee" : "mentor";
    candidates = candidates.filter((candidate) =>
      !hidesFromDiscovery(privateDecisions, actor.id, candidate.id, role, reciprocalRole),
    );
    const existing = await db.select().from(matches).where(or(
      and(eq(matches.mentorId, actor.id), inArray(matches.menteeId, ids)),
      and(inArray(matches.mentorId, ids), eq(matches.menteeId, actor.id)),
    ));
    candidates = candidates.filter((candidate) => !findExistingMatch(existing, actor.id, candidate.id));
  }

  const cards = new Map<string, DiscoveryCard>();
  for (const candidate of candidates) {
    const overlapMinutes = weeklyOverlapMinutes(actor.timezone, actor.availability, candidate.timezone, candidate.availability);
    const score = sharedTerms(actor, candidate);
    cards.set(candidate.id, {
      id: candidate.id,
      name: candidate.name,
      headline: candidate.headline,
      bio: candidate.bio,
      expertise: candidate.expertise,
      goals: candidate.goals,
      timezone: candidate.timezone,
      availability: candidate.availability,
      meetingFormat: candidate.meetingFormat,
      location: candidate.location,
      reasons: [`${overlapMinutes} minutes of weekly schedule overlap`, ...(score ? [`${score} shared professional interest${score === 1 ? "" : "s"}`] : [])],
      overlapMinutes,
      source: "manual",
      confidence: null,
    });
  }
  const ordered = [...cards.values()].sort((a, b) => b.overlapMinutes - a.overlapMinutes || a.name.localeCompare(b.name));
  let source: "jev" | "manual" = "manual";
  let notice: string | null = env.TYPESAFE_API_KEY ? null : "Jev is not configured; showing schedule-filtered local ranking.";
  const jevCandidates = candidates.filter((candidate) => candidate.aiConsent);
  if (env.TYPESAFE_API_KEY && actor.aiConsent && jevCandidates.length) {
    const safeActor = { id: actor.id, goals: actor.goals, expertise: actor.expertise, major: actor.major, career: actor.career, interests: actor.interests, timezone: actor.timezone, availability: actor.availability, meetingFormat: actor.meetingFormat };
    const safeCandidates = jevCandidates.map((candidate) => ({ id: candidate.id, goals: candidate.goals, expertise: candidate.expertise, major: candidate.major, career: candidate.career, interests: candidate.interests, timezone: candidate.timezone, availability: candidate.availability, meetingFormat: candidate.meetingFormat }));
    const ranking = await rankWithJev(safeActor, safeCandidates, env);
    if (ranking) {
      source = "jev";
      notice = jevCandidates.length === candidates.length ? null : "Only members who consented to AI ranking were sent to Jev; all results remain schedule filtered.";
      const rankMap = new Map(ranking.map((item, index) => [item.id, { ...item, index }]));
      ordered.sort((a, b) => (rankMap.get(a.id)?.index ?? 10_000) - (rankMap.get(b.id)?.index ?? 10_000) || b.overlapMinutes - a.overlapMinutes);
      for (const card of ordered) {
        const rank = rankMap.get(card.id);
        if (rank) Object.assign(card, { reasons: rank.reasons.length ? rank.reasons : card.reasons, confidence: rank.confidence, source: "jev" });
      }
    } else {
      notice = "Jev is unavailable; showing schedule-filtered local ranking. No match was approved automatically.";
    }
  } else if (env.TYPESAFE_API_KEY) {
    notice = "Jev ranking requires your AI consent and candidate AI consent; local ranking was used without sending profiles.";
  }
  return { cards: ordered.slice(0, 20), source, notice };
}

export async function decideCandidate(
  db: Database,
  user: SessionUser,
  input: { candidateId: string; role: DesiredRole; decision: "interested" | "pass" },
): Promise<{ mutual: boolean; matchId?: string }> {
  return db.transaction(async (tx) => {
    if (input.candidateId === user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You cannot make a mentorship decision about yourself." });
    }
    const pairIds = [user.id, input.candidateId].sort();
    const locked = await tx.select().from(members).where(inArray(members.id, pairIds)).orderBy(asc(members.id)).for("update");
    const actor = locked.find((member) => member.id === user.id);
    const candidate = locked.find((member) => member.id === input.candidateId);
    if (!actor || actor.status !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "An approved membership is required to make decisions." });
    if (!candidate || candidate.status !== "approved" || !candidate.discoverable || !candidateSupportsRole(candidate, input.role)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This discovery candidate is no longer available." });
    }
    if (!supportsRole(actor, input.role)) throw new TRPCError({ code: "BAD_REQUEST", message: "Your participation role is incompatible with this decision." });
    await tx.insert(decisions).values({ id: crypto.randomUUID(), actorId: actor.id, candidateId: candidate.id, role: input.role, decision: input.decision })
      .onConflictDoUpdate({ target: [decisions.actorId, decisions.candidateId, decisions.role], set: { decision: input.decision, createdAt: new Date() } });
    if (input.decision === "pass") return { mutual: false };
    const reciprocalRole: DesiredRole = input.role === "mentor" ? "mentee" : "mentor";
    const reciprocal = await tx.select().from(decisions).where(and(
      eq(decisions.actorId, candidate.id), eq(decisions.candidateId, actor.id), eq(decisions.role, reciprocalRole),
    )).limit(1);
    if (!isMutualInterest(input.decision, reciprocal[0]?.decision)) return { mutual: false };
    if (!meetingFormatsCompatible(actor.meetingFormat, candidate.meetingFormat) || weeklyOverlapMinutes(actor.timezone, actor.availability, candidate.timezone, candidate.availability) === 0) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Your schedules or meeting formats no longer overlap. Update availability before matching." });
    }
    const mentorId = input.role === "mentor" ? candidate.id : actor.id;
    const menteeId = input.role === "mentor" ? actor.id : candidate.id;
    // Idempotent per pair: a "both" pair flipping roles must not create a
    // second relationship in the opposite orientation.
    const pairMatches = await tx.select().from(matches).where(or(
      and(eq(matches.mentorId, actor.id), eq(matches.menteeId, candidate.id)),
      and(eq(matches.mentorId, candidate.id), eq(matches.menteeId, actor.id)),
    ));
    const existing = findExistingMatch(pairMatches, actor.id, candidate.id);
    if (existing) return { mutual: true, matchId: existing.id };
    const counts = reservationCounts(await tx.select().from(matches).where(or(eq(matches.status, "active"), eq(matches.status, "awaiting-coordinator"))));
    if (remainingCapacity(actor.capacity, counts.get(actor.id) ?? 0) === 0 || remainingCapacity(candidate.capacity, counts.get(candidate.id) ?? 0) === 0) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A participant has reached match capacity. No additional match was created." });
    }
    const inserted = await tx.insert(matches).values({ id: crypto.randomUUID(), mentorId, menteeId, status: matchStatusForMutualInterest() }).returning({ id: matches.id });
    return { mutual: true, matchId: inserted[0].id };
  });
}

async function matchDto(db: Store, row: MatchRow): Promise<Match> {
  const people = await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, [row.mentorId, row.menteeId]));
  return toMatch(row, people.find((person) => person.id === row.mentorId)?.name ?? "Former member", people.find((person) => person.id === row.menteeId)?.name ?? "Former member");
}

export async function listMatches(db: Database, user: SessionUser, all = false): Promise<Match[]> {
  if (all && !["admin", "coordinator"].includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Coordinator access is required." });
  const where = all ? undefined : or(eq(matches.mentorId, user.id), eq(matches.menteeId, user.id));
  const rows = await db.select().from(matches).where(where).orderBy(desc(matches.createdAt));
  const result: Match[] = [];
  for (const row of rows) result.push(await matchDto(db, row));
  return result;
}

async function ownedMatch(db: Store, id: string, user: SessionUser): Promise<MatchRow> {
  const rows = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!rows[0] || !canAccessMatch(rows[0], user)) throw new TRPCError({ code: "NOT_FOUND", message: "Relationship not found or not accessible to this account." });
  return rows[0];
}

export async function updateMatch(db: Database, user: SessionUser, input: { id: string; goal?: string; nextMeeting?: string; meetingUrl?: string; status?: "paused" | "completed" }): Promise<Match> {
  const current = await ownedMatch(db, input.id, user);
  if (input.status !== undefined && !canParticipantTransitionStatus(current.status, input.status)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Only an active relationship can be ${input.status}. This match is ${current.status.replace("-", " ")}; no status change was made.` });
  }
  const set: Partial<typeof matches.$inferInsert> = { updatedAt: new Date() };
  if (input.goal !== undefined) set.goal = input.goal;
  if (input.nextMeeting !== undefined) set.nextMeeting = input.nextMeeting ? new Date(input.nextMeeting) : null;
  if (input.meetingUrl !== undefined) set.meetingUrl = input.meetingUrl;
  if (input.status !== undefined) set.status = input.status;
  const rows = await db.update(matches).set(set).where(eq(matches.id, current.id)).returning();
  return matchDto(db, rows[0]);
}

export async function listCheckins(db: Database, user: SessionUser, matchId: string): Promise<Checkin[]> {
  await ownedMatch(db, matchId, user);
  const rows = await db.select().from(checkins).where(eq(checkins.matchId, matchId)).orderBy(desc(checkins.createdAt));
  return rows.map((row) => toCheckin(row, user.id));
}

export async function addCheckin(db: Database, user: SessionUser, input: { matchId: string; met: boolean; useful: boolean; continue: boolean; privateNote: string }): Promise<Checkin> {
  const match = await ownedMatch(db, input.matchId, user);
  if (match.mentorId !== user.id && match.menteeId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only relationship participants can add check-ins." });
  if (["completed", "declined"].includes(match.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This relationship is closed to new check-ins." });
  const rows = await db.insert(checkins).values({ id: crypto.randomUUID(), matchId: match.id, authorId: user.id, met: input.met, useful: input.useful, continue: input.continue, privateNote: input.privateNote }).returning();
  return toCheckin(rows[0], user.id);
}
