import { describe, expect, it } from "vitest";
import type { ImportPreview, Member, StaffRole } from "@/lib/contracts";
import {
  canShowEmail,
  classifyImportError,
  filterImportRows,
  filterMembers,
  safeErrorText,
  summarizePreview,
  validateCsvFile,
} from "./admin-helpers";

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "m-1",
    name: "Ada Lovelace",
    email: "ada@example.org",
    role: "member",
    participation: "mentor",
    status: "approved",
    headline: "Engineer",
    bio: "",
    expertise: [],
    goals: [],
    timezone: "UTC",
    availability: [],
    meetingFormat: "online",
    location: "Phoenix",
    capacity: 3,
    discoverable: true,
    aiConsent: false,
    newsletterConsent: "unknown",
    createdAt: "2026-11-01T00:00:00Z",
    major: "Computer Science",
    career: "Developer / Engineer",
    interests: ["Learning AI"],
    interestAnswer: "I want to learn about machine learning.",
    ...overrides,
  };
}

describe("filterMembers", () => {
  it("matches a name case-insensitively", () => {
    const members = [makeMember(), makeMember({ id: "m-2", name: "Grace Hopper" })];
    expect(filterMembers(members, "ADA")).toHaveLength(1);
    expect(filterMembers(members, "ADA")[0].id).toBe("m-1");
  });

  it("matches the career field", () => {
    expect(filterMembers([makeMember()], "developer")).toHaveLength(1);
  });

  it("matches the major field", () => {
    expect(filterMembers([makeMember()], "computer science")).toHaveLength(1);
  });

  it("matches an entry in the interests array", () => {
    expect(filterMembers([makeMember()], "learning ai")).toHaveLength(1);
  });

  it("matches the free-text interest answer", () => {
    expect(filterMembers([makeMember()], "machine learning")).toHaveLength(1);
  });

  it("returns every member for an empty or whitespace-only query", () => {
    const members = [makeMember(), makeMember({ id: "m-2" })];
    expect(filterMembers(members, "")).toHaveLength(2);
    expect(filterMembers(members, "   ")).toHaveLength(2);
  });

  it("returns no members when nothing matches", () => {
    expect(filterMembers([makeMember()], "no such person")).toHaveLength(0);
  });

  it("trims the query before filtering", () => {
    expect(filterMembers([makeMember()], "  ada  ")).toHaveLength(1);
  });
});

describe("validateCsvFile", () => {
  it("accepts a small CSV file", () => {
    expect(validateCsvFile({ name: "members.csv", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts a file at exactly the 2 MB boundary", () => {
    expect(validateCsvFile({ name: "members.csv", size: 2 * 1024 * 1024 })).toEqual({ ok: true });
  });

  it("rejects a file one byte over the 2 MB limit with an actionable message", () => {
    const result = validateCsvFile({ name: "members.csv", size: 2 * 1024 * 1024 + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("2 MB");
      expect(result.message).toContain("smaller");
      expect(result.message).toContain("members.csv");
    }
  });

  it("rejects a non-CSV extension with an actionable message", () => {
    const result = validateCsvFile({ name: "members.exe", size: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(".csv");
  });

  it("accepts a plain text file name", () => {
    expect(validateCsvFile({ name: "members.txt", size: 10 })).toEqual({ ok: true });
  });

  it("rejects an empty (0-byte) file with an actionable message", () => {
    const result = validateCsvFile({ name: "members.csv", size: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.toLowerCase()).toContain("empty");
      expect(result.message).toContain("members.csv");
    }
  });
});

describe("summarizePreview", () => {
  function makePreview(rows: ImportPreview["rows"]): ImportPreview {
    return { rows, newCount: 0, duplicateCount: 0, invalidCount: 0, token: "secret-token" };
  }

  it("counts new, duplicate and invalid rows from the row data", () => {
    const summary = summarizePreview(
      makePreview([
        { index: 1, name: "A", email: "a@x.org", status: "new", message: "" },
        { index: 2, name: "B", email: "b@x.org", status: "duplicate", message: "Already exists" },
        { index: 3, name: "C", email: "c@x.org", status: "invalid", message: "Bad email" },
        { index: 4, name: "D", email: "d@x.org", status: "new", message: "" },
      ]),
    );
    expect(summary).toMatchObject({ newCount: 2, duplicateCount: 1, invalidCount: 1, total: 4 });
  });

  it("builds a human-readable summary that never includes the token", () => {
    const summary = summarizePreview(
      makePreview([{ index: 1, name: "A", email: "a@x.org", status: "new", message: "" }]),
    );
    expect(summary.summary).toContain("1 new");
    expect(summary.summary).not.toContain("secret-token");
  });

  it("handles an empty preview without dividing by zero", () => {
    expect(summarizePreview(makePreview([]))).toMatchObject({
      newCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      total: 0,
    });
  });

  it("never serializes the token in any part of the summary", () => {
    const summary = summarizePreview(
      makePreview([{ index: 1, name: "A", email: "a@x.org", status: "new", message: "" }]),
    );
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });
});

describe("filterImportRows", () => {
  function makeRow(status: ImportPreview["rows"][number]["status"], index = 1): ImportPreview["rows"][number] {
    return { index, name: `Row ${index}`, email: `row${index}@example.org`, status, message: "" };
  }

  const rows: ImportPreview["rows"] = [
    makeRow("new", 1),
    makeRow("duplicate", 2),
    makeRow("invalid", 3),
    makeRow("new", 4),
  ];

  it("returns every row for the all filter", () => {
    expect(filterImportRows(rows, "all")).toEqual(rows);
  });

  it("returns only new rows", () => {
    expect(filterImportRows(rows, "new").map((row) => row.index)).toEqual([1, 4]);
  });

  it("returns only duplicate rows", () => {
    expect(filterImportRows(rows, "duplicate").map((row) => row.index)).toEqual([2]);
  });

  it("returns only invalid rows", () => {
    expect(filterImportRows(rows, "invalid").map((row) => row.index)).toEqual([3]);
  });

  it("preserves the original row order", () => {
    expect(filterImportRows(rows, "new").map((row) => row.name)).toEqual(["Row 1", "Row 4"]);
  });

  it("returns an empty list when no rows match", () => {
    expect(filterImportRows([makeRow("new")], "duplicate")).toEqual([]);
  });

  it("handles a missing rows array without throwing", () => {
    expect(filterImportRows(undefined, "all")).toEqual([]);
  });
});

describe("classifyImportError", () => {
  it("gives re-review guidance for an expired or invalid token without echoing it", () => {
    const result = classifyImportError(new Error("token 9f8e7d expired"));
    expect(result.toLowerCase()).toContain("review");
    expect(result).not.toContain("9f8e7d");
  });

  it("gives sign-in guidance for authorization failures", () => {
    expect(classifyImportError(new Error("UNAUTHORIZED: staff role required")).toLowerCase()).toContain("sign in");
  });

  it("gives connection guidance for network failures", () => {
    const result = classifyImportError(new Error("Network request failed"));
    expect(result.toLowerCase()).toMatch(/connection|try again/);
    expect(result.toLowerCase()).toContain("nothing was saved");
  });

  it("gives batching guidance for oversized payloads", () => {
    expect(classifyImportError(new Error("Payload too large (413)")).toLowerCase()).toContain("smaller");
  });

  it("does not leak a token embedded in an arbitrary error message", () => {
    const result = classifyImportError(new Error("could not commit abc123-secret-token"));
    expect(result).not.toContain("abc123-secret-token");
    expect(result.length).toBeLessThan(140);
  });

  it("does not stringify plain objects or leak their properties", () => {
    const result = classifyImportError({ token: "leaky-token", secret: "hidden-secret" });
    expect(result).not.toContain("leaky-token");
    expect(result).not.toContain("hidden-secret");
    expect(result).not.toContain("[object Object]");
  });

  it("handles null, undefined and empty messages with generic actionable text", () => {
    expect(classifyImportError(null).toLowerCase()).toContain("could not finish");
    expect(classifyImportError(undefined).toLowerCase()).toContain("could not finish");
    expect(classifyImportError(new Error("   ")).toLowerCase()).toContain("could not finish");
  });

  it("never echoes raw unknown failure text", () => {
    expect(classifyImportError(new Error("weird failure code 778899"))).not.toContain("778899");
  });
});

describe("safeErrorText", () => {
  it("returns a real error message", () => {
    expect(safeErrorText(new Error("Please sign in to continue."))).toBe("Please sign in to continue.");
  });

  it("trims whitespace around an error message", () => {
    expect(safeErrorText(new Error("  Try again.  "))).toBe("Try again.");
  });

  it("does not leak object properties such as tokens", () => {
    expect(safeErrorText({ token: "abc123", secret: "hidden" })).not.toContain("abc123");
  });

  it("replaces non-error values with generic actionable text", () => {
    expect(safeErrorText("abc123")).toBe("Something went wrong. Please try again.");
    expect(safeErrorText(null)).toBe("Something went wrong. Please try again.");
    expect(safeErrorText(undefined)).toBe("Something went wrong. Please try again.");
  });

  it("replaces an error with no message with generic text", () => {
    expect(safeErrorText(new Error("   "))).toBe("Something went wrong. Please try again.");
  });
});

describe("canShowEmail", () => {
  it("allows coordinators and admins to see member email", () => {
    expect(canShowEmail("coordinator")).toBe(true);
    expect(canShowEmail("admin")).toBe(true);
  });

  it("does not expose email to members, editors or a missing session", () => {
    expect(canShowEmail("member")).toBe(false);
    expect(canShowEmail("editor")).toBe(false);
    expect(canShowEmail(undefined)).toBe(false);
  });
});
