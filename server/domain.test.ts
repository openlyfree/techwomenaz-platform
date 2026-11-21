import { describe, it, expect } from "vitest";
import {
  isValidTimezone,
  isValidAvailabilitySlot,
  isValidAvailability,
  meetingFormatsCompatible,
  weeklyOverlapMinutes,
} from "./domain";
import type { AvailabilitySlot, MeetingFormat } from "../lib/contracts";

const slot = (day: number, start: string, end: string): AvailabilitySlot => ({ day, start, end });

describe("isValidTimezone", () => {
  it("accepts real IANA timezone names", () => {
    expect(isValidTimezone("America/Phoenix")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("rejects invalid, empty and non-string timezone values", () => {
    expect(isValidTimezone("Mars/Phobos")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone(undefined as unknown as string)).toBe(false);
    expect(isValidTimezone(42 as unknown as string)).toBe(false);
  });
});

describe("isValidAvailabilitySlot", () => {
  it("accepts well-formed slots including boundary values", () => {
    expect(isValidAvailabilitySlot(slot(0, "09:00", "17:00"))).toBe(true);
    expect(isValidAvailabilitySlot(slot(6, "00:00", "23:59"))).toBe(true);
  });

  it("rejects days outside 0..6 or non-integer days", () => {
    expect(isValidAvailabilitySlot(slot(-1, "09:00", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(7, "09:00", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1.5, "09:00", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot("1" as unknown as number, "09:00", "10:00"))).toBe(false);
  });

  it("rejects malformed HH:mm times", () => {
    expect(isValidAvailabilitySlot(slot(1, "9:00", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1, "09:00", "9:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1, "25:00", "26:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1, "09:60", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1, "9am", "10am"))).toBe(false);
  });

  it("rejects slots where start is not strictly before end", () => {
    expect(isValidAvailabilitySlot(slot(1, "10:00", "10:00"))).toBe(false);
    expect(isValidAvailabilitySlot(slot(1, "12:00", "09:00"))).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isValidAvailabilitySlot(null)).toBe(false);
    expect(isValidAvailabilitySlot("09:00-10:00")).toBe(false);
  });
});

describe("isValidAvailability", () => {
  it("accepts an array of valid slots and an empty array", () => {
    expect(isValidAvailability([slot(0, "09:00", "10:00")])).toBe(true);
    expect(isValidAvailability([])).toBe(true);
  });

  it("rejects non-arrays and arrays containing an invalid slot", () => {
    expect(isValidAvailability("nope" as unknown as AvailabilitySlot[])).toBe(false);
    expect(isValidAvailability([slot(0, "09:00", "10:00"), slot(9, "09:00", "10:00")])).toBe(false);
  });
});

describe("meetingFormatsCompatible", () => {
  it("matches identical concrete formats", () => {
    expect(meetingFormatsCompatible("online", "online")).toBe(true);
    expect(meetingFormatsCompatible("in-person", "in-person")).toBe(true);
  });

  it("treats 'either' as compatible in both directions", () => {
    expect(meetingFormatsCompatible("either", "online")).toBe(true);
    expect(meetingFormatsCompatible("online", "either")).toBe(true);
    expect(meetingFormatsCompatible("either", "in-person")).toBe(true);
    expect(meetingFormatsCompatible("in-person", "either")).toBe(true);
    expect(meetingFormatsCompatible("either", "either")).toBe(true);
  });

  it("rejects online vs in-person in both directions", () => {
    const pairs: [MeetingFormat, MeetingFormat][] = [
      ["online", "in-person"],
      ["in-person", "online"],
    ];
    for (const [a, b] of pairs) expect(meetingFormatsCompatible(a, b)).toBe(false);
  });
});

describe("weeklyOverlapMinutes", () => {
  it("returns 0 when there is no overlap in the same timezone", () => {
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "10:00")], "UTC", [slot(0, "11:00", "12:00")])).toBe(0);
  });

  it("counts full and partial same-timezone overlap", () => {
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "17:00")], "UTC", [slot(0, "09:00", "17:00")])).toBe(480);
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "12:00")], "UTC", [slot(0, "11:00", "14:00")])).toBe(60);
  });

  it("does not overlap slots on different days", () => {
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "17:00")], "UTC", [slot(1, "09:00", "17:00")])).toBe(0);
  });

  it("sums overlap across multiple slots and days", () => {
    const a = [slot(0, "09:00", "11:00"), slot(2, "13:00", "15:00")];
    const b = [slot(0, "10:00", "12:00"), slot(2, "14:00", "16:00")];
    expect(weeklyOverlapMinutes("UTC", a, "UTC", b)).toBe(120);
  });

  it("accounts for different timezones (Phoenix MST vs New York EST in January)", () => {
    // Reference week is in January: Phoenix is UTC-7 (no DST), New York is UTC-5.
    // Phoenix 09:00-11:00 == 16:00-18:00Z; New York 11:00-13:00 == 16:00-18:00Z.
    expect(
      weeklyOverlapMinutes(
        "America/Phoenix",
        [slot(0, "09:00", "11:00")],
        "America/New_York",
        [slot(0, "11:00", "13:00")],
      ),
    ).toBe(120);
  });

  it("handles half-hour offset timezones (Kolkata UTC+05:30)", () => {
    // Kolkata 09:00 == 03:30Z; UTC 03:30-04:30 overlaps 60 minutes.
    expect(
      weeklyOverlapMinutes("Asia/Kolkata", [slot(0, "09:00", "11:00")], "UTC", [slot(0, "03:30", "04:30")]),
    ).toBe(60);
  });

  it("returns 0 for different-timezone slots that do not overlap", () => {
    expect(
      weeklyOverlapMinutes("America/Phoenix", [slot(0, "09:00", "10:00")], "America/New_York", [slot(0, "20:00", "21:00")]),
    ).toBe(0);
  });

  it("throws on an invalid timezone", () => {
    expect(() => weeklyOverlapMinutes("Mars/Phobos", [slot(0, "09:00", "10:00")], "UTC", [])).toThrow();
  });

  it("throws on an invalid slot", () => {
    expect(() => weeklyOverlapMinutes("UTC", [slot(9, "09:00", "10:00")], "UTC", [])).toThrow();
  });

  it("does not count adjacent or touching slots as overlapping", () => {
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "10:00")], "UTC", [slot(0, "10:00", "11:00")])).toBe(0);
  });

  it("maps a morning slot in a UTC+ zone to the same reference weekday in UTC", () => {
    // Tokyo is UTC+9 in January: Sunday 09:00-10:00 local == Sunday 00:00-01:00Z.
    expect(weeklyOverlapMinutes("Asia/Tokyo", [slot(0, "09:00", "10:00")], "UTC", [slot(0, "00:00", "01:00")])).toBe(60);
  });

  it("maps a late evening slot in a UTC- zone to the next UTC day", () => {
    // Phoenix is UTC-7 year-round: Sunday 20:00-22:00 local == Monday 03:00-05:00Z.
    expect(weeklyOverlapMinutes("America/Phoenix", [slot(0, "20:00", "22:00")], "UTC", [slot(1, "03:00", "05:00")])).toBe(120);
  });

  it("handles half-hour offsets in either direction", () => {
    expect(weeklyOverlapMinutes("UTC", [slot(0, "03:30", "04:30")], "Asia/Kolkata", [slot(0, "09:00", "10:00")])).toBe(60);
  });

  it("counts a shared region once when one slot overlaps two disjoint slots", () => {
    const a = [slot(0, "09:00", "10:00"), slot(0, "11:00", "12:00")];
    const b = [slot(0, "09:30", "11:30")];
    expect(weeklyOverlapMinutes("UTC", a, "UTC", b)).toBe(60);
  });

  it("returns zero when either side has no availability", () => {
    expect(weeklyOverlapMinutes("UTC", [], "UTC", [slot(0, "09:00", "10:00")])).toBe(0);
    expect(weeklyOverlapMinutes("UTC", [slot(0, "09:00", "10:00")], "UTC", [])).toBe(0);
  });
});

describe("meeting format edge cases", () => {
  it("rejects unknown or missing formats instead of treating them as wildcards", () => {
    expect(meetingFormatsCompatible("ONLINE" as MeetingFormat, "online")).toBe(false);
    expect(meetingFormatsCompatible("online", "online " as MeetingFormat)).toBe(false);
    expect(meetingFormatsCompatible(undefined as unknown as MeetingFormat, "either")).toBe(false);
  });
});
