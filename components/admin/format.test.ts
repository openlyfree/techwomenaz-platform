import { describe, expect, it } from "vitest";
import { formatNumber, formatShortDate, formatDateTime, initials, trendPoints, safePercent, errorText } from "./format";

describe("staff dashboard formatting", () => {
  it("groups large counts with commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("uses an em dash for a missing date", () => {
    expect(formatShortDate("")).toBe("—");
  });

  it("formats an ISO date as short month and day in UTC", () => {
    expect(formatShortDate("2026-11-21T12:00:00Z")).toBe("Nov 21");
  });

  it("formats a timestamp for audit rows", () => {
    expect(formatDateTime("2026-11-21T12:00:00Z")).toMatch(/Nov 21, 2026/);
  });

  it("derives two-letter initials from a full name", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("returns a single initial for a one-word name", () => {
    expect(initials("Ada")).toBe("A");
  });

  it("builds an SVG polyline from a real trend", () => {
    expect(trendPoints([{ date: "2026-01-01", count: 0 }, { date: "2026-01-02", count: 5 }], 100, 20)).toBe("0,20 100,0");
  });

  it("keeps a flat trend at the top without dividing by zero", () => {
    expect(trendPoints([{ date: "a", count: 2 }, { date: "b", count: 2 }], 100, 20)).toBe("0,0 100,0");
  });

  it("returns an empty polyline for an empty trend", () => {
    expect(trendPoints([], 100, 20)).toBe("");
  });

  it("returns zero instead of NaN when a percent has no denominator", () => {
    expect(safePercent(3, 0)).toBe(0);
  });

  it("clamps a percent above one hundred", () => {
    expect(safePercent(15, 10)).toBe(100);
  });

  it("shows a safe error message", () => {
    expect(errorText(new Error("Please sign in to continue."))).toBe("Please sign in to continue.");
  });

  it("preserves the actionable string returned by useQuery", () => {
    expect(errorText("This service is unavailable. Please try again shortly.")).toBe("This service is unavailable. Please try again shortly.");
  });

  it("replaces an unknown error with generic safe text", () => {
    expect(errorText({ token: "private" })).toBe("Something went wrong. Please try again.");
  });
});
