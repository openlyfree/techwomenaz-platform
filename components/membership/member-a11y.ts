/** Pure, presentation-only helpers for accessible membership views. No React, no API, no file writes. */

/**
 * Human-readable labels for status/role/participation. Status must never be
 * conveyed by colour alone, so every value becomes explicit text. Unknown or
 * missing values fall back to plain language instead of "undefined" or blanks.
 */
export function formatMemberStatus(status: unknown): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "paused":
      return "Paused";
    case "pending":
      return "Pending";
    default:
      return "Status not available";
  }
}

export function formatRole(role: unknown): string {
  switch (role) {
    case "member":
      return "Member";
    case "coordinator":
      return "Coordinator";
    case "editor":
      return "Editor";
    case "admin":
      return "Admin";
    default:
      return "Role not available";
  }
}

export function formatParticipation(participation: unknown): string {
  switch (participation) {
    case "mentor":
      return "Mentor";
    case "mentee":
      return "Mentee";
    case "both":
      return "Mentor and mentee";
    default:
      return "Participation not set";
  }
}

/**
 * Screen-reader label for a member action. Always names both who is affected
 * and what is being done, even when one of the inputs is missing.
 */
export function actionLabel(name: unknown, action: unknown): string {
  const who = typeof name === "string" && name.trim() ? name.trim() : "this member";
  const what = typeof action === "string" && action.trim() ? action.trim() : "Update status for";
  return `${what} ${who}`;
}

/**
 * Shorten long free text for narrow cards without cutting a word in half.
 * Missing values and non-positive limits return an empty string rather than throwing.
 */
export function shortenForDisplay(value: unknown, max: number): string {
  const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
  if (limit === 0) return "";
  if (typeof value !== "string" || !value.trim()) return "";

  const text = value.trim();
  if (text.length <= limit) return text;

  const head = text.slice(0, limit - 1);
  const lastSpace = head.lastIndexOf(" ");
  const base = lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${base.trimEnd()}…`;
}
