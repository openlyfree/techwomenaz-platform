import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Checkin, Match, SessionUser } from "@/lib/contracts";
import { MatchDetail } from "./MatchDetail";

const api = vi.hoisted(() => ({
  useSession: vi.fn(),
  useQuery: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

const user: SessionUser = { id: "me", name: "Bea Member", email: "bea@example.test", role: "member" };

const match: Match = {
  id: "m1",
  mentorId: "mentor-1",
  menteeId: "me",
  mentorName: "Ada Mentor",
  menteeName: "Bea Member",
  status: "active",
  goal: "Grow into leadership",
  nextMeeting: "2026-11-25T22:00:00.000Z",
  meetingUrl: "https://meet.example.test/room",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const checkin: Checkin = {
  id: "c1",
  matchId: "m1",
  met: true,
  useful: true,
  continue: true,
  privateNote: "Asked about promotion paths",
  createdAt: "2026-11-18T00:00:00.000Z",
};

type QueryState = { data?: unknown; loading: boolean; error: string | null; refresh: () => void };

function state(data?: unknown, loading = false, error: string | null = null): QueryState {
  return { data, loading, error, refresh: () => {} };
}

function configure(
  session: { user: SessionUser | null; loading?: boolean; error?: string | null } = { user },
  results: Record<string, QueryState> = {},
) {
  api.useSession.mockReturnValue({
    user: session.user,
    loading: session.loading ?? false,
    error: session.error ?? null,
    refresh: () => {},
  });
  api.useQuery.mockImplementation((procedure: string) => results[procedure] ?? state(undefined));
  api.mutate.mockResolvedValue({});
}

const authorized = () => ({
  "mentorship.matches": state([match]),
  "mentorship.checkins": state([]),
});

beforeEach(() => {
  vi.clearAllMocks();
  configure();
});

describe("authorization gate", () => {
  it("shows a login action and no match data when signed out", () => {
    configure({ user: null }, authorized());
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Sign in to open this match");
    expect(html).toContain("/login");
    expect(html).not.toContain("Ada Mentor");
    expect(html).not.toContain("Save check-in");
  });

  it("never fabricates a match from the URL id", () => {
    configure({ user }, { "mentorship.matches": state([]), "mentorship.checkins": state([]) });
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "not-mine" }));
    expect(html).toContain("Match not available");
    expect(html).not.toContain("Ada Mentor");
    expect(html).not.toContain("Save details");
    expect(html).not.toContain("Save check-in");
  });

  it("shows a session error with an actionable retry instead of hiding it", () => {
    configure(
      { user: null, error: "Session service unavailable." },
      authorized(),
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Session service unavailable.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Ada Mentor");
  });
});

describe("authorized match plan", () => {
  it("renders the server match with honest status and editing controls", () => {
    configure({ user }, authorized());
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Ada Mentor &amp; Bea Member");
    expect(html).toContain("Next meeting is scheduled");
    expect(html).toContain("Save details");
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain("Pause match");
    expect(html).toContain("Complete match");
    expect(html).not.toContain("%");
  });

  it("renders the meeting link only when it is a safe http(s) URL", () => {
    configure({ user }, authorized());
    const safe = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(safe).toContain('href="https://meet.example.test/room"');
    expect(safe).toContain('rel="noopener noreferrer"');

    api.useQuery.mockImplementation((procedure: string) =>
      procedure === "mentorship.matches"
        ? state([{ ...match, meetingUrl: "javascript:alert(1)" }])
        : procedure === "mentorship.checkins"
          ? state([])
          : state(undefined),
    );
    const unsafe = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(unsafe).not.toContain("javascript:");
    expect(unsafe).not.toContain("Open meeting link");
  });

  it("offers the calendar download only with a parseable meeting date", () => {
    configure({ user }, authorized());
    expect(renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }))).toContain("Add to calendar");

    api.useQuery.mockImplementation((procedure: string) =>
      procedure === "mentorship.matches"
        ? state([{ ...match, nextMeeting: null }])
        : procedure === "mentorship.checkins"
          ? state([])
          : state(undefined),
    );
    expect(renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }))).not.toContain("Add to calendar");
  });

  it("reports a match load error with a specific retry action", () => {
    configure(
      { user },
      {
        "mentorship.matches": state(undefined, false, "Match service unavailable."),
        "mentorship.checkins": state([]),
      },
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Match service unavailable.");
    expect(html).toContain("Retry match");
    expect(html).not.toContain("Ada Mentor");
  });
});

describe("check-ins", () => {
  it("shows a loading state while check-ins are pending", () => {
    configure(
      { user },
      {
        "mentorship.matches": state([match]),
        "mentorship.checkins": state(undefined, true),
      },
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Loading check-ins");
    expect(html).not.toContain("No check-ins recorded");
  });

  it("shows an empty state with no fabricated check-ins", () => {
    configure({ user }, authorized());
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("No check-ins recorded for this match yet.");
    expect(html).toContain("Save check-in");
  });

  it("shows a check-in error with a retry", () => {
    configure(
      { user },
      {
        "mentorship.matches": state([match]),
        "mentorship.checkins": state(undefined, false, "Check-ins are unavailable."),
      },
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Check-ins are unavailable.");
    expect(html).toContain("Retry check-ins");
  });

  it("renders only server-returned notes and never claims a coordinator reviewed them", () => {
    configure(
      { user },
      {
        "mentorship.matches": state([match]),
        "mentorship.checkins": state([checkin, { ...checkin, id: "c2", privateNote: "" }]),
      },
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).toContain("Asked about promotion paths");
    expect(html).toContain("Met: Yes");
    expect(html).toMatch(/blank note means it is restricted/i);
    expect(html).not.toMatch(/coordinator (saw|reviewed|read)/i);
  });
});
