"use client";

import { SiteDemoNotice, SiteEmpty, SiteFallbackNotice } from "./states";
import { SiteRenderer } from "./SiteRenderer";
import type { PublicSiteState } from "./usePublicSite";

export interface LandingSectionsProps {
  /** Resolved state from the shared `usePublicSite()` call on the landing page. */
  site: PublicSiteState;
  emptyMessage?: string;
}

/**
 * The published `public.site` section flow below the immersive hero.
 * The hero section is consumed by <Hero /> instead of being rendered twice,
 * while SiteRenderer keeps driving every remaining section and record.
 */
export function LandingSections({
  site,
  emptyMessage = "The site has not been published yet. Please check back soon.",
}: LandingSectionsProps) {
  const { data, usingFallback, error, refresh } = site;
  const sections = data.document.sections.filter(
    (section) => section.type !== "hero" && section.enabled,
  );

  return (
    <>
      {usingFallback ? <SiteFallbackNotice detail={error} onRetry={refresh} /> : null}
      {data.demo && !usingFallback ? <SiteDemoNotice /> : null}
      {sections.length ? (
        <SiteRenderer
          document={{ ...data.document, sections }}
          events={data.events}
          team={data.team}
          partners={data.partners}
          sectionsLevel2
        />
      ) : (
        <SiteEmpty message={emptyMessage} title="Explore TechWomenAZ" />
      )}
    </>
  );
}

export default LandingSections;
