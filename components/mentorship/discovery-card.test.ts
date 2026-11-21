import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DiscoveryCard } from "@/lib/contracts";
import { DiscoveryCardView, swipeDecision } from "./DiscoveryCardView";
import type { DiscoveryCardViewProps } from "./DiscoveryCardView";

const candidate: DiscoveryCard = {
  id: "cand-1",
  name: "Ada Mentor",
  headline: "Staff engineer",
  // Contact details live here on the DTO but must never reach the card markup.
  bio: "Email ada@private.test or call 555-0100. Lives in Phoenix, AZ.",
  expertise: ["Security", "Mentoring"],
  goals: ["Leadership"],
  timezone: "America/Phoenix",
  availability: [{ day: 2, start: "10:00", end: "12:00" }],
  meetingFormat: "online",
  location: "Phoenix, AZ",
  reasons: ["Shared availability"],
  overlapMinutes: 120,
  source: "jev",
  confidence: 0.97,
};

function render(overrides: Partial<DiscoveryCardViewProps> = {}): string {
  const props: DiscoveryCardViewProps = {
    card: candidate,
    pending: false,
    decided: false,
    onDecide: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(DiscoveryCardView, props));
}

describe("pointer swipe decision", () => {
  it("exposes a pure, testable swipe decision helper", () => {
    expect(typeof swipeDecision).toBe("function");
  });

  it("maps a rightward horizontal swipe to Interested", () => {
    expect(swipeDecision("touch", 120, 10, true)).toBe("interested");
  });

  it("maps a leftward horizontal swipe to Pass", () => {
    expect(swipeDecision("touch", -120, 10, true)).toBe("pass");
  });

  it("ignores vertical scrolling so the browser keeps it", () => {
    expect(swipeDecision("touch", 15, 140, true)).toBeNull();
  });

  it("ignores diagonal and short drags", () => {
    expect(swipeDecision("touch", 80, 75, true)).toBeNull();
    expect(swipeDecision("touch", 30, 4, true)).toBeNull();
  });

  it("ignores mouse-pointer drags", () => {
    expect(swipeDecision("mouse", 160, 5, true)).toBeNull();
  });

  it("ignores gestures while a decision is in flight", () => {
    expect(swipeDecision("touch", 160, 5, false)).toBeNull();
  });

  it("ignores gestures after the server confirmed a decision", () => {
    expect(swipeDecision("touch", -160, 5, false)).toBeNull();
  });
});

describe("accessible decision controls", () => {
  it("always renders both native Interested and Pass buttons", () => {
    const html = render();
    expect(html).toContain("Interested");
    expect(html).toContain("Pass");
    expect((html.match(/<button/g) ?? []).length).toBe(2);
  });

  it("keeps both controls enabled while idle", () => {
    expect((render().match(/disabled=""/g) ?? []).length).toBe(0);
  });

  it("disables both controls while the request is in flight", () => {
    const html = render({ pending: true });
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  it("disables both controls after a server-confirmed decision", () => {
    const html = render({ decided: true });
    expect(html).toContain("Decision saved");
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  it("reports aria-busy when idle and never offers a fake undo", () => {
    const html = render();
    expect(html).toContain('aria-busy="false"');
    expect(html).not.toMatch(/undo/i);
  });

  it("gives both buttons an explicit 44px-or-larger touch target", () => {
    const html = render();
    expect((html.match(/min-h-\[44px\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps button transitions off for reduced-motion users", () => {
    const html = render();
    expect(html).toContain("motion-reduce:transition-none");
  });
});

describe("touch and motion contract", () => {
  it("declares pan-y touch handling so vertical scroll is not hijacked", () => {
    expect(render()).toContain("touch-action:pan-y");
  });

  it("guards motion to hover-capable, motion-safe devices", () => {
    const html = render();
    expect(html).toContain("motion-safe:transition-shadow");
    expect(html).toContain("motion-safe:hover:");
    expect(html).toContain("motion-reduce:transition-none");
  });
});

describe("professional context only", () => {
  it("shows the server's professional fields with honest overlap minutes", () => {
    const html = render();
    expect(html).toContain("Ada Mentor");
    expect(html).toContain("Staff engineer");
    expect(html).toContain("Security");
    expect(html).toContain("Leadership");
    expect(html).toContain("Tue 10:00–12:00");
    expect(html).toContain("Online · America/Phoenix");
    expect(html).toContain("Shared availability");
    expect(html).toContain("Jev-assisted ranking");
    expect(html).toContain("2 h of overlapping availability");
  });

  it("never leaks contact details, location, confidence or a match score", () => {
    const html = render();
    expect(html).not.toContain("ada@private.test");
    expect(html).not.toContain("555-0100");
    expect(html).not.toContain("Phoenix, AZ");
    expect(html).not.toMatch(/confidence/i);
    expect(html).not.toContain("97");
    expect(html).not.toContain("%");
    expect(html).not.toMatch(/match score/i);
  });
});

describe("mobile-first layout", () => {
  it("uses min-w-0 and small-screen breakpoints instead of horizontal overflow", () => {
    const html = render();
    expect(html).toContain("min-w-0");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("flex-wrap");
  });
});
