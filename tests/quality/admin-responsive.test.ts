import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quality slice E — admin responsive cards + mutation confirmations.
 *
 * MOCK BOUNDARY NOTICE: `lib/api` is replaced at the module boundary below with
 * deterministic vi.fn() doubles. No real fetch/tRPC/Postgres/Workers-AI call is
 * made and no network or database state is asserted here. The mocks only let the
 * three page components render under react-dom/server; the responsive markup and
 * the confirmation/error wiring are then asserted against the owned page sources.
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  useQuery: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/api", () => mocks);

// This vinext scaffold has no `next` package installed; stub Link for SSR only.
vi.mock(
  "next/link",
  async () => {
    const ReactModule = await import("react");
    return {
      default: ({ children, href, className }: { children?: React.ReactNode; href?: string; className?: string }) =>
        ReactModule.createElement("a", { href, className }, children),
    };
  },
);

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const staff = { id: "s-1", name: "Staff", email: "staff@example.org", role: "admin" as const };
const member = {
  id: "m-1", name: "Ada", email: "ada@example.org", role: "member" as const,
  participation: "mentor" as const, status: "approved" as const,
  career: "Engineer", major: "Computer Science", interests: ["Learning AI"], interestAnswer: "I want to give back.",
};
const match = {
  id: "x-1", mentorId: "m-1", menteeId: "m-2", mentorName: "Ada", menteeName: "Grace",
  status: "awaiting-coordinator" as const, goal: "Career growth", nextMeeting: null,
  meetingUrl: "", createdAt: "2026-11-01T00:00:00.000Z",
};
const stats = {
  members: 2, mentors: 1, mentees: 1, pendingApplications: 0, pendingMatches: 1,
  activeMatches: 0, recordedMeetings: 0, checkins: 0,
  signupTrend: [{ date: "2026-11-01", count: 2 }],
};

describe("admin responsive cards and mutation confirmations", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.mutate.mockReset().mockResolvedValue({ success: true });
    mocks.useSession.mockReset().mockReturnValue({
      user: staff, loading: false, error: null, refresh: vi.fn(),
    });
    mocks.useQuery.mockReset().mockImplementation((procedure: string) => {
      const refresh = vi.fn();
      if (procedure === "admin.stats") return { data: stats, loading: false, error: null, refresh };
      if (procedure === "admin.integrations") return { data: { demo: false }, loading: false, error: null, refresh };
      if (procedure === "admin.members") return { data: [member], loading: false, error: null, refresh };
      if (procedure === "admin.matches") return { data: [match], loading: false, error: null, refresh };
      return { data: undefined, loading: false, error: null, refresh };
    });
  });

  it("renders all three admin pages through the mocked lib/api boundary", async () => {
    const [members, mentorship, reports] = await Promise.all([
      import("../../app/admin/members/page"),
      import("../../app/admin/mentorship/page"),
      import("../../app/admin/reports/page"),
    ]);
    for (const page of [members, mentorship, reports]) {
      expect(typeof page.default).toBe("function");
      const html = renderToStaticMarkup(React.createElement(page.default));
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it("keeps every member column in labeled responsive cards and confirms approve/pause", () => {
    const src = source("../../app/admin/members/page.tsx");
    expect(src).toMatch(/<dl\b/);
    expect(src).toMatch(/<dt\b/);
    expect(src).toMatch(/<dd\b/);
    expect(src).toMatch(/grid-cols-1/);
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/admin\.approveMember[\s\S]*?setNotice\(/);
    expect(src).toMatch(/ErrorNotice/);
  });

  it("renders mentorship rows as labeled responsive cards and confirms match approval", async () => {
    const src = source("../../app/admin/mentorship/page.tsx");
    expect(src).toMatch(/<dl\b/);
    expect(src).toMatch(/<dt\b/);
    expect(src).toMatch(/<dd\b/);
    expect(src).toMatch(/grid-cols-1/);
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/admin\.approveMatch[\s\S]*?setNotice\(/);
    expect(src).toMatch(/ErrorNotice/);

    const { default: MentorshipPage } = await import("../../app/admin/mentorship/page");
    const html = renderToStaticMarkup(React.createElement(MentorshipPage));
    expect(html).toContain("Ada");
    expect(html).toContain("Grace");
    expect(html).toContain("Capacity");
    expect(html).toContain('aria-live="polite"');
  });

  it("keeps every signup-trend column labeled on mobile and exposes a status region", async () => {
    const src = source("../../app/admin/reports/page.tsx");
    expect(src).toMatch(/md:hidden/);
    expect(src).toMatch(/md:block/);
    expect(src).toMatch(/overflow-x-auto/);
    expect(src).toMatch(/<dt[^>]*>\s*Date\s*<\/dt>/);
    expect(src).toMatch(/<dt[^>]*>\s*New members\s*<\/dt>/);
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/aria-live="polite"/);

    const { default: ReportsPage } = await import("../../app/admin/reports/page");
    const html = renderToStaticMarkup(React.createElement(ReportsPage));
    expect(html).toContain("Date");
    expect(html).toContain("New members");
    expect(html).toContain('aria-live="polite"');
  });
});
