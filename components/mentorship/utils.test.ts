import { describe, expect, it } from "vitest";
import type {
  AvailabilitySlot,
  DiscoveryResult,
  Match,
  MeetingFormat,
  Member,
} from "@/lib/contracts";
import {
  buildMatchIcs,
  canSubmitDecision,
  capacitySummary,
  decisionMessage,
  describeMeeting,
  escapeIcsText,
  formatAvailability,
  fromDateTimeLocal,
  hasHorizontalSwipe,
  isProfileComplete,
  matchNextStep,
  overlapText,
  safeHttpUrl,
  safeMessage,
  sourceNotice,
  toDateTimeLocal,
  toIcsDate,
} from "./utils";

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: "m1",
    name: "Ada Member",
    email: "ada@example.test",
    role: "member",
    participation: "mentor",
    status: "approved",
    headline: "Platform engineer",
    bio: "I mentor new developers.",
    expertise: ["React", "Career development"],
    goals: ["Grow into leadership"],
    timezone: "America/Phoenix",
    availability: [{ day: 1, start: "09:00", end: "12:00" }],
    meetingFormat: "online",
    location: "Phoenix, AZ",
    capacity: 2,
    discoverable: true,
    aiConsent: true,
    newsletterConsent: "unknown",
    createdAt: "2026-01-01T00:00:00.000Z",
    major: "Computer Science",
    career: "Engineering",
    interests: ["Learning AI"],
    interestAnswer: "I want to learn AI",
    ...overrides,
  };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "match1",
    mentorId: "mentor1",
    menteeId: "mentee1",
    mentorName: "Ada Mentor",
    menteeName: "Bea Mentee",
    status: "awaiting-coordinator",
    goal: "Prepare for a senior role",
    nextMeeting: null,
    meetingUrl: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("decision guarding", () => {
  it("allows one decision only when idle and not yet decided", () => {
    expect(canSubmitDecision(false, false)).toBe(true);
  });

  it("blocks a second click while the first request is in flight", () => {
    expect(canSubmitDecision(true, false)).toBe(false);
  });

  it("blocks further decisions after the server confirmed one", () => {
    expect(canSubmitDecision(false, true)).toBe(false);
  });

  it("never claims a match is active on mutual interest", () => {
    expect(decisionMessage(true)).toMatch(/check my mentorships/i);
    expect(decisionMessage(true)).not.toMatch(/active|approved|confirmed/i);
  });

  it("does not promise an outcome for a pass or one-sided interest", () => {
    expect(decisionMessage(false)).not.toMatch(/match|active|approved/i);
  });

  it("never offers a fake undo after a decision is recorded", () => {
    expect(decisionMessage(true)).not.toMatch(/undo|retract|take back/i);
    expect(decisionMessage(false)).not.toMatch(/undo|retract|take back/i);
  });
});

describe("swipe gesture", () => {
  it("accepts a clearly horizontal drag", () => {
    expect(hasHorizontalSwipe(100, 20)).toBe(true);
  });

  it("does not hijack vertical scrolling", () => {
    expect(hasHorizontalSwipe(20, 100)).toBe(false);
  });

  it("ignores diagonal or short drags", () => {
    expect(hasHorizontalSwipe(80, 70)).toBe(false);
    expect(hasHorizontalSwipe(40, 5)).toBe(false);
  });
});

describe("honest discovery messaging", () => {
  it("surfaces the server notice verbatim when present", () => {
    const result: DiscoveryResult = {
      cards: [],
      source: "manual",
      notice: "Jev ranking is temporarily unavailable.",
    };
    expect(sourceNotice(result)).toBe("Jev ranking is temporarily unavailable.");
  });

  it("explains manual ranking without inventing a score", () => {
    expect(sourceNotice({ cards: [], source: "manual", notice: null })).toMatch(/jev ranking is unavailable/i);
  });

  it("does not add a warning when the server reports no problem", () => {
    expect(sourceNotice({ cards: [], source: "jev", notice: null })).toBeNull();
  });
});

describe("availability presentation", () => {
  it("labels weekday slots without changing the member's times", () => {
    const slots: AvailabilitySlot[] = [
      { day: 0, start: "09:00", end: "10:00" },
      { day: 6, start: "14:00", end: "16:00" },
    ];
    expect(formatAvailability(slots)).toEqual(["Sun 09:00–10:00", "Sat 14:00–16:00"]);
  });

  it("returns no labels when availability is missing", () => {
    expect(formatAvailability([])).toEqual([]);
  });

  it("describes both the format and the stated timezone", () => {
    expect(describeMeeting("either", "America/Phoenix")).toBe(
      "Either online or in person · America/Phoenix",
    );
    expect(describeMeeting("online", "")).toBe("Online");
  });
});

describe("profile gate", () => {
  it("accepts a complete, discoverable mentor profile", () => {
    expect(isProfileComplete(member())).toBe(true);
  });

  it("rejects missing participation, expertise, goals, timezone or availability", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(member({ participation: null }))).toBe(false);
    expect(isProfileComplete(member({ expertise: [] }))).toBe(false);
    expect(isProfileComplete(member({ goals: [] }))).toBe(false);
    expect(isProfileComplete(member({ timezone: "" }))).toBe(false);
    expect(isProfileComplete(member({ availability: [] }))).toBe(false);
  });
});

describe("match next step", () => {
  it("explains that pending matches await a coordinator", () => {
    expect(matchNextStep(match())).toMatch(/coordinator/i);
  });

  it("shows the scheduled meeting when one is recorded", () => {
    expect(matchNextStep(match({ status: "active", nextMeeting: "2026-11-25T15:00:00-07:00" }))).toMatch(
      /next meeting/i,
    );
  });

  it("asks for a meeting date on an active match with nothing scheduled", () => {
    expect(matchNextStep(match({ status: "active" }))).toMatch(/add a meeting date/i);
  });

  it("labels paused, completed and declined matches plainly", () => {
    expect(matchNextStep(match({ status: "paused" }))).toMatch(/paused/i);
    expect(matchNextStep(match({ status: "completed" }))).toMatch(/completed/i);
    expect(matchNextStep(match({ status: "declined" }))).toMatch(/declined/i);
  });
});

describe("calendar safety", () => {
  it("only permits http(s) meeting links", () => {
    expect(safeHttpUrl(" https://meet.example.com/room ")).toBe("https://meet.example.com/room");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });

  it("escapes ICS text delimiters and line breaks", () => {
    expect(escapeIcsText("a,b;c\nd\\e")).toBe("a\\,b\\;c\\nd\\\\e");
  });

  it("emits UTC basic dates or nothing for invalid input", () => {
    expect(toIcsDate("2026-11-25T15:00:00-07:00")).toBe("20261125T220000Z");
    expect(toIcsDate("not-a-date")).toBeNull();
    expect(toIcsDate(null)).toBeNull();
  });

  it("declines to build an event without a valid meeting date", () => {
    expect(buildMatchIcs(match())).toBeNull();
  });

  it("escapes names and goals and omits unsafe meeting links", () => {
    const ics = buildMatchIcs(
      match({
        nextMeeting: "2026-11-25T15:00:00-07:00",
        meetingUrl: "javascript:alert(1)",
        mentorName: "Ada; Mentor, Sr",
        goal: "line1\nline2",
      }),
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261125T220000Z");
    expect(ics).toContain("SUMMARY:Mentorship session: Ada\\; Mentor\\, Sr & Bea Mentee");
    expect(ics).toContain("DESCRIPTION:Goal: line1\\nline2");
    expect(ics).not.toContain("URL:");
    expect(ics).not.toContain("line1\nline2");
  });
});

describe("safe feedback", () => {
  it("keeps a short application message and hides unknown object data", () => {
    expect(safeMessage(new Error("Please complete your profile."))).toBe("Please complete your profile.");
    expect(safeMessage({ token: "private" })).toBe("Something went wrong. Please try again.");
  });

  it("never reports a fabricated match percentage for overlap", () => {
    expect(overlapText(45)).toBe("45 min of overlapping availability");
    expect(overlapText(150)).toBe("2 h 30 min of overlapping availability");
    expect(overlapText(0)).toBe("No overlapping time reported");
    expect(overlapText(-5)).toBe("No overlapping time reported");
  });
});

describe("meeting date input", () => {
  it("round-trips a valid date through a local datetime input", () => {
    const local = toDateTimeLocal("2026-11-25T15:00:00Z");
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDateTimeLocal(local)).toBe("2026-11-25T15:00:00.000Z");
  });

  it("rejects empty and malformed input", () => {
    expect(toDateTimeLocal("")).toBe("");
    expect(toDateTimeLocal("bad-date")).toBe("");
    expect(fromDateTimeLocal("")).toBeNull();
    expect(fromDateTimeLocal("bad-date")).toBeNull();
  });
});

describe("admin capacity", () => {
  it("counts approved mentors, mentees, pending applications and mentor seats", () => {
    const summary = capacitySummary([
      member({ id: "a", participation: "mentor", capacity: 2 }),
      member({ id: "b", participation: "both", capacity: 3 }),
      member({ id: "c", participation: "mentee", capacity: 1 }),
      member({ id: "d", participation: "mentor", capacity: 5, status: "pending" }),
      member({ id: "e", participation: "mentor", capacity: 5, status: "paused" }),
    ]);
    expect(summary).toEqual({ mentorCount: 2, menteeCount: 2, pendingCount: 1, mentorSeats: 5 });
  });
});
