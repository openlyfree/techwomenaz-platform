import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryResult, Match, Member, SessionUser } from "@/lib/contracts";
import { AdminMentorshipBoard } from "./AdminMentorshipBoard";
import { DiscoveryBoard } from "./DiscoveryBoard";
import { MatchDetail } from "./MatchDetail";
import { MatchesBoard } from "./MatchesBoard";
import { PortalHome } from "./PortalHome";

const api = vi.hoisted(() => ({
  useSession: vi.fn(),
  useQuery: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

const user: SessionUser = { id: "me", name: "Bea Member", email: "bea@example.test", role: "member" };
const staff: SessionUser = { id: "staff", name: "Casey Coordinator", email: "casey@example.test", role: "coordinator" };

const member: Member = {
  id: "me",
  name: "Bea Member",
  email: "bea@example.test",
  role: "member",
  participation: "mentee",
  status: "approved",
  headline: "Product manager",
  bio: "Looking for a mentor",
  expertise: ["Product"],
  goals: ["Leadership"],
  timezone: "America/Phoenix",
  availability: [{ day: 2, start: "10:00", end: "12:00" }],
  meetingFormat: "online",
  location: "Phoenix, AZ",
  capacity: 0,
  discoverable: true,
  aiConsent: false,
  newsletterConsent: "unknown",
  createdAt: "2026-01-01T00:00:00.000Z",
  major: "Business",
  career: "Product",
  interests: ["Finding a mentor"],
  interestAnswer: "A mentor in product",
};

const incomplete = { ...member, headline: "", expertise: [], availability: [] };

const discovery: DiscoveryResult = {
  cards: [
    {
      id: "cand-1",
      name: "Ada Mentor",
      headline: "Staff engineer",
      bio: "ada@private.test",
      expertise: ["Security"],
      goals: ["Leadership"],
      timezone: "America/Phoenix",
      availability: [{ day: 2, start: "10:00", end: "12:00" }],
      meetingFormat: "online",
      location: "Phoenix, AZ",
      reasons: ["Shared availability"],
      overlapMinutes: 120,
      source: "manual",
      confidence: null,
    },
  ],
  source: "manual",
  notice: "Jev ranking is temporarily unavailable.",
};

const activeMatch: Match = {
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

beforeEach(() => {
  vi.clearAllMocks();
  configure();
});

describe("session and profile gates", () => {
  it("discovery shows a sign-in action when there is no session", () => {
    configure({ user: null });
    const html = renderToStaticMarkup(createElement(DiscoveryBoard));
    expect(html).toContain("Sign in to discover members");
    expect(html).not.toContain("Ada Mentor");
  });

  it("discovery requires a complete profile before applying", () => {
    configure({ user }, { "membership.me": state(incomplete) });
    const html = renderToStaticMarkup(createElement(DiscoveryBoard));
    expect(html).toContain("Complete your profile before applying");
    expect(html).toContain("/portal/profile");
    expect(html).not.toContain("Ada Mentor");
  });

  it("match details never fabricate a match the server did not return", () => {
    configure({ user }, { "mentorship.matches": state([]), "mentorship.checkins": state([]) });
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "not-mine" }));
    expect(html).toContain("Match not available");
    expect(html).not.toContain("Ada Mentor");
  });

  it("matches list shows a sign-in action when there is no session", () => {
    configure({ user: null }, { "mentorship.matches": state([activeMatch]) });
    const html = renderToStaticMarkup(createElement(MatchesBoard));
    expect(html).toContain("Sign in to see your mentorships");
    expect(html).toContain("/login");
    expect(html).not.toContain("Ada Mentor");
    expect(html).not.toContain("Grow into leadership");
  });

  it("portal home shows a sign-in action when there is no session", () => {
    configure({ user: null }, { "mentorship.matches": state([activeMatch]) });
    const html = renderToStaticMarkup(createElement(PortalHome));
    expect(html).toContain("Sign in to open your portal");
    expect(html).not.toContain("Ada Mentor");
    expect(html).not.toContain("Bea Member");
  });

  it("matches list links an incomplete profile to the profile page", () => {
    configure({ user }, { "membership.me": state(incomplete) });
    const html = renderToStaticMarkup(createElement(MatchesBoard));
    expect(html).toContain("/portal/profile");
  });

  it("portal home links an incomplete profile to the profile page", () => {
    configure({ user }, { "membership.me": state(incomplete) });
    const html = renderToStaticMarkup(createElement(PortalHome));
    expect(html).toContain("/portal/profile");
  });
});

describe("authorized content", () => {
  it("discovery renders only server data with its honest notice", () => {
    configure(
      { user },
      { "membership.me": state(member), "mentorship.discover": state(discovery) },
    );
    const html = renderToStaticMarkup(createElement(DiscoveryBoard));
    expect(html).toContain("Ada Mentor");
    expect(html).toContain("Jev ranking is temporarily unavailable.");
    expect(html).toContain("Mentee looking for a mentor");
    expect(html).toContain("Mentor looking for a mentee");
    expect(html).not.toContain("ada@private.test");
    expect(html).not.toContain("97");
  });

  it("discovery never renders a confidence score or percentage", () => {
    configure(
      { user },
      {
        "membership.me": state(member),
        "mentorship.discover": state({
          ...discovery,
          cards: [{ ...discovery.cards[0], confidence: 97, overlapMinutes: 120 }],
          notice: null,
        }),
      },
    );
    const html = renderToStaticMarkup(createElement(DiscoveryBoard));
    expect(html).toContain("Ada Mentor");
    expect(html).toContain("2 h of overlapping availability");
    expect(html).not.toContain("97");
    expect(html).not.toContain("%");
  });

  it("matches list shows a clear next step for a real match", () => {
    configure(
      { user },
      { "membership.me": state(member), "mentorship.matches": state([activeMatch]) },
    );
    const html = renderToStaticMarkup(createElement(MatchesBoard));
    expect(html).toContain("Next meeting is scheduled");
    expect(html).toContain("/portal/relationships/m1");
    expect(html).not.toContain("Private note");
  });

  it("match detail shows editing controls and calendar only with a date", () => {
    configure(
      { user },
      { "mentorship.matches": state([activeMatch]), "mentorship.checkins": state([]) },
    );
    const withDate = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(withDate).toContain("Add to calendar");
    expect(withDate).toContain("https://meet.example.test/room");
    expect(withDate).toContain("Save check-in");

    const withoutDate = renderToStaticMarkup(
      createElement(MatchDetail, { id: "m1" }),
    );
    api.useQuery.mockImplementation((procedure: string) =>
      procedure === "mentorship.matches"
        ? state([{ ...activeMatch, nextMeeting: null, meetingUrl: "" }])
        : procedure === "mentorship.checkins"
          ? state([])
          : state(undefined),
    );
    const html = renderToStaticMarkup(createElement(MatchDetail, { id: "m1" }));
    expect(html).not.toContain("Add to calendar");
    expect(html).not.toContain("Open meeting link");
    expect(withoutDate).toContain("Add to calendar");
  });

  it("portal home links to all three member areas", () => {
    configure(
      { user },
      { "membership.me": state(member), "mentorship.matches": state([activeMatch]) },
    );
    const html = renderToStaticMarkup(createElement(PortalHome));
    expect(html).toContain("/portal/profile");
    expect(html).toContain("/portal/discover");
    expect(html).toContain("/portal/mentorship");
    expect(html).toContain("active");
  });
});

describe("staff management", () => {
  it("refuses to expose staff member and match records to a member", () => {
    // AdminMentorshipBoard owns its own layout/heading; this slice asserts the
    // privacy guarantee that matters: no member or match RECORD renders for a
    // non-staff session. The gate itself is server-side and stays intact.
    configure(
      { user },
      {
        "admin.members": state([
          { ...member, id: "mentor-1", name: "Private Mentor Name", participation: "mentor", capacity: 3 },
        ]),
        "admin.matches": state([{ ...activeMatch, mentorName: "Private Mentor Name" }]),
      },
    );
    const html = renderToStaticMarkup(createElement(AdminMentorshipBoard));
    expect(html).toContain("Staff sign-in required");
    expect(html).not.toContain("Private Mentor Name");
    expect(html).not.toContain("Ada Mentor");
    expect(html).not.toContain("Pending applications");
    expect(html).not.toContain("Approve match");
  });

  it("shows real capacity and pending counts for staff", () => {
    configure(
      { user: staff },
      {
        "admin.members": state([
          { ...member, id: "mentor-1", participation: "mentor", capacity: 3 },
          { ...member, id: "pending-1", status: "pending" },
        ]),
        "admin.matches": state([{ ...activeMatch, status: "awaiting-coordinator" }]),
      },
    );
    const html = renderToStaticMarkup(createElement(AdminMentorshipBoard));
    expect(html).toContain("Pending applications");
    expect(html).toContain("Approve match");
    expect(html).toContain("Ada Mentor");
    expect(html).not.toContain("Demo");
  });

  it("reports an error with a retry instead of inventing results", () => {
    configure(
      { user },
      { "membership.me": state(member), "mentorship.matches": state(undefined, false, "Service unavailable.") },
    );
    const html = renderToStaticMarkup(createElement(MatchesBoard));
    expect(html).toContain("Service unavailable.");
    expect(html).toContain("Retry matches");
    expect(html).not.toContain("Ada Mentor");
  });
});

describe("retry paths for every query", () => {
  it("discovery offers a retry when the profile query fails", () => {
    configure({ user }, { "membership.me": state(undefined, false, "Profile service unavailable.") });
    const html = renderToStaticMarkup(createElement(DiscoveryBoard));
    expect(html).toContain("Profile service unavailable.");
    expect(html).toContain("Retry profile");
  });

  it("matches list offers a retry when the profile query fails", () => {
    configure({ user }, { "membership.me": state(undefined, false, "Profile service unavailable.") });
    const html = renderToStaticMarkup(createElement(MatchesBoard));
    expect(html).toContain("Profile service unavailable.");
    expect(html).toContain("Retry profile");
  });

  it("portal home offers a retry when the profile query fails", () => {
    configure({ user }, { "membership.me": state(undefined, false, "Profile service unavailable.") });
    const html = renderToStaticMarkup(createElement(PortalHome));
    expect(html).toContain("Profile service unavailable.");
    expect(html).toContain("Retry profile");
  });

  it("portal home offers a real retry when the matches query fails", () => {
    configure(
      { user },
      {
        "membership.me": state(member),
        "mentorship.matches": state(undefined, false, "Match service unavailable."),
      },
    );
    const html = renderToStaticMarkup(createElement(PortalHome));
    expect(html).toContain("Match service unavailable.");
    expect(html).toContain("Retry matches");
  });
});
