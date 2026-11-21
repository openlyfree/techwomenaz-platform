import { describe, expect, it } from "vitest";
import { exportFileName, hubspotCopyText, validateDraft } from "./mailing-utils";

const UNDATED = "techwomenaz-contacts.csv";

describe("newsletter draft utilities", () => {
  describe("validateDraft", () => {
    it("requires both a subject and a body", () => {
      expect(validateDraft("", "")).toContain("Add a subject line.");
      expect(validateDraft("", "")).toContain("Add email body copy.");
    });

    it("rejects whitespace-only subject and body", () => {
      const errors = validateDraft("   \t ", "  \n  ");
      expect(errors).toContain("Add a subject line.");
      expect(errors).toContain("Add email body copy.");
    });

    it("rejects whitespace-only subject when the body is valid", () => {
      expect(validateDraft("   ", "Hello members,")).toContain("Add a subject line.");
      expect(validateDraft("   ", "Hello members,")).not.toContain("Add email body copy.");
    });

    it("rejects whitespace-only body when the subject is valid", () => {
      expect(validateDraft("November update", "\n\t ")).toContain("Add email body copy.");
      expect(validateDraft("November update", "\n\t ")).not.toContain("Add a subject line.");
    });

    it("accepts a complete draft", () => {
      expect(validateDraft("November update", "Hello members,")).toEqual([]);
    });

    it("rejects an oversized subject", () => {
      expect(validateDraft("x".repeat(201), "Body")).toContain("Subject must be 200 characters or fewer.");
    });

    it("enforces the body length limit at its boundary", () => {
      expect(validateDraft("Subject", "x".repeat(20_001))).toContain("Body must be 20,000 characters or fewer.");
      expect(validateDraft("Subject", "x".repeat(20_000))).toEqual([]);
    });
  });

  describe("hubspotCopyText", () => {
    it("assembles exact plain copy for a manual HubSpot paste", () => {
      expect(hubspotCopyText("November update", "Hello members,")).toBe("Subject: November update\n\nHello members,");
    });

    it("returns plain text without HTML wrappers", () => {
      expect(hubspotCopyText("Hi", "Body")).not.toContain("<");
    });
  });

  describe("exportFileName", () => {
    it("builds a dated CSV filename for a valid ISO timestamp", () => {
      expect(exportFileName("2026-11-21T12:00:00Z")).toBe("techwomenaz-contacts-2026-11-21.csv");
    });

    it("accepts a date-only ISO value", () => {
      expect(exportFileName("2024-02-29")).toBe("techwomenaz-contacts-2024-02-29.csv");
    });

    it("uses an undated filename for a missing timestamp", () => {
      expect(exportFileName("")).toBe(UNDATED);
    });

    it("uses an undated filename for a non-ISO string", () => {
      expect(exportFileName("not-a-date")).toBe(UNDATED);
      expect(exportFileName("2026-11-21garbage")).toBe(UNDATED);
    });

    it("uses an undated filename for a non-string value", () => {
      expect(exportFileName(123 as unknown as string)).toBe(UNDATED);
    });

    it("uses an undated filename for a calendar-invalid date", () => {
      expect(exportFileName("2026-13-45T12:00:00Z")).toBe(UNDATED);
      expect(exportFileName("2026-02-30T12:00:00Z")).toBe(UNDATED);
      expect(exportFileName("2025-02-29T12:00:00Z")).toBe(UNDATED);
    });
  });
});
