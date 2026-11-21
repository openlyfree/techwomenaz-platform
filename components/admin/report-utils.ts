import type { Statistics } from "../../lib/contracts";

export interface StatCardData {
  key: string;
  label: string;
  value: number;
  hint: string;
}

/** A malformed or negative count is never shown as a real statistic. */
function safeCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** Every card maps to a field actually returned by admin.stats. No invented impact metrics. */
export function statCards(stats: Statistics): StatCardData[] {
  return [
    { key: "members", label: "Members", value: safeCount(stats.members), hint: "Profiles in the directory" },
    { key: "mentors", label: "Mentors", value: safeCount(stats.mentors), hint: "Ready to guide" },
    { key: "mentees", label: "Mentees", value: safeCount(stats.mentees), hint: "Seeking guidance" },
    { key: "pendingApplications", label: "Pending applications", value: safeCount(stats.pendingApplications), hint: "Awaiting review" },
    { key: "pendingMatches", label: "Pending matches", value: safeCount(stats.pendingMatches), hint: "Awaiting coordinator approval" },
    { key: "activeMatches", label: "Active matches", value: safeCount(stats.activeMatches), hint: "Currently paired" },
    { key: "recordedMeetings", label: "Recorded meetings", value: safeCount(stats.recordedMeetings), hint: "Logged by participants" },
    { key: "checkins", label: "Check-ins", value: safeCount(stats.checkins), hint: "Submitted reflections" },
  ];
}

export function meetingRate(stats: Statistics): number {
  const active = safeCount(stats.activeMatches);
  if (!active) return 0;
  return Math.max(0, Math.min(100, Math.round((safeCount(stats.recordedMeetings) / active) * 100)));
}

export function trendTotal(trend: { date: string; count: number }[]): number {
  return trend.reduce((sum, point) => sum + (Number.isFinite(point.count) ? point.count : 0), 0);
}
