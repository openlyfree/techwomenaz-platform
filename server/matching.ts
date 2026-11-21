import type { StaffRole } from "../lib/contracts";

/**
 * Pure matching rules shared by discovery and decision handling.
 *
 * These helpers deliberately have no database or framework dependencies so
 * edge cases (capacity boundaries, reciprocal passes, role compatibility)
 * can be verified without a live Postgres instance.
 */

export type DesiredRole = "mentor" | "mentee";
export type DecisionValue = "interested" | "pass";

export function matchStatusForMutualInterest(): "active" {
  // Mutual interest activates a match directly. There is no coordinator
  // approval gate; staff retain pause/decline controls on active matches.
  return "active";
}

/** Only these statuses hold a participant's declared capacity. */
export function reservesCapacity(status: string): boolean {
  return status === "active" || status === "awaiting-coordinator";
}

/** Count capacity-reserving matches for a member, in either mentor/mentee role. */
export function countReservations(
  matches: readonly { mentorId: string; menteeId: string; status: string }[],
  memberId: string,
): number {
  let count = 0;
  for (const match of matches) {
    if (!reservesCapacity(match.status)) continue;
    if (match.mentorId === memberId || match.menteeId === memberId) count += 1;
  }
  return count;
}

export function remainingCapacity(capacity: number, activeMatches: number): number {
  return Math.max(0, capacity - activeMatches);
}

/**
 * Mutual interest requires an explicit "interested" from both sides. A pass,
 * a missing decision or a stale decision never counts as interest.
 */
export function isMutualInterest(
  actorDecision: DecisionValue | string | undefined,
  reciprocalDecision: DecisionValue | string | undefined,
): boolean {
  return actorDecision === "interested" && reciprocalDecision === "interested";
}

/**
 * Discovery is private: hide a candidate when the actor passed on them OR
 * when that candidate passed on the actor. The boolean deliberately does not
 * say which side passed, so no private decision is disclosed.
 */
export function hidesFromDiscovery(
  decisions: readonly { actorId: string; candidateId: string; role: string; decision: string }[],
  actorId: string,
  candidateId: string,
  role: DesiredRole,
  reciprocalRole: DesiredRole,
): boolean {
  return decisions.some((decision) =>
    (decision.actorId === actorId && decision.candidateId === candidateId && decision.role === role && decision.decision === "pass") ||
    (decision.actorId === candidateId && decision.candidateId === actorId && decision.role === reciprocalRole && decision.decision === "pass"),
  );
}

/**
 * A pair has at most one relationship regardless of which member mentors.
 * Used to keep Interested/Pass idempotent when a "both" pair flips roles.
 */
export function findExistingMatch<T extends { id: string; mentorId: string; menteeId: string }>(
  matches: readonly T[],
  aId: string,
  bId: string,
): T | undefined {
  return matches.find((match) =>
    (match.mentorId === aId && match.menteeId === bId) ||
    (match.mentorId === bId && match.menteeId === aId),
  );
}

/** Seek a mentor as a mentee/both; seek a mentee as a mentor/both. */
export function actorCanSeekRole(participation: string | null, desired: DesiredRole): boolean {
  const complementary: DesiredRole = desired === "mentor" ? "mentee" : "mentor";
  return participation === complementary || participation === "both";
}

/** A candidate can be discovered for a role only if they actually offer it. */
export function candidateOffersRole(participation: string | null, desired: DesiredRole): boolean {
  return participation === desired || participation === "both";
}

export function canAccessMatch(
  match: { mentorId: string; menteeId: string },
  user: { id: string; role: StaffRole },
): boolean {
  return (
    match.mentorId === user.id ||
    match.menteeId === user.id ||
    user.role === "admin" ||
    user.role === "coordinator"
  );
}

export function visiblePrivateNote(authorId: string, viewerId: string, note: string): string {
  return authorId === viewerId ? note : "";
}

/**
 * Participants may pause or complete only an ACTIVE match. Awaiting-coordinator
 * and declined matches are coordinator-managed; paused/completed are terminal.
 */
export function canParticipantTransitionStatus(
  currentStatus: string,
  nextStatus: "paused" | "completed",
): boolean {
  return currentStatus === "active";
}

/** Coordinator approval is meaningful only for an awaiting-coordinator match. */
export function canCoordinatorApprove(currentStatus: string): boolean {
  return currentStatus === "awaiting-coordinator";
}
