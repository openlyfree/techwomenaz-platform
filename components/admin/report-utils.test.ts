import { describe, expect, it } from "vitest";
import { meetingRate, statCards, trendTotal } from "./report-utils";
import type { Statistics } from "../../lib/contracts";

const stats: Statistics = {
  members: 120,
  mentors: 30,
  mentees: 80,
  pendingApplications: 7,
  pendingMatches: 3,
  activeMatches: 12,
  recordedMeetings: 9,
  checkins: 6,
  signupTrend: [{ date: "2026-11-20", count: 2 }, { date: "2026-11-21", count: 5 }],
};

describe("report utilities", () => {
  it("derives statistic cards only from real queried values", () => {
    const cards = statCards(stats);
    expect(cards).toHaveLength(8);
    expect(cards.find((c) => c.key === "members")?.value).toBe(120);
    expect(cards.find((c) => c.key === "activeMatches")?.value).toBe(12);
    expect(cards.find((c) => c.key === "recordedMeetings")?.value).toBe(9);
  });

  it("maps every one of the eight queried statistics", () => {
    const byKey = Object.fromEntries(statCards(stats).map((card) => [card.key, card.value]));
    expect(byKey).toEqual({
      members: 120,
      mentors: 30,
      mentees: 80,
      pendingApplications: 7,
      pendingMatches: 3,
      activeMatches: 12,
      recordedMeetings: 9,
      checkins: 6,
    });
  });

  it("never invents an impact number", () => {
    for (const card of statCards(stats)) {
      expect(typeof card.value).toBe("number");
      expect(Number.isFinite(card.value)).toBe(true);
      expect(card.hint).not.toMatch(/lives changed|impact|served/i);
    }
  });

  it("coerces a malformed database value to zero instead of showing NaN", () => {
    const cards = statCards({ ...stats, members: Number.NaN, checkins: undefined as unknown as number });
    expect(cards.find((c) => c.key === "members")?.value).toBe(0);
    expect(cards.find((c) => c.key === "checkins")?.value).toBe(0);
    expect(cards).toHaveLength(8);
  });

  it("calculates a meeting rate from recorded data", () => {
    expect(meetingRate(stats)).toBe(75);
  });

  it("returns zero meeting rate with no active matches", () => {
    expect(meetingRate({ ...stats, activeMatches: 0 })).toBe(0);
  });

  it("clamps a negative meeting count to zero", () => {
    expect(meetingRate({ ...stats, recordedMeetings: -4 })).toBe(0);
  });

  it("survives malformed inputs without producing NaN", () => {
    expect(meetingRate({ ...stats, recordedMeetings: Number.NaN })).toBe(0);
    expect(meetingRate({ ...stats, activeMatches: Number.NaN })).toBe(0);
  });

  it("sums a signup trend", () => {
    expect(trendTotal(stats.signupTrend)).toBe(7);
  });

  it("sums an empty trend to zero", () => {
    expect(trendTotal([])).toBe(0);
  });

  it("ignores malformed trend counts", () => {
    expect(trendTotal([{ date: "a", count: Number.NaN }, { date: "b", count: 3 }])).toBe(3);
  });
});
