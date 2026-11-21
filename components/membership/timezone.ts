import type { AvailabilitySlot } from "@/lib/contracts";
import { hasSlotOverlap } from "./form-helpers";

export interface TimezoneOption {
  value: string;
  label: string;
}

/** Arizona does not observe daylight saving; Phoenix is the default for this audience. */
export const DEFAULT_TIMEZONE = "America/Phoenix";

/** Canonical options. The UI may keep any other valid IANA zone the member already saved. */
export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "America/Phoenix", label: "America/Phoenix — MST year-round (no daylight saving)" },
  { value: "America/Denver", label: "America/Denver — Mountain Time (observes DST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles — Pacific Time" },
  { value: "America/Chicago", label: "America/Chicago — Central Time" },
  { value: "America/New_York", label: "America/New_York — Eastern Time" },
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "Europe/London", label: "Europe/London — UK Time" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata — India Standard Time" },
  { value: "Australia/Sydney", label: "Australia/Sydney — Australian Eastern Time" },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** A fresh list, with an unlisted current zone prepended so its selection is never lost. */
export function timezoneOptions(current?: string | null): TimezoneOption[] {
  const options = TIMEZONE_OPTIONS.map((option) => ({ ...option }));
  const value = typeof current === "string" ? current.trim() : "";
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: value }, ...options];
}

/** Human-readable slot label for chip lists and overlap warnings. */
export function formatSlotLabel(slot: AvailabilitySlot): string {
  if (!slot || typeof slot !== "object") return "Invalid slot";
  const day =
    Number.isInteger(slot.day) && slot.day >= 0 && slot.day <= 6
      ? WEEKDAYS[slot.day]
      : `Day ${slot.day == null ? "?" : String(slot.day)}`;
  const start = typeof slot.start === "string" ? slot.start.trim() : "";
  const end = typeof slot.end === "string" ? slot.end.trim() : "";
  if (!start || !end) return `${day} — time not set`;
  return `${day} ${start}–${end}`;
}

/** Shared same-day overlap check used by the editor warning and profiles. */
export function hasOverlap(slots: AvailabilitySlot[]): boolean {
  return hasSlotOverlap(slots);
}
