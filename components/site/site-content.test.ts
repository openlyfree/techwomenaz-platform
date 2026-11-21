import { describe, expect, it } from "vitest";
import type { EventRecord, SiteDocument, SiteSection } from "@/lib/contracts";
import {
  SITE_LINKS,
  formatEventDateRange,
  getDefaultSiteContent,
  isPastEvent,
  partitionEvents,
  safeHref,
  selectSections,
} from "./content";

const section = (id: string, type: SiteSection["type"], enabled = true): SiteSection => ({
  id,
  type,
  title: id,
  body: "",
  enabled,
});

describe("partitionEvents", () => {
  const events: EventRecord[] = [
    {
      id: "past",
      title: "Past workshop",
      date: "2026-10-26",
      endDate: "2026-11-16",
      description: "",
      location: "",
      registerUrl: "",
    },
    {
      id: "today",
      title: "Ends today",
      date: "2026-11-21",
      description: "",
      location: "",
      registerUrl: "",
    },
    {
      id: "future",
      title: "Future workshop",
      date: "2026-12-01",
      description: "",
      location: "",
      registerUrl: "",
    },
  ];

  it("treats an event whose end date is before today as past", () => {
    expect(isPastEvent(events[0]!, new Date("2026-11-21T12:00:00Z"))).toBe(true);
  });

  it("treats an event ending today as not past", () => {
    expect(isPastEvent(events[1]!, new Date("2026-11-21T12:00:00Z"))).toBe(false);
  });

  it("splits events into upcoming and past without duplicating any", () => {
    const result = partitionEvents(events, new Date("2026-11-21T12:00:00Z"));
    expect(result.upcoming.map((event) => event.id)).toEqual(["today", "future"]);
    expect(result.past.map((event) => event.id)).toEqual(["past"]);
    expect(result.upcoming.length + result.past.length).toBe(events.length);
  });
});

describe("formatEventDateRange", () => {
  it("formats a multi-month range with a single year", () => {
    expect(
      formatEventDateRange({
        id: "x",
        title: "x",
        date: "2026-10-26",
        endDate: "2026-11-16",
        description: "",
        location: "",
        registerUrl: "",
      }),
    ).toBe("Oct 26 – Nov 16, 2026");
  });

  it("formats a single date", () => {
    expect(
      formatEventDateRange({
        id: "x",
        title: "x",
        date: "2026-12-01",
        description: "",
        location: "",
        registerUrl: "",
      }),
    ).toBe("Dec 1, 2026");
  });
});

describe("safeHref", () => {
  it("keeps https links and local paths", () => {
    expect(safeHref("https://givebutter.com/VStKv8")).toBe("https://givebutter.com/VStKv8");
    expect(safeHref("/events")).toBe("/events");
  });

  it("rejects javascript and protocol-relative URLs", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("//evil.example.com")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});

describe("selectSections", () => {
  it("returns only enabled sections of the requested types, preserving order", () => {
    const document: SiteDocument = {
      version: 1,
      theme: "desert",
      sections: [
        section("hero-1", "hero"),
        section("mission-1", "mission"),
        section("programs-1", "programs"),
        section("team-1", "team", false),
      ],
    };
    expect(selectSections(document, ["mission", "programs"]).map((item) => item.id)).toEqual([
      "mission-1",
      "programs-1",
    ]);
  });

  it("includes disabled sections only in preview mode", () => {
    const document: SiteDocument = {
      version: 1,
      theme: "desert",
      sections: [section("team-1", "team", false)],
    };
    expect(selectSections(document, ["team"])).toHaveLength(0);
    expect(selectSections(document, ["team"], true)).toHaveLength(1);
  });
});

describe("getDefaultSiteContent", () => {
  it("uses only publicly sourced content with no invented member counts", () => {
    const content = getDefaultSiteContent();
    expect(content.demo).toBe(true);
    expect(content.events).toHaveLength(1);
    expect(content.events[0]?.title).toBe("TWAZ Finance Series");
    expect(content.team).toHaveLength(9);
    expect(content.team.map((member) => member.name)).toContain("Melissa Drake");
    expect(content.partners.map((partner) => partner.name)).toContain("Seluro");
    expect(JSON.stringify(content)).not.toMatch(/\b\d{2,} members\b/i);
  });
});

describe("public site content parity with techwomenaz.org", () => {
  it("uses exactly the section titles published on the live site, with no invented section", () => {
    const titles = getDefaultSiteContent().document.sections.map((item) => item.title);
    expect(titles).toEqual([
      "Empowering women in Arizona's tech ecosystem",
      "Our story",
      "A place for you at every stage of your tech journey",
      "Learn, connect, and grow with us",
      "Help every woman in tech find a seat at the table",
      "The volunteers behind TechWomenAZ",
      "Thank you to our supporters",
      "Say hello",
    ]);
  });

  it("does not invent body copy for sections that have no body on the live site", () => {
    const sections = getDefaultSiteContent().document.sections;
    expect(sections.find((item) => item.id === "events")?.body).toBe("");
    expect(sections.find((item) => item.id === "team")?.body).toBe("");
  });

  it("maps the event details string from content/site.json verbatim into location", () => {
    expect(getDefaultSiteContent().events[0]?.location).toBe(
      "Free · Online via Zoom · With Elevate Wealth Partners",
    );
  });

  it("keeps every sourced team name, role and photo", () => {
    expect(getDefaultSiteContent().team.map((member) => [member.name, member.role, member.photo])).toEqual([
      ["Aditi Madane", "Board Chair", "https://techwomenaz.org/images/aditi.jpg"],
      ["Mari Gonzalez", "Board Vice-Chair", "https://techwomenaz.org/images/mari.jpeg"],
      ["Melissa Drake", "Executive Director", "https://techwomenaz.org/images/melissa.jpeg"],
      ["Sruthi Rajan", "Board Secretary", "https://techwomenaz.org/images/sruthi.jpg"],
      ["Melissa Diaz", "Treasurer", "https://techwomenaz.org/images/melissa-diaz.webp"],
      ["Zena Alalak", "Recruitment Committee Chair", "https://techwomenaz.org/images/zena.webp"],
      ["Nelly Ayllon", "Marketing Committee Chair", "https://techwomenaz.org/images/nelly.webp"],
      ["Komal Chhibbler", "Programs Committee Chair", "https://techwomenaz.org/images/komal.jpeg"],
      ["Marie Willis", "Fundraising Committee Chair", "https://techwomenaz.org/images/marie.webp"],
    ]);
  });

  it("keeps every sourced partner name and logo", () => {
    expect(getDefaultSiteContent().partners.map((partner) => [partner.name, partner.logo])).toEqual([
      ["High Rock Accounting", "https://techwomenaz.org/images/partner-hra.png"],
      ["Wise Cat Business Services", "https://techwomenaz.org/images/partner-2.png"],
      ["Seluro", "https://techwomenaz.org/images/partner-seluro.png"],
      ["CSA Arizona Chapter", "https://techwomenaz.org/images/partner-4.jpg"],
    ]);
  });

  it("keeps the public site links, including Givebutter and the footer Candid profile", () => {
    expect(SITE_LINKS).toEqual({
      donate: "https://givebutter.com/VStKv8",
      membership: "https://forms.gle/qVG6HHXMBRN1axN96",
      email: "info@techwomenaz.org",
      instagram: "https://www.instagram.com/techwomenaz",
      linkedin: "https://www.linkedin.com/company/106737268/",
      candid: "https://app.candid.org/profile/9926254/tech-women-az-84-4682179/",
    });
  });

  it("keeps the sourced event title, dates, description, sessions and real Luma link", () => {
    const event = getDefaultSiteContent().events[0];
    expect(event?.title).toBe("TWAZ Finance Series");
    expect(event?.date).toBe("2026-10-26");
    expect(event?.endDate).toBe("2026-11-16");
    expect(event?.description).toBe(
      "Free finance sessions to help you build confidence with money at every stage of life.\n" +
        "Oct 26 — Money 101: Building a Strong Financial Foundation\n" +
        "Nov 2 — Financial Education for Children: Start Them Strong\n" +
        "Nov 9 — Retirement Planning: Prepare Today, Enjoy Tomorrow\n" +
        "Nov 16 — Entrepreneurship: Turn Your Vision Into a Business",
    );
    expect(event?.registerUrl).toBe("https://luma.com/52nzzzbq");
  });
});
