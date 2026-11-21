import { describe, expect, it } from "vitest";
import type { AvailabilitySlot, MeetingFormat } from "../lib/contracts";
import {
  candidateEligibility,
  candidateSupportsRole,
  reservationCounts,
  supportsRole,
} from "./mentorship";

/**
 * Pure focused tests for discovery eligibility. These exercise in-memory
 * objects only; they are NOT a substitute for the real Postgres integration
 * suite (owned separately) and make no claim about database transactions.
 */

const slot = (day: number, start: string, end: string): AvailabilitySlot => ({ day, start, end });
const withParticipation = (participation: string | null) => ({ participation }) as never;

describe("mentorship participation compatibility", () => {
  it("lets a mentee seek a mentor and a mentor seek a mentee; 'both' can do either", () => {
    expect(supportsRole(withParticipation("mentee"), "mentor")).toBe(true);
    expect(supportsRole(withParticipation("mentor"), "mentee")).toBe(true);
    expect(supportsRole(withParticipation("both"), "mentor")).toBe(true);
    expect(supportsRole(withParticipation("both"), "mentee")).toBe(true);
  });

  it("rejects same-role or unset participation", () => {
    expect(supportsRole(withParticipation("mentor"), "mentor")).toBe(false);
    expect(supportsRole(withParticipation("mentee"), "mentee")).toBe(false);
    expect(supportsRole(withParticipation(null), "mentor")).toBe(false);
  });

  it("only offers candidates who actually hold the sought role", () => {
    expect(candidateSupportsRole(withParticipation("mentor"), "mentor")).toBe(true);
    expect(candidateSupportsRole(withParticipation("both"), "mentee")).toBe(true);
    expect(candidateSupportsRole(withParticipation("mentee"), "mentor")).toBe(false);
    expect(candidateSupportsRole(withParticipation(null), "mentee")).toBe(false);
  });
});

describe("mentorship capacity reservations", () => {
  it("counts active and awaiting-coordinator matches for both participants", () => {
    const counts = reservationCounts([
      { mentorId: "a", menteeId: "b", status: "active" },
      { mentorId: "b", menteeId: "c", status: "awaiting-coordinator" },
      { mentorId: "a", menteeId: "d", status: "completed" },
      { mentorId: "e", menteeId: "a", status: "paused" },
      { mentorId: "f", menteeId: "a", status: "declined" },
    ] as never);
    expect(counts.get("a")).toBe(1);
    expect(counts.get("b")).toBe(2);
    expect(counts.get("c")).toBe(1);
    expect(counts.get("d")).toBeUndefined();
  });
});

describe("candidate eligibility (filters before any Jev call)", () => {
  const actor = {
    capacity: 2,
    meetingFormat: "either" as MeetingFormat,
    timezone: "UTC",
    availability: [slot(0, "09:00", "17:00")],
  };
  const candidate = {
    participation: "mentor" as const,
    capacity: 1,
    meetingFormat: "online" as MeetingFormat,
    timezone: "UTC",
    availability: [slot(0, "09:00", "17:00")],
  };

  it("accepts a fully eligible candidate", () => {
    expect(candidateEligibility(actor, candidate, "mentor", 0, 0)).toBe(true);
  });

  it("rejects a candidate who does not offer the sought role", () => {
    expect(candidateEligibility(actor, { ...candidate, participation: "mentee" }, "mentor", 0, 0)).toBe(false);
  });

  it("rejects a candidate who has used all of their capacity", () => {
    expect(candidateEligibility(actor, candidate, "mentor", 0, 1)).toBe(false);
  });

  it("rejects a candidate with no overlapping availability", () => {
    expect(candidateEligibility(actor, { ...candidate, availability: [slot(1, "09:00", "17:00")] }, "mentor", 0, 0)).toBe(false);
  });

  it("rejects incompatible meeting formats even with full schedule overlap", () => {
    expect(candidateEligibility(
      { ...actor, meetingFormat: "online" },
      { ...candidate, meetingFormat: "in-person" },
      "mentor",
      0,
      0,
    )).toBe(false);
  });

  it("accepts cross-timezone overlap and a wildcard format", () => {
    expect(candidateEligibility(
      actor,
      {
        ...candidate,
        meetingFormat: "in-person",
        timezone: "Asia/Kolkata",
        availability: [slot(0, "14:30", "15:30")],
      },
      "mentor",
      0,
      0,
    )).toBe(true);
  });

  it("rejects candidates when the actor has no remaining capacity", () => {
    expect(candidateEligibility(actor, candidate, "mentor", 2, 0)).toBe(false);
  });
});
