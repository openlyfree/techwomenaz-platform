import type { EventRecord } from "../../lib/contracts";

export interface EventFormValues {
  title: string;
  date: string;
  description: string;
  location: string;
  registerUrl: string;
}

export const emptyEvent = (): EventFormValues => ({
  title: "",
  date: "",
  description: "",
  location: "",
  registerUrl: "",
});

export function validateEvent(input: EventFormValues): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Add an event title.");
  if (!input.date) errors.push("Choose an event date.");
  if (!input.description.trim()) errors.push("Add a short description.");
  if (!input.location.trim()) errors.push("Add a location or 'Online'.");
  if (input.registerUrl.trim() && !/^https?:\/\//i.test(input.registerUrl.trim())) {
    errors.push("Registration link must start with http:// or https://.");
  }
  return errors;
}

export function sortEvents(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatEventDate(date: string, endDate?: string): string {
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return "Date to be announced";
  if (!endDate) return fullDate.format(start);
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return fullDate.format(start);
  return `${monthDay.format(start)} – ${monthDay.format(end)}, ${end.getUTCFullYear()}`;
}
