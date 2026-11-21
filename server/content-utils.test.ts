import { describe, it, expect } from "vitest";
import {
  manualCategorize,
  siteDocumentSchema,
  parseSiteDocument,
  defaultSiteDocument,
  hasUnsafeText,
  MAX_SECTIONS,
} from "./content-utils";
import { INTEREST_AREAS, type SiteDocument, type SiteSection } from "../lib/contracts";

const section = (overrides: Partial<SiteSection> = {}): SiteSection => ({
  id: "hero-main",
  type: "hero",
  title: "Welcome",
  body: "A plain text introduction to our community.",
  enabled: true,
  ...overrides,
});

describe("manualCategorize", () => {
  it("maps AI-related answers to the canonical Learning AI category", () => {
    expect(manualCategorize("I want to learn AI and machine learning")).toContain("Learning AI");
    expect(manualCategorize("Interested in generative AI / LLMs")).toContain("Learning AI");
  });

  it("maps networking answers to Networking", () => {
    expect(manualCategorize("Looking for networking opportunities")).toContain("Networking");
  });

  it("maps mentoring answers to Finding a mentor", () => {
    expect(manualCategorize("I am looking for a mentor to guide me")).toContain("Finding a mentor");
  });

  it("returns multiple canonical categories in canonical order", () => {
    const result = manualCategorize("I want networking, a mentor, and to learn AI");
    expect(result).toEqual(["Finding a mentor", "Networking", "Learning AI"]);
  });

  it("is case-insensitive", () => {
    expect(manualCategorize("NETWORKING AND AI AND MENTOR")).toEqual([
      "Finding a mentor",
      "Networking",
      "Learning AI",
    ]);
  });

  it("does not match the short keyword 'ai' inside unrelated words", () => {
    expect(manualCategorize("I said email the team")).toEqual([]);
  });

  it("returns an empty safe fallback for blank or unknown answers without inventing categories", () => {
    expect(manualCategorize("")).toEqual([]);
    expect(manualCategorize("   ")).toEqual([]);
    const unknown = manualCategorize("qwerty zxcvbnm unknown phrase");
    expect(unknown).toEqual([]);
  });

  it("never returns anything outside canonical INTEREST_AREAS", () => {
    const inputs = [
      "leadership and career growth",
      "volunteer to give back",
      "technical coding and software skills",
      "find a mentor, network, learn ai, lead, career, volunteer, technical",
    ];
    for (const input of inputs) {
      for (const category of manualCategorize(input)) {
        expect(INTEREST_AREAS).toContain(category);
      }
    }
  });
});

describe("siteDocumentSchema / parseSiteDocument", () => {
  it("accepts and returns a well-formed document", () => {
    const doc: SiteDocument = { version: 3, theme: "desert", sections: [section()] };
    expect(parseSiteDocument(doc)).toEqual(doc);
    expect(siteDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects a negative or non-integer version", () => {
    expect(() => parseSiteDocument({ version: -1, theme: "navy", sections: [] })).toThrow();
    expect(() => parseSiteDocument({ version: 1.5, theme: "navy", sections: [] })).toThrow();
  });

  it("rejects an invalid theme", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "purple", sections: [] })).toThrow();
  });

  it("rejects unknown top-level keys (exact schema)", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [], extra: true })).toThrow();
  });

  it("rejects unknown section keys (exact schema)", () => {
    const bad = { version: 0, theme: "navy", sections: [{ ...section(), malicious: true }] };
    expect(() => parseSiteDocument(bad)).toThrow();
  });

  it("rejects an unknown section type", () => {
    const bad = { version: 0, theme: "navy", sections: [{ ...section(), type: "evil" }] };
    expect(() => parseSiteDocument(bad)).toThrow();
  });

  it("rejects a missing required field", () => {
    const bad = { version: 0, theme: "navy", sections: [{ id: "x", type: "hero", enabled: true }] };
    expect(() => parseSiteDocument(bad)).toThrow();
  });

  it("rejects unsafe ids", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ id: "bad id!!" })] })).toThrow();
  });

  it("rejects a blank section title so an empty site cannot be published", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ title: "" })] })).toThrow();
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ title: "   " })] })).toThrow();
  });

  it("rejects code-like / unsafe protocols in text", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ body: "javascript:alert(1)" })] })).toThrow();
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ title: '<script>alert(1)</script>' })] })).toThrow();
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ body: 'x" onerror="alert(1)' })] })).toThrow();
  });

  it("rejects overly long text and too many sections", () => {
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: [section({ body: "a".repeat(9000) })] })).toThrow();
    const many = Array.from({ length: MAX_SECTIONS + 1 }, (_, i) => section({ id: `s${i}` }));
    expect(() => parseSiteDocument({ version: 0, theme: "navy", sections: many })).toThrow();
  });
});

describe("defaultSiteDocument", () => {
  it("produces a valid document with version 0 by default", () => {
    const doc = defaultSiteDocument();
    expect(doc.version).toBe(0);
    expect(() => parseSiteDocument(doc)).not.toThrow();
    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.sections.some((s) => s.type === "hero" && s.enabled)).toBe(true);
  });

  it("honors an explicit version and stays valid", () => {
    const doc = defaultSiteDocument(7);
    expect(doc.version).toBe(7);
    expect(() => parseSiteDocument(doc)).not.toThrow();
  });

  it("does not share mutable section objects between calls", () => {
    const first = defaultSiteDocument();
    const second = defaultSiteDocument();
    first.sections[0].title = "Changed";
    expect(second.sections[0].title).toBe("TechWomen Arizona");
  });
});

describe("hasUnsafeText", () => {
  it("flags code-like and unsafe-protocol payloads", () => {
    expect(hasUnsafeText("javascript:alert(1)")).toBe(true);
    expect(hasUnsafeText("<script>alert(1)</script>")).toBe(true);
    expect(hasUnsafeText('x" onerror="alert(1)')).toBe(true);
    expect(hasUnsafeText("data:text/html;base64,Zm9v")).toBe(true);
  });

  it("allows ordinary plain text and safe links", () => {
    expect(hasUnsafeText("Join our mentorship program.")).toBe(false);
    expect(hasUnsafeText("Visit https://example.com for details.")).toBe(false);
    expect(hasUnsafeText("")).toBe(false);
  });
});

describe("siteDocumentSchema additional malformed inputs", () => {
  it("rejects wrong primitive types for version, theme, sections and enabled", () => {
    expect(() => parseSiteDocument({ version: "1", theme: "navy", sections: [] })).toThrow();
    expect(() => parseSiteDocument({ version: 1, theme: 5, sections: [] })).toThrow();
    expect(() => parseSiteDocument({ version: 1, theme: "navy", sections: {} })).toThrow();
    expect(() => parseSiteDocument({ version: 1, theme: "navy", sections: [section({ enabled: "yes" as unknown as boolean })] })).toThrow();
  });

  it("accepts both themes and an empty section list", () => {
    expect(parseSiteDocument({ version: 0, theme: "navy", sections: [] })).toEqual({ version: 0, theme: "navy", sections: [] });
    expect(parseSiteDocument({ version: 0, theme: "desert", sections: [] })).toEqual({ version: 0, theme: "desert", sections: [] });
  });
});
