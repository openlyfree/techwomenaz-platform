export type StaffRole = "member" | "coordinator" | "editor" | "admin";
export type ParticipationRole = "mentor" | "mentee" | "both";
export type MeetingFormat = "online" | "in-person" | "either";
export interface AvailabilitySlot { day: number; start: string; end: string }
export interface Member {
  id: string; name: string; email?: string; role: StaffRole;
  participation: ParticipationRole | null; status: "pending" | "approved" | "paused";
  headline: string; bio: string; expertise: string[]; goals: string[];
  timezone: string; availability: AvailabilitySlot[]; meetingFormat: MeetingFormat;
  location: string; capacity: number; discoverable: boolean; aiConsent: boolean;
  newsletterConsent: "unknown" | "subscribed" | "unsubscribed"; createdAt: string;
  major: string; career: string; interests: string[]; interestAnswer: string;
}
export interface SessionUser { id: string; name: string; email: string; role: StaffRole }
export interface JoinInput { name: string; email: string; experience: string[]; interests: string[]; major?: string; career?: string; interestAnswer?: string; newsletterConsent: boolean; turnstileToken?: string }
export interface ProfileInput {
  name: string; participation: ParticipationRole; headline: string; bio: string;
  expertise: string[]; goals: string[]; timezone: string; availability: AvailabilitySlot[];
  meetingFormat: MeetingFormat; location: string; capacity: number; discoverable: boolean; aiConsent: boolean;
  major: string; career: string; interests: string[]; interestAnswer: string;
}
export interface DiscoveryCard {
  id: string; name: string; headline: string; bio: string; expertise: string[]; goals: string[];
  timezone: string; availability: AvailabilitySlot[]; meetingFormat: MeetingFormat; location: string;
  reasons: string[]; overlapMinutes: number; source: "jev" | "manual"; confidence: number | null;
}
export interface DiscoveryResult { cards: DiscoveryCard[]; source: "jev" | "manual"; notice: string | null }
export interface Match {
  id: string; mentorId: string; menteeId: string; mentorName: string; menteeName: string;
  status: "awaiting-coordinator" | "active" | "paused" | "completed" | "declined";
  goal: string; nextMeeting: string | null; meetingUrl: string; createdAt: string;
}
export interface SiteSection { id: string; type: "hero" | "mission" | "programs" | "mentorship" | "events" | "team" | "partners" | "contact"; title: string; body: string; enabled: boolean }
export interface SiteDocument { version: number; theme: "desert" | "navy"; sections: SiteSection[] }
export interface ContentState { draft: SiteDocument; published: SiteDocument; revisions: { id: string; version: number; createdAt: string; name: string }[] }
export interface EventRecord { id: string; title: string; date: string; endDate?: string; description: string; location: string; registerUrl: string }
export interface TeamRecord { id: string; name: string; role: string; photo: string }
export interface PartnerRecord { id: string; name: string; logo: string; url: string }
export interface PublicSite { document: SiteDocument; events: EventRecord[]; team: TeamRecord[]; partners: PartnerRecord[]; demo: boolean }
export interface Statistics { members: number; mentors: number; mentees: number; pendingApplications: number; pendingMatches: number; activeMatches: number; recordedMeetings: number; checkins: number; signupTrend: { date: string; count: number }[] }
export interface ImportPreview { rows: { index: number; name: string; email: string; status: "new" | "duplicate" | "invalid"; message: string }[]; newCount: number; duplicateCount: number; invalidCount: number; token: string }
export interface NewsletterDraft { id: string; subject: string; body: string; updatedAt: string }
export interface Checkin { id: string; matchId: string; met: boolean; useful: boolean; continue: boolean; privateNote: string; createdAt: string }
export const EXPERIENCE_AREAS = ["Developer / Engineer", "IT", "Security", "Product Management", "Project Management", "Executive", "Sales", "Marketing", "Legal", "Education", "Finance", "Other"];
export const INTEREST_AREAS = ["Finding a mentor", "Networking", "Learning AI", "Leadership", "Career development", "Volunteering", "Technical skills"];
