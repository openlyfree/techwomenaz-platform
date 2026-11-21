import { describe, expect, it } from "vitest";
import { emptyEvent, formatEventDate, sortEvents, validateEvent } from "./events-utils";
import type { EventRecord } from "../../lib/contracts";

const event = (id: string, date: string): EventRecord => ({
  id,
  date,
  title: `Event ${id}`,
  description: "Description",
  location: "Phoenix, AZ",
  registerUrl: "",
});

describe("event administration utilities", () => {
  it("requires a title, date, description and location", () => {
    const errors = validateEvent({ title: "", date: "", description: "", location: "", registerUrl: "" });
    expect(errors).toContain("Add an event title.");
    expect(errors).toContain("Choose an event date.");
    expect(errors).toContain("Add a short description.");
    expect(errors).toContain("Add a location or 'Online'.");
  });

  it("rejects a non-http registration link", () => {
    const errors = validateEvent({ title: "Meetup", date: "2026-12-01", description: "Desc", location: "Online", registerUrl: "javascript:alert(1)" });
    expect(errors).toContain("Registration link must start with http:// or https://.");
  });

  it("accepts a valid event with no registration link", () => {
    expect(validateEvent({ title: "Meetup", date: "2026-12-01", description: "Desc", location: "Online", registerUrl: "" })).toEqual([]);
  });

  it("sorts events by date ascending without mutating", () => {
    const original = [event("b", "2026-12-20"), event("a", "2026-12-01")];
    expect(sortEvents(original).map((e) => e.id)).toEqual(["a", "b"]);
    expect(original.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("formats a single date and a date range", () => {
    expect(formatEventDate("2026-12-01", "")).toBe("Dec 1, 2026");
    expect(formatEventDate("2026-12-01", "2026-12-02")).toBe("Dec 1 – Dec 2, 2026");
  });

  it("starts a new event form with safe blank values", () => {
    expect(emptyEvent()).toEqual({ title: "", date: "", description: "", location: "", registerUrl: "" });
  });
});
