import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  formatSlotLabel,
  hasOverlap,
  timezoneOptions,
} from "./timezone";

describe("timezoneOptions", () => {
  it("puts America/Phoenix first with an MST note", () => {
    const options = timezoneOptions();
    expect(options[0].value).toBe(DEFAULT_TIMEZONE);
    expect(options[0].value).toBe("America/Phoenix");
    expect(options[0].label).toMatch(/MST/);
  });

  it("includes a canonical US set plus UTC", () => {
    const values = timezoneOptions().map((option) => option.value);
    expect(values).toContain("America/Denver");
    expect(values).toContain("America/Chicago");
    expect(values).toContain("America/New_York");
    expect(values).toContain("UTC");
  });

  it("prepends an unlisted current timezone without duplicating known ones", () => {
    expect(timezoneOptions("Asia/Tokyo")[0]).toEqual({
      value: "Asia/Tokyo",
      label: "Asia/Tokyo",
    });
    expect(timezoneOptions("America/Phoenix")).toEqual(timezoneOptions());
    expect(timezoneOptions("")).toEqual(timezoneOptions());
    expect(timezoneOptions(undefined)).toEqual(timezoneOptions());
  });

  it("does not mutate the canonical option list", () => {
    const before = TIMEZONE_OPTIONS.length;
    timezoneOptions("Asia/Tokyo");
    expect(TIMEZONE_OPTIONS).toHaveLength(before);
  });
});

describe("formatSlotLabel", () => {
  it("formats a slot with a readable day and an en-dash range", () => {
    expect(formatSlotLabel({ day: 0, start: "09:00", end: "10:00" })).toBe(
      "Sunday 09:00–10:00",
    );
    expect(formatSlotLabel({ day: 6, start: "13:30", end: "14:00" })).toBe(
      "Saturday 13:30–14:00",
    );
  });

  it("handles out-of-range days, unset times and a null slot", () => {
    expect(formatSlotLabel({ day: 7, start: "09:00", end: "10:00" })).toBe("Day 7 09:00–10:00");
    expect(formatSlotLabel({ day: 1, start: "", end: "" })).toBe("Monday — time not set");
    expect(formatSlotLabel(null as never)).toBe("Invalid slot");
  });
});

describe("hasOverlap", () => {
  it("flags same-day overlap only for valid, positive ranges", () => {
    expect(
      hasOverlap([
        { day: 3, start: "09:00", end: "10:30" },
        { day: 3, start: "10:00", end: "11:00" },
      ]),
    ).toBe(true);
    expect(
      hasOverlap([
        { day: 3, start: "09:00", end: "10:00" },
        { day: 3, start: "10:00", end: "11:00" },
      ]),
    ).toBe(false);
    expect(
      hasOverlap([
        { day: 3, start: "09:00", end: "10:00" },
        { day: 4, start: "09:30", end: "10:00" },
      ]),
    ).toBe(false);
    expect(
      hasOverlap([
        { day: 3, start: "bad", end: "10:00" },
        { day: 3, start: "09:30", end: "10:00" },
      ]),
    ).toBe(false);
    expect(hasOverlap([])).toBe(false);
  });
});
