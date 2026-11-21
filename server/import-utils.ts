import type { ImportPreview } from "../lib/contracts";

/**
 * Pure CSV import preview. Handles quoted fields, escaped quotes, embedded
 * newlines, BOM and CRLF. No database or router access; no import token is
 * minted here (the caller owns persistence and token creation).
 */

export const MAX_IMPORT_ROWS = 1000;
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;
const MAX_CSV_LENGTH = 1_000_000;

/** All ImportPreview fields except the server-issued token. */
export type ImportPreviewResult = Omit<ImportPreview, "token">;
type ImportPreviewRow = ImportPreview["rows"][number];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split CSV text into rows of raw fields. Throws on unterminated quotes. */
function parseCsvRows(input: string): string[][] {
  if (typeof input !== "string") throw new TypeError("CSV input must be a string.");
  if (input.length > MAX_CSV_LENGTH) throw new RangeError("CSV input exceeds the maximum allowed size.");

  let csv = input;
  if (csv.charCodeAt(0) === 0xfeff) csv = csv.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else if (char === "\r") {
        if (csv[i + 1] === "\n") i += 1;
        field += "\n";
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("CSV parsing failed: unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const isBlankRow = (cells: string[]): boolean => cells.every((cell) => cell.trim() === "");

/**
 * Preview a CSV import against a set of already-known emails.
 *
 * Duplicate detection is case-insensitive and covers both the existing set
 * and earlier rows within the same file. The function is pure and idempotent:
 * identical inputs always produce identical output and never mutate inputs.
 */
export function parseImportCsv(csv: string, existingEmails: Iterable<string> = []): ImportPreviewResult {
  const rows = parseCsvRows(csv);
  const firstRow = rows.find((cells) => !isBlankRow(cells));
  if (!firstRow) throw new Error("CSV must include 'name' and 'email' header columns.");

  const headers = firstRow.map((cell) => cell.trim().toLowerCase());
  const nameIndex = headers.indexOf("name");
  const emailIndex = headers.indexOf("email");
  if (nameIndex === -1 || emailIndex === -1) {
    throw new Error("CSV must include 'name' and 'email' header columns.");
  }

  const known = new Set<string>();
  for (const email of existingEmails) known.add(email.trim().toLowerCase());

  const seenInFile = new Set<string>();
  const previewRows: ImportPreviewRow[] = [];
  let index = 0;

  for (const cells of rows) {
    if (cells === firstRow || isBlankRow(cells)) continue;
    if (index >= MAX_IMPORT_ROWS) throw new RangeError(`CSV import exceeds the maximum of ${MAX_IMPORT_ROWS} rows.`);

    const name = (cells[nameIndex] ?? "").trim();
    const rawEmail = (cells[emailIndex] ?? "").trim();
    if (name.length > MAX_NAME_LENGTH || rawEmail.length > MAX_EMAIL_LENGTH) {
      throw new RangeError("CSV import field exceeds the maximum allowed length.");
    }
    const email = rawEmail.toLowerCase();
    const rowIndex = index;
    index += 1;

    let status: ImportPreviewRow["status"];
    let message: string;

    if (!name) {
      status = "invalid";
      message = "Missing name.";
    } else if (!EMAIL.test(email)) {
      status = "invalid";
      message = "Invalid email address.";
    } else if (known.has(email)) {
      status = "duplicate";
      message = "Email already exists.";
    } else if (seenInFile.has(email)) {
      status = "duplicate";
      message = `Duplicate email within file (first seen in row ${rowIndex}).`;
    } else {
      status = "new";
      message = "Ready to import.";
      seenInFile.add(email);
    }

    previewRows.push({ index: rowIndex, name, email, status, message });
  }

  return {
    rows: previewRows,
    newCount: previewRows.filter((r) => r.status === "new").length,
    duplicateCount: previewRows.filter((r) => r.status === "duplicate").length,
    invalidCount: previewRows.filter((r) => r.status === "invalid").length,
  };
}
