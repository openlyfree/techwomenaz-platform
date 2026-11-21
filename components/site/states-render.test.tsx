import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSite } from "@/lib/contracts";
import { getDefaultSiteContent } from "./content";
import {
  SiteDemoNotice,
  SiteEmpty,
  SiteErrorNotice,
  SiteFallbackNotice,
  SiteLoading,
} from "./states";
import { resolvePublicSiteState } from "./usePublicSite";

describe("public site page states", () => {
  it("renders a truthful, announced loading state without showing content", () => {
    const html = renderToStaticMarkup(<SiteLoading label="Fetching published content…" />);
    expect(html).toContain("Fetching published content…");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("Empowering");
  });

  it("announces an API error and offers a retry", () => {
    const html = renderToStaticMarkup(
      <SiteErrorNotice
        message="The site service is temporarily unavailable."
        onRetry={() => {}}
      />,
    );
    expect(html).toContain("The site service is temporarily unavailable.");
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
  });

  it("labels fallback and demo notices honestly and accessibly", () => {
    const fallback = renderToStaticMarkup(
      <SiteFallbackNotice detail="Upstream timeout" onRetry={() => {}} />,
    );
    expect(fallback).toContain("Live site content is unavailable right now");
    expect(fallback).toContain("Retry live content");
    expect(fallback).toContain('role="status"');
    expect(fallback).toContain('aria-live="polite"');
    expect(fallback).not.toContain("showing live content");

    const demo = renderToStaticMarkup(<SiteDemoNotice />);
    expect(demo).toContain("demo content");
    expect(demo).toContain('role="status"');
    expect(demo).not.toContain("live content");
  });

  it("renders a truthful empty-section state with a way back", () => {
    const html = renderToStaticMarkup(<SiteEmpty message="No events are published yet." />);
    expect(html).toContain("No events are published yet.");
    expect(html).toContain('href="/"');
  });

  it("never presents stale live records as sourced brand copy after an API error", () => {
    const brand = getDefaultSiteContent();
    const stale: PublicSite = {
      ...brand,
      demo: false,
      document: {
        ...brand.document,
        sections: [
          { id: "stale", type: "hero", title: "STALE LIVE HEADLINE", body: "stale", enabled: true },
        ],
      },
      events: [],
      team: [],
      partners: [],
    };

    const failed = resolvePublicSiteState(stale, false, "Service unavailable", brand);
    expect(failed.usingFallback).toBe(true);
    expect(failed.error).toBe("Service unavailable");
    expect(failed.data).toBe(brand);
    expect(JSON.stringify(failed.data)).not.toContain("STALE LIVE HEADLINE");

    const pending = resolvePublicSiteState(stale, true, null, brand);
    expect(pending.usingFallback).toBe(false);
    expect(pending.data).toBe(stale);

    const live = resolvePublicSiteState(stale, false, null, brand);
    expect(live.usingFallback).toBe(false);
    expect(live.data).toBe(stale);
  });
});
