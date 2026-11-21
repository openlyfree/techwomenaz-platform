import { describe, expect, it } from "vitest";
import type { JoinInput, ProfileInput } from "@/lib/contracts";
import {
  defaultJoinInput,
  hasSlotOverlap,
  isValidSlot,
  MAX_AVAILABILITY_SLOTS,
  mergeInterestSuggestions,
  normalizeSlots,
  parseClock,
  safeError,
  validateJoin,
  validateProfile,
} from "./form-helpers";

const profile = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
  name: "Ada",
  participation: "mentor",
  headline: "Engineer",
  bio: "I build things",
  expertise: ["Engineering"],
  goals: ["Help others"],
  timezone: "America/Phoenix",
  availability: [{ day: 0, start: "09:00", end: "10:00" }],
  meetingFormat: "online",
  location: "Phoenix",
  capacity: 2,
  discoverable: true,
  aiConsent: false,
  major: "",
  career: "Engineering",
  interests: ["Learning AI"],
  interestAnswer: "",
  ...overrides,
});

describe("parseClock", () => {
  it("converts a valid HH:mm time into minutes since midnight", () => {
    expect(parseClock("09:30")).toBe(570);
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock("23:59")).toBe(1439);
  });

  it("rejects malformed or out-of-range times", () => {
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("12:60")).toBeNull();
    expect(parseClock("9")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  it("requires strict two-digit HH:mm with no padding, whitespace or seconds", () => {
    expect(parseClock("09:05")).toBe(545);
    expect(parseClock("9:05")).toBeNull();
    expect(parseClock("09:5")).toBeNull();
    expect(parseClock(" 09:05")).toBeNull();
    expect(parseClock("09:05 ")).toBeNull();
    expect(parseClock("09:05:00")).toBeNull();
    expect(parseClock("ab:cd")).toBeNull();
    expect(parseClock(null as never)).toBeNull();
  });
});

describe("isValidSlot", () => {
  it("accepts Sunday 0 through Saturday 6 with an increasing time range", () => {
    expect(isValidSlot({ day: 0, start: "08:00", end: "09:00" })).toBe(true);
    expect(isValidSlot({ day: 6, start: "08:00", end: "09:00" })).toBe(true);
  });

  it("rejects invalid days, bad times and non-positive ranges", () => {
    expect(isValidSlot({ day: 7, start: "08:00", end: "09:00" })).toBe(false);
    expect(isValidSlot({ day: -1, start: "08:00", end: "09:00" })).toBe(false);
    expect(isValidSlot({ day: 1.5, start: "08:00", end: "09:00" })).toBe(false);
    expect(isValidSlot({ day: 1, start: "09:00", end: "09:00" })).toBe(false);
    expect(isValidSlot({ day: 1, start: "10:00", end: "09:00" })).toBe(false);
    expect(isValidSlot({ day: 1, start: "bad", end: "09:00" })).toBe(false);
  });

  it("rejects missing slots, non-numeric days and loosely formatted times", () => {
    expect(isValidSlot(null as never)).toBe(false);
    expect(isValidSlot(undefined as never)).toBe(false);
    expect(isValidSlot({ day: "1" as never, start: "09:00", end: "10:00" })).toBe(false);
    expect(isValidSlot({ day: NaN, start: "09:00", end: "10:00" })).toBe(false);
    expect(isValidSlot({ day: 1, start: "9:00", end: "10:00" })).toBe(false);
    expect(isValidSlot({ day: 1, start: "09:00", end: "24:00" })).toBe(false);
  });
});

describe("normalizeSlots", () => {
  it("drops invalid slots, removes duplicates and sorts by day then start", () => {
    const result = normalizeSlots([
      { day: 2, start: "13:00", end: "14:00" },
      { day: 0, start: "10:00", end: "11:00" },
      { day: 7, start: "08:00", end: "09:00" },
      { day: 0, start: "10:00", end: "11:00" },
      { day: 0, start: "08:00", end: "09:00" },
    ]);
    expect(result).toEqual([
      { day: 0, start: "08:00", end: "09:00" },
      { day: 0, start: "10:00", end: "11:00" },
      { day: 2, start: "13:00", end: "14:00" },
    ]);
  });

  it("keeps the longer slot when two slots on the same day overlap", () => {
    expect(
      normalizeSlots([
        { day: 1, start: "09:30", end: "10:00" },
        { day: 1, start: "09:00", end: "11:00" },
        { day: 1, start: "11:00", end: "12:00" },
      ]),
    ).toEqual([
      { day: 1, start: "09:00", end: "11:00" },
      { day: 1, start: "11:00", end: "12:00" },
    ]);
  });

  it("keeps overlapping ranges on different days and back-to-back slots", () => {
    expect(
      normalizeSlots([
        { day: 0, start: "09:00", end: "11:00" },
        { day: 1, start: "09:30", end: "10:00" },
      ]),
    ).toEqual([
      { day: 0, start: "09:00", end: "11:00" },
      { day: 1, start: "09:30", end: "10:00" },
    ]);
  });

  it(`caps output at MAX_AVAILABILITY_SLOTS (${MAX_AVAILABILITY_SLOTS})`, () => {
    expect(MAX_AVAILABILITY_SLOTS).toBeGreaterThan(0);
    expect(MAX_AVAILABILITY_SLOTS).toBeLessThanOrEqual(20);
    const many = Array.from({ length: MAX_AVAILABILITY_SLOTS + 3 }, (_, index) => {
      const hour = 8 + Math.floor(index / 7) * 2;
      const pad = (value: number) => String(value).padStart(2, "0");
      return { day: index % 7, start: `${pad(hour)}:00`, end: `${pad(hour + 1)}:00` };
    });
    const expected = [...many]
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
      .slice(0, MAX_AVAILABILITY_SLOTS);
    expect(normalizeSlots(many)).toEqual(expected);
    expect(normalizeSlots(many)).toHaveLength(MAX_AVAILABILITY_SLOTS);
  });
});

describe("hasSlotOverlap", () => {
  it("detects same-day overlap but not back-to-back or different-day ranges", () => {
    expect(
      hasSlotOverlap([
        { day: 1, start: "09:00", end: "10:30" },
        { day: 1, start: "10:00", end: "11:00" },
      ]),
    ).toBe(true);
    expect(
      hasSlotOverlap([
        { day: 1, start: "09:00", end: "10:00" },
        { day: 1, start: "10:00", end: "11:00" },
      ]),
    ).toBe(false);
    expect(
      hasSlotOverlap([
        { day: 1, start: "09:00", end: "10:00" },
        { day: 2, start: "09:30", end: "10:00" },
      ]),
    ).toBe(false);
    expect(
      hasSlotOverlap([
        { day: 1, start: "bad", end: "10:00" },
        { day: 1, start: "09:30", end: "10:00" },
      ]),
    ).toBe(false);
    expect(hasSlotOverlap([])).toBe(false);
  });
});

describe("validateJoin", () => {
  it("defaults the newsletter opt-in to false and requires name, email and a path", () => {
    expect(defaultJoinInput().newsletterConsent).toBe(false);
    const errors = validateJoin(defaultJoinInput());
    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.interests).toBeTruthy();
  });

  it("accepts at least one experience area plus a free-text interest answer", () => {
    const input: JoinInput = {
      ...defaultJoinInput(),
      name: "Ada",
      email: "ada@example.com",
      experience: ["Developer / Engineer"],
      interests: [],
      interestAnswer: "I want to learn AI and meet mentors",
    };
    expect(validateJoin(input)).toEqual({});
  });

  it("rejects an invalid email and an empty name", () => {
    const errors = validateJoin({
      ...defaultJoinInput(),
      name: "   ",
      email: "not-an-email",
      experience: ["Other"],
      interests: ["Networking"],
    });
    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });
});

describe("validateProfile", () => {
  it("accepts a complete profile", () => {
    expect(validateProfile(profile())).toEqual({});
  });

  it("requires a valid recurring availability slot, a role and a positive capacity", () => {
    const errors = validateProfile(
      profile({ availability: [], participation: null as never, capacity: 0, timezone: "" }),
    );
    expect(errors.availability).toBeTruthy();
    expect(errors.participation).toBeTruthy();
    expect(errors.capacity).toBeTruthy();
    expect(errors.timezone).toBeTruthy();
  });

  it("rejects invalid availability instead of silently discarding it", () => {
    const errors = validateProfile(
      profile({
        availability: [
          { day: 0, start: "09:00", end: "10:00" },
          { day: 7, start: "09:00", end: "10:00" },
          { day: 1, start: "11:00", end: "10:00" },
          { day: 2, start: "bad", end: "10:00" },
        ],
      }),
    );
    expect(errors.availability).toBeTruthy();
  });

  it("rejects overlapping availability", () => {
    const errors = validateProfile(
      profile({
        availability: [
          { day: 0, start: "09:00", end: "11:00" },
          { day: 0, start: "10:00", end: "12:00" },
        ],
      }),
    );
    expect(errors.availability).toBeTruthy();
  });

  it("rejects more than the bounded maximum number of slots", () => {
    const many = Array.from({ length: MAX_AVAILABILITY_SLOTS + 1 }, (_, index) => ({
      day: index % 7,
      start: `${8 + index}:00`,
      end: `${9 + index}:00`,
    }));
    expect(validateProfile(profile({ availability: many })).availability).toBeTruthy();
  });
});

describe("mergeInterestSuggestions", () => {
  it("adds suggestions without duplicating existing choices (case-insensitive)", () => {
    expect(mergeInterestSuggestions(["Learning AI"], ["learning ai", "Networking"])).toEqual([
      "Learning AI",
      "Networking",
    ]);
  });

  it("leaves member choices untouched when there are no suggestions", () => {
    expect(mergeInterestSuggestions(["Networking"], [])).toEqual(["Networking"]);
  });
});

describe("safeError", () => {
  it("keeps a short application message and hides unknown object data", () => {
    expect(safeError(new Error("Email sending is not configured."), "fallback")).toBe(
      "Email sending is not configured.",
    );
    expect(safeError({ token: "private" }, "fallback")).toBe("fallback");
  });
});
