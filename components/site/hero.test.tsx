import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSite } from "@/lib/contracts";
import { getDefaultSiteContent } from "./content";
import { Hero } from "./Hero";
import { LandingSections } from "./LandingSections";
import { SiteRenderer } from "./SiteRenderer";
import type { PublicSiteState } from "./usePublicSite";

function stateFor(data: PublicSite, overrides: Partial<PublicSiteState> = {}): PublicSiteState {
  return {
    data,
    loading: false,
    error: null,
    usingFallback: false,
    refresh: () => {},
    ...overrides,
  };
}

function h1Count(html: string): number {
  return html.match(/<h1\b/g)?.length ?? 0;
}

describe("immersive landing hero", () => {
  it("renders the editorial headline, seeded public.site copy and real CTAs", () => {
    const site = getDefaultSiteContent();
    const hero = site.document.sections.find((section) => section.type === "hero");
    const html = renderToStaticMarkup(<Hero section={hero} />);

    expect(html).toContain("Find your people. Grow your possibilities.");
    expect(html).toContain("Empowering women in Arizona&#x27;s tech ecosystem");
    expect(html).toContain("TechWomenAZ is a community committed to helping women thrive");
    expect(html).toContain('href="/join"');
    expect(html).toContain('href="/about"');
    expect(html).toContain("https://givebutter.com/VStKv8");
    expect(html).toContain("<h1");
    expect(html).toContain("twaz-hero__scrim");
  });

  it("renders nothing when no hero section is published (empty state)", () => {
    expect(renderToStaticMarkup(<Hero section={undefined} />)).toBe("");
  });
});

describe("landing sections", () => {
  it("omits the duplicate flat hero but keeps the dynamic public.site flow", () => {
    const site = getDefaultSiteContent();
    const html = renderToStaticMarkup(<LandingSections site={stateFor(site)} />);

    expect(html).not.toContain("TechWomenAZ is a community committed to helping women thrive");
    expect(html).toContain("Our story");
    expect(html).toContain("Skill Development");
    expect(html).toContain("TWAZ Finance Series");
    expect(html).toContain("Melissa Drake");
    expect(html).toContain("High Rock Accounting");
    expect(html).toContain("Say hello");
    expect(html).toContain("https://givebutter.com/VStKv8");
  });

  it("shows an actionable notice when the live service errors, with sourced copy as content", () => {
    const site = getDefaultSiteContent();
    const html = renderToStaticMarkup(
      <LandingSections
        site={stateFor(site, { usingFallback: true, error: "Upstream timeout", data: site })}
      />,
    );
    expect(html).toContain("Live site content is unavailable right now");
    expect(html).toContain("Upstream timeout");
    expect(html).toContain("Retry live content");
    expect(html).toContain("Our story");
  });

  it("shows a truthful empty state when no sections are published", () => {
    const site = getDefaultSiteContent();
    const empty: PublicSite = {
      ...site,
      document: { ...site.document, sections: [] },
    };
    const html = renderToStaticMarkup(<LandingSections site={stateFor(empty)} />);
    expect(html).toContain("The site has not been published yet");
  });
});

describe("single h1 on the composed landing page", () => {
  it("renders exactly one h1 — the hero headline — after the section flow", () => {
    const site = getDefaultSiteContent();
    const hero = site.document.sections.find((section) => section.type === "hero");
    const html = renderToStaticMarkup(
      <>
        <Hero section={hero} />
        <LandingSections site={stateFor(site)} />
      </>,
    );

    expect(h1Count(html)).toBe(1);
    expect(html).toContain("Find your people. Grow your possibilities.");
    expect(html).toContain("<h2");
  });
});

describe("SiteRenderer heading compatibility", () => {
  it("keeps standalone behavior unchanged when sectionsLevel2 is omitted", () => {
    const site = getDefaultSiteContent();
    const html = renderToStaticMarkup(<SiteRenderer document={site.document} />);
    expect(h1Count(html)).toBe(1);
    expect(html).toContain("Empowering <em");
    expect(html).toContain("Arizona&#x27;s tech ecosystem");
  });

  it("forces every section heading to level 2 when sectionsLevel2 is set", () => {
    const site = getDefaultSiteContent();
    const sections = site.document.sections.filter((section) => section.type !== "hero");
    const html = renderToStaticMarkup(
      <SiteRenderer document={{ ...site.document, sections }} sectionsLevel2 />,
    );
    expect(h1Count(html)).toBe(0);
    expect(html).toContain("<h2");
  });
});
