import { describe, it, expect } from "vitest";
import {
  parseImportCsv,
  MAX_IMPORT_ROWS,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  type ImportPreviewResult,
} from "./import-utils";

describe("parseImportCsv", () => {
  it("parses a basic CSV and classifies new rows", () => {
    const csv = "name,email\nAda Lovelace,ada@example.com\nGrace Hopper,grace@example.com\n";
    const result = parseImportCsv(csv);
    expect(result.rows).toEqual([
      { index: 0, name: "Ada Lovelace", email: "ada@example.com", status: "new", message: expect.any(String) },
      { index: 1, name: "Grace Hopper", email: "grace@example.com", status: "new", message: expect.any(String) },
    ]);
    expect(result.newCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it("handles quoted fields, escaped quotes and embedded commas/newlines", () => {
    const csv = 'name,email\n"Doe, Jane",jane@example.com\n"Smith ""The Boss"" Bob",bob@example.com\n';
    const result = parseImportCsv(csv);
    expect(result.rows[0].name).toBe("Doe, Jane");
    expect(result.rows[1].name).toBe('Smith "The Boss" Bob');
    expect(result.newCount).toBe(2);
  });

  it("handles CRLF line endings, a BOM and a trailing newline", () => {
    const csv = "\uFEFFname,email\r\nAda,ada@example.com\r\nGrace,grace@example.com\r\n";
    const result = parseImportCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe("Ada");
    expect(result.newCount).toBe(2);
  });

  it("accepts case-insensitive headers with surrounding spaces and ignores extra columns", () => {
    const csv = " Name , EMAIL ,Notes\nAda,ADA@example.com,ignored\n";
    const result = parseImportCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toBe("ada@example.com");
    expect(result.rows[0].status).toBe("new");
  });

  it("normalizes email case and surrounding whitespace", () => {
    const result = parseImportCsv("name,email\nAda,  ADA.Lovelace@Example.COM  \n");
    expect(result.rows[0].email).toBe("ada.lovelace@example.com");
  });

  it("marks malformed emails and missing names as invalid", () => {
    const csv = "name,email\nAda,not-an-email\n,valid@example.com\nValid,ok@example.com\n";
    const result = parseImportCsv(csv);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].message).toMatch(/email/i);
    expect(result.rows[1].status).toBe("invalid");
    expect(result.rows[1].message).toMatch(/name/i);
    expect(result.rows[2].status).toBe("new");
    expect(result.invalidCount).toBe(2);
    expect(result.newCount).toBe(1);
  });

  it("detects duplicates within the file (first stays new, later ones duplicate)", () => {
    const csv = "name,email\nAda,ada@example.com\nAda Again,ADA@example.com\nThird,ada@example.com\n";
    const result = parseImportCsv(csv);
    expect(result.rows.map((r) => r.status)).toEqual(["new", "duplicate", "duplicate"]);
    expect(result.newCount).toBe(1);
    expect(result.duplicateCount).toBe(2);
  });

  it("detects duplicates against an existing email set, case-insensitively", () => {
    const csv = "name,email\nAda,ada@example.com\nExisting,existing@example.com\n";
    const result = parseImportCsv(csv, new Set(["EXISTING@example.com"]));
    expect(result.rows[0].status).toBe("new");
    expect(result.rows[1].status).toBe("duplicate");
    expect(result.rows[1].message).toMatch(/exist/i);
  });

  it("skips blank lines without affecting row indices", () => {
    const csv = "name,email\n\nAda,ada@example.com\n\nGrace,grace@example.com\n";
    const result = parseImportCsv(csv);
    expect(result.rows.map((r) => r.index)).toEqual([0, 1]);
  });

  it("throws a clear error when required headers are missing", () => {
    expect(() => parseImportCsv("fullname,mail\nAda,ada@example.com\n")).toThrow(/name.*email|email.*name/i);
    expect(() => parseImportCsv("name\nAda\n")).toThrow(/email/i);
  });

  it("throws a clear error for an unterminated quoted field", () => {
    expect(() => parseImportCsv('name,email\n"unterminated,ada@example.com\n')).toThrow(/quote/i);
  });

  it("enforces bounded input (max rows and max field lengths)", () => {
    const header = "name,email\n";
    const manyRows = header + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `N${i},n${i}@example.com\n`).join("");
    expect(() => parseImportCsv(manyRows)).toThrow(/row|limit|too many/i);

    expect(() => parseImportCsv(`name,email\n${"a".repeat(MAX_NAME_LENGTH + 1)},a@example.com\n`)).toThrow(/long|length/i);
    expect(() => parseImportCsv(`name,email\nAda,${"a".repeat(MAX_EMAIL_LENGTH)}@example.com\n`)).toThrow(/long|length/i);
  });

  it("is pure and idempotent for identical inputs", () => {
    const csv = "name,email\nAda,ada@example.com\nGrace,grace@example.com\n";
    const existing = new Set(["existing@example.com"]);
    const first: ImportPreviewResult = parseImportCsv(csv, existing);
    const second: ImportPreviewResult = parseImportCsv(csv, existing);
    expect(second).toEqual(first);
  });

  it("is idempotent when previous new emails are supplied as the existing set", () => {
    const csv = "name,email\nAda,ada@example.com\nGrace,grace@example.com\n";
    const first = parseImportCsv(csv);
    const existing = new Set(first.rows.filter((r) => r.status === "new").map((r) => r.email));
    const second = parseImportCsv(csv, existing);
    expect(second.newCount).toBe(0);
    expect(second.duplicateCount).toBe(2);
    expect(second.rows.every((r) => r.status === "duplicate")).toBe(true);
  });
});
