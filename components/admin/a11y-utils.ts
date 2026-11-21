/** Pure accessibility helpers shared by staff pages. No React, no API, no side effects. */

/** Build a stable, DOM-safe id from a field name. Deterministic so label/control pairs match. */
export function fieldId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `field-${slug || "unnamed"}`;
}

/** Id for the inline error message that belongs to a field. */
export function errorId(name: string): string {
  return `${fieldId(name)}-error`;
}

/** Join truthy ids into a space-separated aria-describedby value; undefined when empty. */
export function describedBy(ids: Array<string | false | null | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(" ").trim();
  return value || undefined;
}

/** Shared class for >=44px interactive targets with a keyboard-visible focus ring. */
export const touchTargetClass =
  "min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";
