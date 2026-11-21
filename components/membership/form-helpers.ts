import type {
  AvailabilitySlot,
  JoinInput,
  MeetingFormat,
  ParticipationRole,
  ProfileInput,
} from "@/lib/contracts";

export type FieldErrors = Record<string, string>;

/** Weekly availability is bounded so a profile stays reviewable and matchable. */
export const MAX_AVAILABILITY_SLOTS = 8;

/** Minutes since midnight for a strict HH:mm clock value, or null if invalid. */
export function parseClock(value: string): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isValidSlot(slot: AvailabilitySlot): boolean {
  if (!slot || !Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6) return false;
  const start = parseClock(slot.start);
  const end = parseClock(slot.end);
  return start !== null && end !== null && start < end;
}

/** Two valid slots overlap only when they share a positive number of minutes on the same day. */
function rangesOverlap(a: AvailabilitySlot, b: AvailabilitySlot): boolean {
  if (a.day !== b.day) return false;
  const aStart = parseClock(a.start);
  const aEnd = parseClock(a.end);
  const bStart = parseClock(b.start);
  const bEnd = parseClock(b.end);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** True when any two valid slots collide; invalid slots are ignored. */
export function hasSlotOverlap(slots: AvailabilitySlot[]): boolean {
  if (!Array.isArray(slots)) return false;
  const valid = slots.filter(isValidSlot);
  for (let i = 0; i < valid.length; i += 1) {
    for (let j = i + 1; j < valid.length; j += 1) {
      if (rangesOverlap(valid[i], valid[j])) return true;
    }
  }
  return false;
}

/**
 * Remove invalid/duplicate/overlapping slots and sort by day then start.
 * When two valid slots on the same day collide, the longer one wins.
 * Results are capped at MAX_AVAILABILITY_SLOTS.
 */
export function normalizeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  if (!Array.isArray(slots)) return [];
  const seen = new Set<string>();
  const sorted = slots
    .filter((slot) => isValidSlot(slot))
    .filter((slot) => {
      const key = `${slot.day}|${slot.start}|${slot.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      const startDiff = (parseClock(a.start) ?? 0) - (parseClock(b.start) ?? 0);
      // Longer slot first when a day has entries starting at the same time.
      if (startDiff !== 0) return startDiff;
      return (parseClock(b.end) ?? 0) - (parseClock(a.end) ?? 0);
    });

  const kept: AvailabilitySlot[] = [];
  for (const slot of sorted) {
    const previous = kept[kept.length - 1];
    if (previous && previous.day === slot.day && rangesOverlap(previous, slot)) continue;
    kept.push(slot);
    if (kept.length === MAX_AVAILABILITY_SLOTS) break;
  }
  return kept;
}

/** Only short application-style messages are shown; objects never reach the UI. */
export function safeError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.length > 0 && error.length < 300) return error;
  if (error instanceof Error && error.message.length > 0 && error.message.length < 300) {
    return error.message;
  }
  return fallback;
}

export function defaultJoinInput(): JoinInput {
  return {
    name: "",
    email: "",
    experience: [],
    interests: [],
    major: "",
    career: "",
    interestAnswer: "",
    newsletterConsent: false,
  };
}

export function validateJoin(input: JoinInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Enter your name so we can address you correctly.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((input.email ?? "").trim())) {
    errors.email = "Enter a valid email address so we can send your sign-in link.";
  }
  if (!Array.isArray(input.experience) || input.experience.length === 0) {
    errors.experience = "Choose at least one area of experience, or select Other.";
  }
  const hasInterest =
    (Array.isArray(input.interests) && input.interests.length > 0) ||
    (input.interestAnswer ?? "").trim().length > 0;
  if (!hasInterest) {
    errors.interests = "Choose an interest or tell us in your own words what you hope to gain.";
  }
  return errors;
}

const ROLES: ParticipationRole[] = ["mentor", "mentee", "both"];
const FORMATS: MeetingFormat[] = ["online", "in-person", "either"];

export function validateProfile(input: ProfileInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name || input.name.trim().length < 2) errors.name = "Enter your name.";
  if (!ROLES.includes(input.participation)) errors.participation = "Choose mentor, mentee, or both.";
  if (!input.timezone || input.timezone.trim().length === 0) {
    errors.timezone = "Choose your timezone so matches can find a time that works.";
  }
  if (!Array.isArray(input.availability) || input.availability.length === 0) {
    errors.availability = "Add at least one weekly availability slot with a start and end time.";
  } else if (input.availability.length > MAX_AVAILABILITY_SLOTS) {
    errors.availability = `Keep at most ${MAX_AVAILABILITY_SLOTS} availability slots. Remove a slot and try again.`;
  } else if (input.availability.some((slot) => !isValidSlot(slot))) {
    errors.availability = "Each slot needs a day and a start time before the end time (HH:mm).";
  } else if (hasSlotOverlap(input.availability)) {
    errors.availability = "Availability slots on the same day cannot overlap.";
  }
  if (!FORMATS.includes(input.meetingFormat)) errors.meetingFormat = "Choose online, in-person, or either.";
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    errors.capacity = "Capacity must be at least 1.";
  }
  return errors;
}

/** Suggestions are editable: add canonical labels once, never replacing member choices. */
export function mergeInterestSuggestions(current: string[], suggested: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of [...(current ?? []), ...(suggested ?? [])]) {
    const label = String(value ?? "").trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}
