import type { Checkin, EventRecord, Match, Member } from "../lib/contracts";
import type { CheckinRow, EventRow, MatchRow, MemberRow } from "./db/schema";
import { visiblePrivateNote } from "./matching";

export function toMember(row: MemberRow, includeEmail = false): Member {
  return {
    id: row.id,
    name: row.name,
    ...(includeEmail ? { email: row.email } : {}),
    role: row.role,
    participation: row.participation,
    status: row.status,
    headline: row.headline,
    bio: row.bio,
    expertise: row.expertise,
    goals: row.goals,
    timezone: row.timezone,
    availability: row.availability,
    meetingFormat: row.meetingFormat,
    location: row.location,
    capacity: row.capacity,
    discoverable: row.discoverable,
    aiConsent: row.aiConsent,
    newsletterConsent: ["subscribed", "unsubscribed"].includes(row.newsletterConsent)
      ? (row.newsletterConsent as "subscribed" | "unsubscribed")
      : "unknown",
    createdAt: row.createdAt.toISOString(),
    major: row.major,
    career: row.career,
    interests: row.interests,
    interestAnswer: row.interestAnswer,
  };
}

export function toMatch(row: MatchRow, mentorName: string, menteeName: string): Match {
  return {
    id: row.id,
    mentorId: row.mentorId,
    menteeId: row.menteeId,
    mentorName,
    menteeName,
    status: row.status,
    goal: row.goal,
    nextMeeting: row.nextMeeting?.toISOString() ?? null,
    meetingUrl: row.meetingUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCheckin(row: CheckinRow, viewerId: string): Checkin {
  return {
    id: row.id,
    matchId: row.matchId,
    met: row.met,
    useful: row.useful,
    continue: row.continue,
    privateNote: visiblePrivateNote(row.authorId, viewerId, row.privateNote),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    ...(row.endDate ? { endDate: row.endDate } : {}),
    description: row.description,
    location: row.location,
    registerUrl: row.registerUrl,
  };
}
