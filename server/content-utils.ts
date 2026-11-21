import { z } from "zod";
import { INTEREST_AREAS, type SiteDocument, type SiteSection } from "../lib/contracts";

/**
 * Content helpers: keyword-based manual interest categorization and a strict,
 * constrained zod schema for editable site documents. Pure and framework-free.
 */

export const MAX_SECTIONS = 24;
export const MAX_TITLE_LENGTH = 200;
export const MAX_BODY_LENGTH = 4000;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
// Reject code-like payloads / unsafe protocols in anything rendered as text.
const UNSAFE_TEXT = /javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<script\b|<\/script\b|<iframe\b|<object\b|onerror\s*=|onload\s*=|expression\s*\(|\\u003c/i;

/** True when text contains code-like payloads or unsafe protocols. */
export function hasUnsafeText(value: string): boolean {
  return UNSAFE_TEXT.test(value);
}

const plainText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !hasUnsafeText(value), { message: "Text contains unsafe or code-like content." });

/** Titles are a section's primary heading; a blank title would publish an empty site. */
const sectionTitle = plainText(MAX_TITLE_LENGTH)
  .min(1, "A section title is required.")
  .refine((value) => value.trim().length > 0, { message: "A section title cannot be blank." });

const safeId = z.string().regex(SAFE_ID, "ID must be 1-64 letters, digits, '_' or '-' and start with a letter or digit.");

export const siteSectionSchema = z
  .object({
    id: safeId,
    type: z.enum(["hero", "mission", "programs", "mentorship", "events", "team", "partners", "contact"]),
    title: sectionTitle,
    body: plainText(MAX_BODY_LENGTH),
    enabled: z.boolean(),
  })
  .strict();

/** Exact schema for SiteDocument: unknown keys and duplicate section ids are rejected. */
export const siteDocumentSchema = z
  .object({
    version: z.number().int().nonnegative(),
    theme: z.enum(["desert", "navy"]),
    sections: z.array(siteSectionSchema).max(MAX_SECTIONS),
  })
  .strict()
  .refine(
    (document) => new Set(document.sections.map((section) => section.id)).size === document.sections.length,
    { message: "Section ids must be unique; duplicate section ids would break editing and React keys." },
  );

/** Parse and validate unknown input into a SiteDocument; throws ZodError on failure. */
export function parseSiteDocument(input: unknown): SiteDocument {
  return siteDocumentSchema.parse(input) as SiteDocument;
}

/** A valid, safe starting document for brand-new site content. */
export function defaultSiteDocument(version = 0): SiteDocument {
  if (!Number.isInteger(version) || version < 0) {
    throw new RangeError("Site document version must be a non-negative integer.");
  }
  const sections: SiteSection[] = [
    {
      id: "hero-main",
      type: "hero",
      title: "TechWomen Arizona",
      body: "Connecting, mentoring and advancing women in Arizona's technology community.",
      enabled: true,
    },
    {
      id: "mission-main",
      type: "mission",
      title: "Our mission",
      body: "We build an inclusive pipeline of tech talent through mentorship, community and opportunity.",
      enabled: true,
    },
    {
      id: "mentorship-main",
      type: "mentorship",
      title: "Mentorship",
      body: "Find a mentor or become one. Share goals, meet regularly and grow together.",
      enabled: true,
    },
    {
      id: "contact-main",
      type: "contact",
      title: "Get involved",
      body: "Join our community, volunteer your time or partner with our programs.",
      enabled: true,
    },
  ];
  return { version, theme: "desert", sections };
}

/** Rules mapping lowercase keyword tokens/phrases to canonical interest areas. */
const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  "Finding a mentor": ["mentor", "mentorship", "find a mentor", "guidance"],
  Networking: ["network", "networking", "connections", "meet people"],
  "Learning AI": ["ai", "artificial intelligence", "machine learning", "ml", "llm", "generative", "chatgpt", "learn ai", "learning ai"],
  Leadership: ["lead", "leadership", "leader", "manager"],
  "Career development": ["career", "job", "promotion", "resume", "career growth"],
  Volunteering: ["volunteer", "volunteering", "give back", "community service"],
  "Technical skills": ["technical", "coding", "programming", "developer", "engineering", "software", "tech skills"],
};

/**
 * Suggest canonical interest areas from free text using deterministic keywords.
 * Returns ONLY values from INTEREST_AREAS in canonical order, with an empty-array
 * fallback when nothing matches. Suggestions never subscribe or approve anything.
 */
export function manualCategorize(answer: string): string[] {
  if (typeof answer !== "string") return [];
  const normalized = answer.toLowerCase().replace(/[\s_]+/g, " ").trim();
  if (!normalized) return [];
  const tokens = new Set(normalized.split(/[^a-z0-9+#.]+/).filter(Boolean));

  const matches = (keyword: string): boolean => {
    const key = keyword.trim();
    if (!key) return false;
    if (key.includes(" ")) return normalized.includes(key);
    return tokens.has(key);
  };

  return INTEREST_AREAS.filter((area) => (CATEGORY_KEYWORDS[area] ?? []).some(matches));
}
