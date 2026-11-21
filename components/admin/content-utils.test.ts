import { describe, expect, it } from "vitest";
import {
  SECTION_LABELS,
  duplicateSectionIds,
  ensureStableIds,
  isDraftDirty,
  reorderSections,
  toggleSection,
  validateSections,
} from "./content-utils";
import type { SiteDocument, SiteSection } from "../../lib/contracts";

const section = (id: string, type: SiteSection["type"], title = "Title", enabled = true): SiteSection => ({
  id,
  type,
  title,
  body: "Body copy",
  enabled,
});

const doc = (sections: SiteSection[], version = 3): SiteDocument => ({
  version,
  theme: "desert",
  sections,
});

describe("content editor utilities", () => {
  it("labels every contracted section type", () => {
    for (const type of ["hero", "mission", "programs", "mentorship", "events", "team", "partners", "contact"] as const) {
      expect(SECTION_LABELS[type]).toBeTruthy();
    }
  });

  it("keeps existing stable ids and assigns deterministic ids to new sections", () => {
    const sections = [section("keep-me", "hero"), section("", "mission")];
    const first = ensureStableIds(sections);
    const second = ensureStableIds(sections);
    expect(first[0].id).toBe("keep-me");
    expect(first[1].id).toMatch(/^mission-/);
    expect(first).toEqual(second);
    expect(sections[1].id).toBe("");
  });

  it("reorders sections immutably", () => {
    const original = [section("a", "hero"), section("b", "mission"), section("c", "programs")];
    const moved = reorderSections(original, 0, 2);
    expect(moved.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(original.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("ignores an out-of-range reorder", () => {
    const original = [section("a", "hero")];
    expect(reorderSections(original, 0, 5)).toEqual(original);
  });

  it("toggles only the requested section", () => {
    const sections = [section("a", "hero"), section("b", "mission", "Title", false)];
    const toggled = toggleSection(sections, "b");
    expect(toggled[0].enabled).toBe(true);
    expect(toggled[1].enabled).toBe(true);
  });

  it("reports when no section is enabled", () => {
    expect(validateSections([section("a", "hero", "Title", false)])).toContain("Enable at least one section before publishing.");
  });

  it("reports an untitled section", () => {
    expect(validateSections([section("a", "hero", "  ")])).toContain("Every section needs a title.");
  });

  it("accepts a valid draft", () => {
    expect(validateSections([section("a", "hero")])).toEqual([]);
  });

  it("treats deep-equal drafts as clean", () => {
    expect(isDraftDirty(doc([section("a", "hero")]), doc([section("a", "hero")]))).toBe(false);
  });

  it("detects a changed body as dirty", () => {
    const published = doc([section("a", "hero")]);
    const draft = doc([{ ...section("a", "hero"), body: "Edited copy" }]);
    expect(isDraftDirty(draft, published)).toBe(true);
  });

  it("detects a version change as dirty", () => {
    expect(isDraftDirty(doc([section("a", "hero")], 4), doc([section("a", "hero")], 3))).toBe(true);
  });
});

describe("CMS validation, preview and rollback correctness", () => {
  it("rejects whitespace-only titles (spaces, tabs and newlines)", () => {
    expect(validateSections([section("a", "hero", " \t\n ")])).toContain("Every section needs a title.");
  });

  it("detects duplicate stable ids with a pure helper", () => {
    expect(
      duplicateSectionIds([section("a", "hero"), section("a", "mission"), section("b", "team")]),
    ).toEqual(["a"]);
    expect(duplicateSectionIds([section("a", "hero"), section("b", "mission")])).toEqual([]);
  });

  it("blocks publishing when stable ids are duplicated", () => {
    expect(validateSections([section("dup", "hero"), section("dup", "mission")])).toContain(
      "Section ids must be unique.",
    );
  });

  it("assigns blank ids that do not collide with existing ids", () => {
    const result = ensureStableIds([section("hero-2", "hero"), section("", "hero")]);
    expect(result[1].id).not.toBe("hero-2");
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length);
  });

  it("de-duplicates pre-existing colliding ids", () => {
    const result = ensureStableIds([section("dup", "hero"), section("dup", "mission")]);
    expect(result.map((item) => item.id)).toEqual(["dup", "dup-2"]);
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length);
  });

  it("ignores negative and out-of-range reorder indices immutably", () => {
    const original = [section("a", "hero"), section("b", "mission")];
    expect(reorderSections(original, -1, 1)).toBe(original);
    expect(reorderSections(original, 0, -1)).toBe(original);
    expect(reorderSections(original, -5, 99)).toBe(original);
    expect(reorderSections(original, 2, 1)).toBe(original);
    expect(original.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("treats a pure reorder as a dirty draft", () => {
    const published = doc([section("a", "hero"), section("b", "mission")]);
    const reordered = doc([section("b", "mission"), section("a", "hero")]);
    expect(isDraftDirty(reordered, published)).toBe(true);
  });
});
