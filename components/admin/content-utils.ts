import type { SiteDocument, SiteSection } from "../../lib/contracts";

/** Pure helpers for the staff CMS editor. No React, no API, no side effects. */

export const SECTION_LABELS: Record<SiteSection["type"], string> = {
  hero: "Hero banner",
  mission: "Mission",
  programs: "Programs",
  mentorship: "Mentorship",
  events: "Events intro",
  team: "Team",
  partners: "Partners",
  contact: "Contact",
};

/**
 * Pure helper: returns each stable id that occurs more than once. Whitespace-only
 * ids are ignored here because `ensureStableIds` replaces them with real ids.
 */
export function duplicateSectionIds(sections: SiteSection[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const section of sections) {
    const id = section.id.trim();
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }
  return [...duplicates];
}

/**
 * Preserve author-assigned ids; give blank ids a deterministic, collision-free
 * value and reassign later ids that collide with an earlier one. Never mutates
 * the input, so a bad AI candidate can be normalized without hidden side effects.
 */
export function ensureStableIds(sections: SiteSection[]): SiteSection[] {
  const used = new Set<string>();
  return sections.map((section, index) => {
    const requested = section.id.trim();
    const base = requested || `${section.type}-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id === section.id ? section : { ...section, id };
  });
}

export function reorderSections(sections: SiteSection[], from: number, to: number): SiteSection[] {
  if (from < 0 || to < 0 || from >= sections.length || to >= sections.length || from === to) {
    return sections;
  }
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function toggleSection(sections: SiteSection[], id: string): SiteSection[] {
  return sections.map((section) => (section.id === id ? { ...section, enabled: !section.enabled } : section));
}

export function validateSections(sections: SiteSection[]): string[] {
  const errors: string[] = [];
  if (!sections.some((section) => section.enabled)) {
    errors.push("Enable at least one section before publishing.");
  }
  if (sections.some((section) => !section.title.trim())) {
    errors.push("Every section needs a title.");
  }
  if (duplicateSectionIds(sections).length) {
    errors.push("Section ids must be unique.");
  }
  return errors;
}

export function isDraftDirty(draft: SiteDocument, published: SiteDocument): boolean {
  if (draft.version !== published.version) return true;
  if (draft.theme !== published.theme) return true;
  if (draft.sections.length !== published.sections.length) return true;
  return draft.sections.some((section, index) => JSON.stringify(section) !== JSON.stringify(published.sections[index]));
}

export function revisionName(document: SiteDocument): string {
  return `Version ${document.version}`;
}
