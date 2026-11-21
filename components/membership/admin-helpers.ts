/** Pure helpers for staff membership views. No React, no API, no file writes. */
import type { ImportPreview, Member, StaffRole } from "@/lib/contracts";

/** 2 MB, expressed in bytes, is the largest CSV the browser will hand to preview. */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Case-insensitive member search across the fields staff actually look people up by:
 * name, career, major, interest categories and the free-text interest answer.
 * An empty or whitespace-only query returns every member in original order.
 */
export function filterMembers(members: Member[], query: string): Member[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  return members.filter((member) => {
    const haystack = [
      member.name,
      member.career,
      member.major,
      ...(member.interests ?? []),
      member.interestAnswer,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export type FileValidation = { ok: true } | { ok: false; message: string };

/** Validate a selected CSV file before reading it. Never writes the file anywhere. */
export function validateCsvFile(file: { name: string; size: number }): FileValidation {
  const name = (file?.name ?? "").trim();
  if (!/\.(csv|txt)$/i.test(name)) {
    return { ok: false, message: "Please choose a .csv file (or a plain .txt export)." };
  }
  if (!Number.isFinite(file?.size) || file.size < 0) {
    return { ok: false, message: "That file could not be read. Please choose the CSV again." };
  }
  if (file.size === 0) {
    return { ok: false, message: `"${name}" is empty. Please choose a CSV that contains member rows.` };
  }
  if (file.size > MAX_CSV_BYTES) {
    return {
      ok: false,
      message: `"${name}" is larger than the 2 MB limit. Please choose a smaller CSV file or split it into batches.`,
    };
  }
  return { ok: true };
}

export interface PreviewSummary {
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  total: number;
  summary: string;
}

/**
 * Count preview rows from the row data itself rather than trusting server-supplied
 * totals, and build a short human-readable summary that cannot contain the token.
 */
export function summarizePreview(preview: ImportPreview): PreviewSummary {
  let newCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  for (const row of preview?.rows ?? []) {
    if (row.status === "new") newCount += 1;
    else if (row.status === "duplicate") duplicateCount += 1;
    else if (row.status === "invalid") invalidCount += 1;
  }
  const total = newCount + duplicateCount + invalidCount;
  return {
    newCount,
    duplicateCount,
    invalidCount,
    total,
    summary: `${newCount} new, ${duplicateCount} duplicate, ${invalidCount} invalid across ${total} ${total === 1 ? "row" : "rows"}.`,
  };
}

/** Status filter for the reviewed import rows shown to staff. */
export type ImportRowFilter = "all" | ImportPreview["rows"][number]["status"];

/**
 * Filter reviewed CSV rows by their server-assigned status without changing their order.
 * Accepts a missing rows array so callers can render an empty state safely.
 */
export function filterImportRows(
  rows: ImportPreview["rows"] | null | undefined,
  status: ImportRowFilter,
): ImportPreview["rows"] {
  const list = rows ?? [];
  if (status === "all") return list;
  return list.filter((row) => row.status === status);
}

/** Safe, actionable error text for API failures; never stringifies raw objects or tokens. */
export function safeErrorText(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return GENERIC_ERROR;
}

const GENERIC_IMPORT_ERROR =
  "The server could not finish this request. Nothing was saved. Try again, or clear and review the file again.";

/**
 * Map an unknown import failure to short, actionable staff text.
 *
 * Known failure families are recognised from the message for routing purposes only — the raw
 * message is never returned, so tokens, objects and arbitrary server text cannot leak into the UI.
 */
export function classifyImportError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const text = raw.toLowerCase();

  if (/token|expired|stale|invalid preview/.test(text)) {
    return "This preview is no longer valid. Review the CSV again to get a fresh preview, then retry.";
  }
  if (/unauthor|forbidden|permission|sign.?in|log.?in|session/.test(text)) {
    return "Your staff session may have ended. Sign in again, then review the file and retry.";
  }
  if (/network|fetch|timeout|timed out|offline|connection|unavailable|\b50[023]\b/.test(text)) {
    return "The import service could not be reached. Check your connection and try again. Nothing was saved.";
  }
  if (/too large|2 ?mb|payload|size limit|\b413\b/.test(text)) {
    return "The CSV is too large. Split it into smaller batches (2 MB maximum) and try again.";
  }
  return GENERIC_IMPORT_ERROR;
}

/** Email is only shown to coordinators and admins; the server remains the real gate. */
export function canShowEmail(role: StaffRole | undefined): boolean {
  return role === "coordinator" || role === "admin";
}
