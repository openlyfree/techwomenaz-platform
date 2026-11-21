import { describe, expect, it } from "vitest";
import {
  actionLabel,
  formatMemberStatus,
  formatParticipation,
  formatRole,
  shortenForDisplay,
} from "./member-a11y";

describe("formatMemberStatus", () => {
  it("formats known approval statuses as readable text", () => {
    expect(formatMemberStatus("approved")).toBe("Approved");
    expect(formatMemberStatus("paused")).toBe("Paused");
    expect(formatMemberStatus("pending")).toBe("Pending");
  });

  it("uses a safe fallback for null, undefined and unknown statuses", () => {
    expect(formatMemberStatus(null)).toBe("Status not available");
    expect(formatMemberStatus(undefined)).toBe("Status not available");
    expect(formatMemberStatus("surprise")).toBe("Status not available");
    expect(formatMemberStatus("")).toBe("Status not available");
  });
});

describe("formatRole", () => {
  it("formats known staff roles as readable text", () => {
    expect(formatRole("member")).toBe("Member");
    expect(formatRole("coordinator")).toBe("Coordinator");
    expect(formatRole("editor")).toBe("Editor");
    expect(formatRole("admin")).toBe("Admin");
  });

  it("uses a safe fallback for missing or unknown roles", () => {
    expect(formatRole(null)).toBe("Role not available");
    expect(formatRole(undefined)).toBe("Role not available");
    expect(formatRole("superuser")).toBe("Role not available");
  });
});

describe("formatParticipation", () => {
  it("formats mentor, mentee and both as readable text", () => {
    expect(formatParticipation("mentor")).toBe("Mentor");
    expect(formatParticipation("mentee")).toBe("Mentee");
    expect(formatParticipation("both")).toBe("Mentor and mentee");
  });

  it("uses a safe fallback when participation is missing or unknown", () => {
    expect(formatParticipation(null)).toBe("Participation not set");
    expect(formatParticipation(undefined)).toBe("Participation not set");
    expect(formatParticipation("something-else")).toBe("Participation not set");
  });
});

describe("actionLabel", () => {
  it("always includes the member name and the action", () => {
    const approve = actionLabel("Ada Lovelace", "Approve");
    const pause = actionLabel("Ada Lovelace", "Pause");
    expect(approve).toContain("Ada Lovelace");
    expect(approve).toContain("Approve");
    expect(pause).toContain("Ada Lovelace");
    expect(pause).toContain("Pause");
  });

  it("uses a meaningful member fallback for empty names", () => {
    expect(actionLabel("", "Pause")).toBe("Pause this member");
    expect(actionLabel(undefined, "Approve")).toBe("Approve this member");
  });

  it("uses a meaningful action fallback for empty actions", () => {
    expect(actionLabel("Ada Lovelace", "")).toBe("Update status for Ada Lovelace");
    expect(actionLabel(null, null)).toBe("Update status for this member");
  });
});

describe("shortenForDisplay", () => {
  it("returns short values unchanged", () => {
    expect(shortenForDisplay("Ada Lovelace", 20)).toBe("Ada Lovelace");
  });

  it("never throws on missing values", () => {
    expect(shortenForDisplay(undefined, 12)).toBe("");
    expect(shortenForDisplay(null, 12)).toBe("");
  });

  it("keeps words intact when shortening", () => {
    expect(shortenForDisplay("Learning AI networking and mentoring", 14)).toBe("Learning AI…");
    expect(shortenForDisplay("Ada Lovelace", 5)).toBe("Ada…");
  });

  it("handles zero limits, negative limits and a single long word", () => {
    expect(shortenForDisplay("hello", 0)).toBe("");
    expect(shortenForDisplay("hello", -2)).toBe("");
    expect(shortenForDisplay("abcdefghij", 4)).toBe("abc…");
  });
});
