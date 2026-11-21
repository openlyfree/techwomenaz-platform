import { describe, expect, it } from "vitest";
import {
  actorCanSeekRole,
  canAccessMatch,
  canCoordinatorApprove,
  canParticipantTransitionStatus,
  candidateOffersRole,
  countReservations,
  findExistingMatch,
  hidesFromDiscovery,
  isMutualInterest,
  matchStatusForMutualInterest,
  remainingCapacity,
  reservesCapacity,
  visiblePrivateNote,
} from "./matching";

describe("matching state and privacy", () => {
  it("activates a mutual-interest match directly, with no approval gate", () => {
    expect(matchStatusForMutualInterest()).toBe("active");
  });

  it("enforces capacity without off-by-one errors", () => {
    expect(remainingCapacity(2, 1)).toBe(1);
    expect(remainingCapacity(1, 1)).toBe(0);
    expect(remainingCapacity(0, 0)).toBe(0);
  });

  it("restricts match access to participants or staff", () => {
    const match = { mentorId: "mentor", menteeId: "mentee" };
    expect(canAccessMatch(match, { id: "mentor", role: "member" })).toBe(true);
    expect(canAccessMatch(match, { id: "mentee", role: "member" })).toBe(true);
    expect(canAccessMatch(match, { id: "other", role: "member" })).toBe(false);
    expect(canAccessMatch(match, { id: "staff", role: "coordinator" })).toBe(true);
    expect(canAccessMatch(match, { id: "editor", role: "editor" })).toBe(false);
  });

  it("never exposes private check-in notes to anyone but their author", () => {
    expect(visiblePrivateNote("author", "author", "sensitive")).toBe("sensitive");
    expect(visiblePrivateNote("author", "mentor", "sensitive")).toBe("");
    expect(visiblePrivateNote("author", "admin", "sensitive")).toBe("");
  });

  it("restricts participant status changes to active matches", () => {
    for (const status of ["active", "paused", "completed", "awaiting-coordinator", "declined"] as const) {
      expect(canParticipantTransitionStatus(status, "paused")).toBe(status === "active");
      expect(canParticipantTransitionStatus(status, "completed")).toBe(status === "active");
    }
  });

  it("lets coordinators act only on awaiting-coordinator matches", () => {
    for (const status of ["active", "paused", "completed", "awaiting-coordinator", "declined"] as const) {
      expect(canCoordinatorApprove(status)).toBe(status === "awaiting-coordinator");
    }
  });
});

describe("capacity reservations (active + awaiting only)", () => {
  const rows = [
    { mentorId: "m", menteeId: "a", status: "active" },
    { mentorId: "b", menteeId: "m", status: "awaiting-coordinator" },
    { mentorId: "m", menteeId: "c", status: "paused" },
    { mentorId: "m", menteeId: "d", status: "completed" },
    { mentorId: "m", menteeId: "e", status: "declined" },
    { mentorId: "x", menteeId: "y", status: "active" },
  ];

  it("reserves only for active and awaiting-coordinator matches", () => {
    expect(reservesCapacity("active")).toBe(true);
    expect(reservesCapacity("awaiting-coordinator")).toBe(true);
    expect(reservesCapacity("paused")).toBe(false);
    expect(reservesCapacity("completed")).toBe(false);
    expect(reservesCapacity("declined")).toBe(false);
    expect(reservesCapacity("something-new")).toBe(false);
  });

  it("counts a member as mentor or mentee, never double-counting unrelated matches", () => {
    expect(countReservations(rows, "m")).toBe(2);
    expect(countReservations(rows, "b")).toBe(1);
    expect(countReservations(rows, "a")).toBe(1);
    expect(countReservations(rows, "x")).toBe(1);
    expect(countReservations(rows, "nobody")).toBe(0);
  });

  it("frees capacity exactly when an awaiting match is declined", () => {
    const before = countReservations(rows, "b");
    const declined = rows.map((row) => row.menteeId === "m" ? { ...row, status: "declined" } : row);
    expect(before).toBe(1);
    expect(countReservations(declined, "b")).toBe(0);
    expect(remainingCapacity(1, countReservations(declined, "b"))).toBe(1);
  });
});

describe("decision state and reciprocal privacy", () => {
  it("is mutual only when both sides are interested", () => {
    expect(isMutualInterest("interested", "interested")).toBe(true);
    expect(isMutualInterest("interested", "pass")).toBe(false);
    expect(isMutualInterest("pass", "interested")).toBe(false);
    expect(isMutualInterest("pass", "pass")).toBe(false);
    expect(isMutualInterest(undefined, "interested")).toBe(false);
    expect(isMutualInterest("interested", undefined)).toBe(false);
  });

  it("hides a candidate when either side passed, without revealing which side", () => {
    const decisions = [
      { actorId: "a", candidateId: "b", role: "mentor", decision: "pass" },
      { actorId: "c", candidateId: "a", role: "mentee", decision: "pass" },
    ];
    expect(hidesFromDiscovery(decisions, "a", "b", "mentor", "mentee")).toBe(true);
    expect(hidesFromDiscovery(decisions, "a", "c", "mentor", "mentee")).toBe(true);
  });

  it("does not confuse role directions or interested decisions with passes", () => {
    const decisions = [
      { actorId: "a", candidateId: "b", role: "mentee", decision: "pass" },
      { actorId: "b", candidateId: "a", role: "mentor", decision: "interested" },
    ];
    expect(hidesFromDiscovery(decisions, "a", "b", "mentor", "mentee")).toBe(false);
    expect(hidesFromDiscovery(decisions, "a", "b", "mentee", "mentor")).toBe(true);
  });
});

describe("idempotent pair matching", () => {
  it("finds an existing relationship in either mentor/mentee orientation", () => {
    const matches = [{ id: "m1", mentorId: "a", menteeId: "b" }];
    expect(findExistingMatch(matches, "a", "b")?.id).toBe("m1");
    expect(findExistingMatch(matches, "b", "a")?.id).toBe("m1");
    expect(findExistingMatch(matches, "a", "c")).toBeUndefined();
    expect(findExistingMatch([], "a", "b")).toBeUndefined();
  });
});

describe("participation compatibility", () => {
  it("requires the actor to hold the complementary participation", () => {
    expect(actorCanSeekRole("mentee", "mentor")).toBe(true);
    expect(actorCanSeekRole("both", "mentor")).toBe(true);
    expect(actorCanSeekRole("mentor", "mentee")).toBe(true);
    expect(actorCanSeekRole("both", "mentee")).toBe(true);
    expect(actorCanSeekRole("mentor", "mentor")).toBe(false);
    expect(actorCanSeekRole("mentee", "mentee")).toBe(false);
    expect(actorCanSeekRole(null, "mentor")).toBe(false);
  });

  it("requires the candidate to actually offer the sought role", () => {
    expect(candidateOffersRole("mentor", "mentor")).toBe(true);
    expect(candidateOffersRole("both", "mentee")).toBe(true);
    expect(candidateOffersRole("mentee", "mentor")).toBe(false);
    expect(candidateOffersRole(null, "mentee")).toBe(false);
  });
});
