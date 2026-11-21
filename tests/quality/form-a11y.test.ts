import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import JoinPage from "../../app/join/page";
import LoginPage from "../../app/login/page";
import ProfilePage from "../../app/portal/profile/page";
import {
  CheckboxField,
  SelectField,
  TagEditor,
  TextAreaField,
  TextField,
} from "../../components/membership/form-fields";
import {
  defaultJoinInput,
  validateJoin,
} from "../../components/membership/form-helpers";
import type { Member, SessionUser } from "../../lib/contracts";

// vinext resolves `next/*` at build time; plain vitest does not. Same anchor stub as the
// other quality render tests.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

/**
 * No jsdom/@testing-library in this checkout and dependencies are frozen, so these are SSR
 * render assertions. Hook state is mocked only to get past the loading gates; the production
 * hooks (and their validation) are untouched.
 */
const apiMock = vi.hoisted(() => ({
  user: null as SessionUser | null,
  member: undefined as Member | undefined,
}));

vi.mock("@/lib/api", () => ({
  query: async () => ({}),
  mutate: async () => ({}),
  useQuery: () => ({
    data: apiMock.member,
    loading: false,
    error: null,
    refresh: async () => {},
  }),
  useSession: () => ({
    user: apiMock.user,
    loading: false,
    error: null,
    refresh: async () => {},
  }),
}));

/** Every id token in an aria-describedby must resolve to a rendered element. */
function describedByIdsResolve(html: string, label: string): void {
  const ids = new Set<string>();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1]);
  const references = [...html.matchAll(/aria-describedby="([^"]+)"/g)];
  expect(references.length, `${label}: expected aria-describedby wiring`).toBeGreaterThan(0);
  for (const reference of references) {
    for (const token of reference[1].split(/\s+/).filter(Boolean)) {
      expect(ids.has(token), `${label}: aria-describedby target #${token} must exist`).toBe(true);
    }
  }
}

const sampleMember: Member = {
  id: "mem-test",
  name: "Test Member",
  email: "test@example.com",
  role: "member",
  participation: "mentor",
  status: "approved",
  headline: "Engineer",
  bio: "Synthetic bio.",
  expertise: ["Testing"],
  goals: ["Learn"],
  timezone: "America/Phoenix",
  availability: [{ day: 1, start: "09:00", end: "10:00" }],
  meetingFormat: "online",
  location: "Phoenix",
  capacity: 2,
  discoverable: true,
  aiConsent: false,
  newsletterConsent: "unknown",
  createdAt: "2026-11-21T00:00:00.000Z",
  major: "",
  career: "",
  interests: [],
  interestAnswer: "Find a mentor.",
};

describe("form field accessibility (shared components)", () => {
  it("wires hint and error ids through aria-describedby on text, textarea and select controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(TextField, {
          id: "a11y-text",
          label: "Text",
          value: "",
          onChange: () => {},
          hint: "A hint.",
          error: "A text error.",
        }),
        React.createElement(TextAreaField, {
          id: "a11y-area",
          label: "Area",
          value: "",
          onChange: () => {},
          hint: "An area hint.",
          error: "An area error.",
        }),
        React.createElement(SelectField, {
          id: "a11y-select",
          label: "Select",
          value: "x",
          onChange: () => {},
          options: [{ value: "x", label: "X" }],
          hint: "A select hint.",
          error: "A select error.",
        }),
      ),
    );
    for (const id of ["a11y-text", "a11y-area", "a11y-select"]) {
      expect(html, `${id} must describe its hint`).toContain(`aria-describedby="${id}-hint ${id}-error"`);
      expect(html).toContain(`id="${id}-hint"`);
      expect(html).toContain(`id="${id}-error"`);
    }
    describedByIdsResolve(html, "shared fields");
  });

  it("wires the hint id on checkbox and tag editor controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(CheckboxField, {
          id: "a11y-check",
          label: "Check",
          checked: false,
          onChange: () => {},
          hint: "A checkbox hint.",
        }),
        React.createElement(TagEditor, {
          id: "a11y-tags",
          label: "Tags",
          values: [],
          onChange: () => {},
          hint: "A tag hint.",
        }),
      ),
    );
    expect(html).toContain('aria-describedby="a11y-check-hint"');
    expect(html).toContain('id="a11y-check-hint"');
    expect(html).toContain('aria-describedby="a11y-tags-hint"');
    expect(html).toContain('id="a11y-tags-hint"');
    describedByIdsResolve(html, "checkbox and tag fields");
  });
});

describe("page forms expose resolvable aria-describedby ids", () => {
  it("join", () => {
    apiMock.user = null;
    apiMock.member = undefined;
    const html = renderToStaticMarkup(React.createElement(JoinPage));
    expect(html).toContain('id="join-email"');
    expect(html).toContain('aria-describedby="join-email-hint"');
    describedByIdsResolve(html, "join page");
  });

  it("login", () => {
    apiMock.user = null;
    apiMock.member = undefined;
    const html = renderToStaticMarkup(React.createElement(LoginPage));
    expect(html).toContain('id="login-email"');
    describedByIdsResolve(html, "login page");
  });

  it("profile", () => {
    apiMock.user = { id: "u1", name: "Test Member", email: "test@example.com", role: "member" };
    apiMock.member = sampleMember;
    const html = renderToStaticMarkup(React.createElement(ProfilePage));
    expect(html).toContain('id="profile-timezone"');
    expect(html).toContain('id="slot-start"');
    describedByIdsResolve(html, "profile page");
  });
});

describe("submit failure summary", () => {
  it("a submitted-invalid join shows a role=alert 'Please fix the following:' summary linking each field error", async () => {
    const mod = await import("../../components/membership/form-fields");
    const FormErrorSummary = (
      mod as unknown as {
        FormErrorSummary?: React.ComponentType<{
          errors: Record<string, string>;
          idPrefix?: string;
          fieldIds?: Record<string, string>;
        }>;
      }
    ).FormErrorSummary;
    expect(FormErrorSummary, "FormErrorSummary export must exist").toBeTypeOf("function");

    const invalidErrors = validateJoin(defaultJoinInput());
    expect(Object.keys(invalidErrors)).toEqual(["name", "email", "password", "experience", "interests"]);

    // Render the join page once so we can verify every summary link targets a real field id.
    apiMock.user = null;
    apiMock.member = undefined;
    const pageHtml = renderToStaticMarkup(React.createElement(JoinPage));

    const summaryHtml = renderToStaticMarkup(
      React.createElement(FormErrorSummary!, { errors: invalidErrors, idPrefix: "join" }),
    );
    expect(summaryHtml).toContain('role="alert"');
    expect(summaryHtml).toContain("Please fix the following:");
    for (const [field, message] of Object.entries(invalidErrors)) {
      expect(summaryHtml).toContain(message);
      expect(summaryHtml).toContain(`href="#join-${field}"`);
    }
    // name/email/experience are step-1 controls; interests is defined for step 2.
    for (const field of ["name", "email", "experience"]) {
      expect(pageHtml).toContain(`id="join-${field}"`);
    }
    const joinSource = readFileSync(resolve(process.cwd(), "app/join/page.tsx"), "utf8");
    expect(joinSource).toContain('id="join-interests"');
  });
});
