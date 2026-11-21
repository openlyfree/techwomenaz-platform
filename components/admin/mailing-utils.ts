/** Newsletter draft helpers. The copy is for a human to paste into HubSpot; nothing is sent here. */

export function validateDraft(subject: string, body: string): string[] {
  const errors: string[] = [];
  if (!subject.trim()) errors.push("Add a subject line.");
  if (!body.trim()) errors.push("Add email body copy.");
  if (subject.length > 200) errors.push("Subject must be 200 characters or fewer.");
  if (body.length > 20000) errors.push("Body must be 20,000 characters or fewer.");
  return errors;
}

export function hubspotCopyText(subject: string, body: string): string {
  return `Subject: ${subject}\n\n${body}`;
}

export function exportFileName(timestamp: string): string {
  const undated = "techwomenaz-contacts.csv";
  // Accept a date-only value or an ISO timestamp whose leading date is a real calendar date.
  const match = typeof timestamp === "string" ? /^(\d{4}-\d{2}-\d{2})(?:T[\s\S]*)?$/.exec(timestamp) : null;
  if (!match) return undated;
  const date = match[1];
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) return undated;
  if (timestamp.length > date.length && Number.isNaN(new Date(timestamp).getTime())) return undated;
  return `techwomenaz-contacts-${date}.csv`;
}
