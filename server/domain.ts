import type { AvailabilitySlot, MeetingFormat } from "../lib/contracts";

/**
 * Pure domain helpers for availability, meeting-format compatibility and
 * weekly overlap. No database, router or framework dependencies.
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FORMATS: readonly MeetingFormat[] = ["online", "in-person", "either"];

/**
 * A single fixed reference week makes overlap deterministic. Sunday 2026-01-04
 * through Saturday 2026-01-10; no DST transition occurs in common zones that
 * week, and the sign-up data only stores day-of-week + wall-clock times.
 */
const REFERENCE_WEEK_SUNDAY = { year: 2026, month: 1, day: 4 };

function parseHhmm(value: string): number | null {
  const match = HHMM.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True only for a valid IANA timezone name understood by Intl. */
export function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== "string" || timezone.length === 0 || timezone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** True for a slot with day 0..6, HH:mm (24h) times, and start strictly before end. */
export function isValidAvailabilitySlot(value: unknown): value is AvailabilitySlot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const slot = value as Record<string, unknown>;
  if (!Number.isInteger(slot.day)) return false;
  const day = slot.day as number;
  if (day < 0 || day > 6) return false;
  if (typeof slot.start !== "string" || typeof slot.end !== "string") return false;
  const start = parseHhmm(slot.start);
  const end = parseHhmm(slot.end);
  return start !== null && end !== null && start < end;
}

/** True for an array (possibly empty) of valid availability slots. */
export function isValidAvailability(value: unknown): value is AvailabilitySlot[] {
  return Array.isArray(value) && value.every(isValidAvailabilitySlot);
}

/**
 * Whether two meeting-format preferences can meet. "either" is a wildcard;
 * "online" and "in-person" are otherwise incompatible.
 */
export function meetingFormatsCompatible(a: MeetingFormat, b: MeetingFormat): boolean {
  if (!FORMATS.includes(a) || !FORMATS.includes(b)) return false;
  if (a === "either" || b === "either") return true;
  return a === b;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

/** Offset (ms) between the wall clock in `timezone` and UTC at a given instant. */
function offsetAt(timezone: string, utcMs: number): number {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - utcMs;
}

/** Convert a local wall-clock time in `timezone` to a UTC instant on the reference week. */
function localToUtcMs(timezone: string, year: number, month: number, day: number, hour: number, minute: number): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = offsetAt(timezone, guess);
  const firstUtc = guess - firstOffset;
  const secondOffset = offsetAt(timezone, firstUtc);
  // One refinement handles the (rare) case where the guess lands across a DST step.
  return secondOffset === firstOffset ? firstUtc : guess - secondOffset;
}

function referenceDateForDay(day: number): { year: number; month: number; day: number } {
  const date = new Date(
    Date.UTC(REFERENCE_WEEK_SUNDAY.year, REFERENCE_WEEK_SUNDAY.month - 1, REFERENCE_WEEK_SUNDAY.day + day),
  );
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function intervalsInUtc(timezone: string, slots: AvailabilitySlot[]): [number, number][] {
  return slots.map((s) => {
    const date = referenceDateForDay(s.day);
    const startMinute = parseHhmm(s.start) as number;
    const endMinute = parseHhmm(s.end) as number;
    return [
      localToUtcMs(timezone, date.year, date.month, date.day, Math.floor(startMinute / 60), startMinute % 60),
      localToUtcMs(timezone, date.year, date.month, date.day, Math.floor(endMinute / 60), endMinute % 60),
    ];
  });
}

/**
 * Total overlapping minutes between two weekly availability schedules, with
 * each schedule interpreted in its own IANA timezone. Uses a deterministic
 * reference week so the result is reproducible. Returns 0 when there is no
 * overlap. Throws a RangeError for invalid timezones or slots.
 */
export function weeklyOverlapMinutes(
  aTimezone: string,
  aSlots: AvailabilitySlot[],
  bTimezone: string,
  bSlots: AvailabilitySlot[],
): number {
  if (!isValidTimezone(aTimezone) || !isValidTimezone(bTimezone)) {
    throw new RangeError("A valid IANA timezone is required for overlap calculation.");
  }
  if (!Array.isArray(aSlots) || !aSlots.every(isValidAvailabilitySlot) ||
      !Array.isArray(bSlots) || !bSlots.every(isValidAvailabilitySlot)) {
    throw new RangeError("Availability slots must have day 0..6, HH:mm times and start < end.");
  }

  const aIntervals = intervalsInUtc(aTimezone, aSlots);
  const bIntervals = intervalsInUtc(bTimezone, bSlots);
  let totalMs = 0;
  for (const [aStart, aEnd] of aIntervals) {
    for (const [bStart, bEnd] of bIntervals) {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      if (end > start) totalMs += end - start;
    }
  }
  return Math.round(totalMs / 60_000);
}
