import type {
  AvailabilitySlot,
  DiscoveryResult,
  Match,
  MeetingFormat,
  Member,
} from "@/lib/contracts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MEETING_LABELS: Record<MeetingFormat, string> = {
  online: "Online",
  "in-person": "In person",
  either: "Either online or in person",
};

export interface CapacitySummary {
  mentorCount: number;
  menteeCount: number;
  pendingCount: number;
  mentorSeats: number;
}

/** Present the member's own times; no timezone conversion is invented here. */
export function formatAvailability(slots: AvailabilitySlot[]): string[] {
  return slots.map((slot) => `${DAY_LABELS[slot.day] ?? "Day"} ${slot.start}–${slot.end}`);
}

export function describeMeeting(format: MeetingFormat, timezone: string): string {
  const label = MEETING_LABELS[format] ?? "Meeting format not set";
  const zone = timezone.trim();
  return zone ? `${label} · ${zone}` : label;
}

/** The server is authoritative; a second click can never submit twice. */
export function canSubmitDecision(pending: boolean, decided: boolean): boolean {
  return !pending && !decided;
}

/** Never claim that mutual interest activated or approved a match. */
export function decisionMessage(mutual: boolean): string {
  return mutual
    ? "Mutual interest recorded. Check My mentorships for the current status."
    : "Interest recorded. You'll see an update here if it becomes mutual.";
}

/** Horizontal gestures only; vertical scrolling stays with the browser. */
export function hasHorizontalSwipe(dx: number, dy: number, threshold = 72): boolean {
  const horizontal = Math.abs(dx);
  return horizontal >= threshold && horizontal >= Math.abs(dy) * 1.5;
}

/** Shows the server's own notice, or explains an honest manual fallback. */
export function sourceNotice(result: DiscoveryResult): string | null {
  if (result.notice) return result.notice;
  if (result.source === "manual") {
    return "Jev ranking is unavailable right now. These results use only your stated availability, goals and expertise.";
  }
  return null;
}

/** A member must have a usable profile before applying for mentorship. */
export function isProfileComplete(member: Member | null): boolean {
  if (!member) return false;
  return Boolean(
    member.participation &&
      member.headline.trim() &&
      member.expertise.length &&
      member.goals.length &&
      member.timezone.trim() &&
      member.availability.length &&
      member.meetingFormat,
  );
}

export function matchNextStep(match: Match): string {
  switch (match.status) {
    case "awaiting-coordinator":
      return "Awaiting coordinator review. No action needed until the coordinator responds.";
    case "active":
      return match.nextMeeting
        ? "Next meeting is scheduled. Use the meeting link on this page to join."
        : "Add a meeting date on this page, then share the meeting link with your partner.";
    case "paused":
      return "Paused. Contact your coordinator to discuss resuming.";
    case "completed":
      return "Completed. You can review the check-ins below.";
    case "declined":
      return "This match was declined and is closed.";
  }
}

/** Only http(s) meeting links may become a link or land in a calendar file. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

/** Escape ICS text values so member input cannot inject new lines or fields. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function toIcsDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Builds a minimal, safely escaped event. Returns null when no valid date exists. */
export function buildMatchIcs(match: Match): string | null {
  const startMs = Date.parse(match.nextMeeting ?? "");
  const start = toIcsDate(match.nextMeeting);
  if (!start || !Number.isFinite(startMs)) return null;
  const end = toIcsDate(new Date(startMs + 60 * 60 * 1000).toISOString());
  const stamp = toIcsDate(new Date().toISOString())!;
  const url = safeHttpUrl(match.meetingUrl);
  const title = escapeIcsText(`Mentorship session: ${match.mentorName} & ${match.menteeName}`);
  const description = escapeIcsText(match.goal ? `Goal: ${match.goal}` : "Mentorship session");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TechWomenAZ//Mentorship//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(match.id)}@techwomenaz.org`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end ?? start}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
  ];
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/** Short, actionable errors only; never stringify an unknown object. */
export function safeMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 300);
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 300);
  return fallback;
}

/** Reports only the minutes the server returned; no invented compatibility score. */
export function overlapText(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "No overlapping time reported";
  if (minutes < 60) return `${minutes} min of overlapping availability`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min of overlapping availability` : `${hours} h of overlapping availability`;
}

const pad = (part: number) => String(part).padStart(2, "0");

/** ISO string to the value shape used by <input type="datetime-local">. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local datetime input back to an ISO string the API can store. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function capacitySummary(members: Member[]): CapacitySummary {
  const approved = members.filter((item) => item.status === "approved");
  const isMentor = (item: Member) => item.participation === "mentor" || item.participation === "both";
  const isMentee = (item: Member) => item.participation === "mentee" || item.participation === "both";
  return {
    mentorCount: approved.filter(isMentor).length,
    menteeCount: approved.filter(isMentee).length,
    pendingCount: members.filter((item) => item.status === "pending").length,
    mentorSeats: approved
      .filter(isMentor)
      .reduce((total, item) => total + (Number.isFinite(item.capacity) ? Math.max(0, item.capacity) : 0), 0),
  };
}
