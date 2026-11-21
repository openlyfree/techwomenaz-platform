import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Checkin,
  DiscoveryCard,
  DiscoveryResult,
  Match,
  Member,
  SessionUser,
} from "@/lib/contracts";

/**
 * Quality-polish slice F — portal mentorship UX regression guards.
 *
 * MOCKS (explicit, not production systems):
 *  - `@/lib/api` is replaced by vi.fn boundaries. No network, tRPC, session
 *    store, database or real mutation runs in this file.
 *  - `next/link` is replaced by a plain-child stand-in; this harness has no
 *    Next.js package installed.
 *  - Rendering is React server static markup. No jsdom/DOM is installed, so
 *    click handlers are verified through their rendered native-button
 *    semantics and through the always-mounted polite live region. Every
 *    mutation path writes to that single region, including failures.
 */

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children as never,
}));

const api = vi.hoisted(() => ({
  useSession: vi.fn(),
  useQuery: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import { DiscoveryBoard } from "@/components/mentorship/DiscoveryBoard";
import * as matchDetailModule from "@/components/mentorship/MatchDetail";
import { decisionMessage, safeMessage } from "@/components/mentorship/utils";

const { MatchDetail, StatusNotice } = matchDetailModule;

const user: SessionUser = {
  id: "me",
  name: "Bea Member",
  email: "bea@example.test",
  role: "member",
};

const member: Member = {
  id: "me",
  name: "Bea Member",
  role: "member",
  participation: "mentee",
  status: "approved",
  headline: "Aspiring engineering lead",
  bio: "Synthetic bio for tests.",
  expertise: ["Engineering"],
  goals: ["Leadership"],
  timezone: "America/Phoenix",
  availability: [{ day: 2, start: "10:00", end: "12:00" }],
  meetingFormat: "online",
  location: "Phoenix, AZ",
  capacity: 1,
  discoverable: true,
  aiConsent: false,
  newsletterConsent: "unknown",
  createdAt: "2026-01-01T00:00:00.000Z",
  major: "",
  career: "",
  interests: [],
  interestAnswer: "",
};

const card: DiscoveryCard = {
  id: "cand-1",
  name: "Ada Mentor",
  headline: "Staff engineer",
  bio: "Synthetic bio. ada@private.test is never shown.",
  expertise: ["Security"],
  goals: ["Leadership"],
  timezone: "America/Phoenix",
  availability: [{ day: 2, start: "10:00", end: "12:00" }],
  meetingFormat: "online",
  location: "Phoenix, AZ",
  reasons: ["Shared availability"],
  overlapMinutes: 120,
  source: "jev",
  confidence: 0.9,
};

const discovery: DiscoveryResult = { cards: [card], source: "jev", notice: null };

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
const state = (data?: unknown, loading = false, error: string | null = null): QueryState => ({
  data,
  loading,
  error,
  refresh: () => {},
});

function configureSession() {
  api.useSession.mockReturnValue({ user, loading: false, error: null, refresh: () => {} });
}

function configureDiscovery() {
  configureSession();
  api.useQuery.mockImplementation((procedure: string) => {
    if (procedure === "membership.me") return state(member);
    if (procedure === "mentorship.discover") return state(discovery);
    return state(undefined);
  });
  api.mutate.mockResolvedValue({ mutual: false });
}

function configureMatch(status: Match["status"] = "active") {
  configureSession();
  api.useQuery.mockImplementation((procedure: string) => {
    if (procedure === "mentorship.matches") return state([{ ...match, status }]);
    if (procedure === "mentorship.checkins") return state([checkin]);
    return state(undefined);
  });
  api.mutate.mockResolvedValue({});
}

const renderDiscovery = () => renderToStaticMarkup(createElement(DiscoveryBoard));
const renderMatch = () => renderToStaticMarkup(createElement(MatchDetail, { id: match.id }));

/** Live-region tags and their already-rendered text, from static markup. */
const politeStatusTags = (html: string) =>
  html.match(/<p\b[^>]*aria-live="polite"[^>]*role="status"[^>]*>/g) ?? [];
const decodeEntities = (html: string) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const politeStatusText = (html: string) =>
  Array.from(
    html.matchAll(/<p\b[^>]*aria-live="polite"[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/g),
  ).map((matchResult) => decodeEntities(matchResult[1]));

describe("decision path — mocked lib/api boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureDiscovery();
  });

  it("keeps one polite status live region mounted before any decision", () => {
    expect(politeStatusTags(renderDiscovery())).toHaveLength(1);
  });

  it("announces confirmations and failures through that live region", () => {
    const messages = [
      decisionMessage(false),
      decisionMessage(true),
      safeMessage(new Error("Decision service unavailable."), "We could not save your decision. Please try again."),
    ];
    for (const message of messages) {
      const text = politeStatusText(renderToStaticMarkup(createElement(StatusNotice, { message })));
      expect(text).toHaveLength(1);
      expect(text[0]).toContain(message);
    }
  });

  it("offers Interested and Pass as native keyboard-operable buttons, not click-only divs", () => {
    const html = renderDiscovery();
    expect(html).toMatch(/<button\b[^>]*type="button"[^>]*>[\s\S]*?Interested[\s\S]*?<\/button>/);
    expect(html).toMatch(/<button\b[^>]*type="button"[^>]*>[\s\S]*?Pass[\s\S]*?<\/button>/);
    expect(html).not.toMatch(/<div\b[^>]*role="button"/);
    expect(html).toContain("min-h-[44px]");
  });

  it("keeps visible focus styling available on its own controls", () => {
    expect(renderDiscovery()).toContain("focus-visible:outline");
  });
});

describe("check-in and match detail path — mocked lib/api boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureMatch();
  });

  it("keeps one polite status live region mounted before any mutation", () => {
    expect(politeStatusTags(renderMatch())).toHaveLength(1);
  });

  it("keeps the live region mounted for paused and completed match statuses", () => {
    for (const status of ["paused", "completed"] as const) {
      configureMatch(status);
      expect(politeStatusTags(renderMatch())).toHaveLength(1);
    }
  });

  it("announces check-in, detail, pause, complete and failure messages in the live region", () => {
    const messages = [
      "Check-in saved.",
      "Match details saved.",
      "Match paused.",
      "Match completed.",
      safeMessage(new Error("Check-in service unavailable."), "We could not save your check-in. Please try again."),
    ];
    for (const message of messages) {
      const text = politeStatusText(renderToStaticMarkup(createElement(StatusNotice, { message })));
      expect(text).toHaveLength(1);
      expect(text[0]).toContain(message);
    }
  });

  it("makes the check-in form keyboard operable with native controls", () => {
    const html = renderMatch();
    expect(html).toMatch(/<form\b[^>]*>[\s\S]*?Save check-in[\s\S]*?<\/form>/);
    expect(html).toMatch(/<button\b[^>]*type="submit"[^>]*>Save check-in<\/button>/);
    expect((html.match(/<input\b[^>]*type="checkbox"/g) ?? []).length).toBe(3);
    expect(html).not.toMatch(/<div\b[^>]*role="button"/);
  });

  it("exposes save details, pause and complete as native buttons", () => {
    const html = renderMatch();
    for (const label of ["Save details", "Pause match", "Complete match"]) {
      expect(html).toMatch(
        new RegExp(`<button\\b[^>]*type="button"[^>]*>[\\s\\S]*?${label}[\\s\\S]*?<\\/button>`),
      );
    }
  });
});
