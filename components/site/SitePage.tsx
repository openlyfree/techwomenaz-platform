"use client";

import type { SiteSection } from "@/lib/contracts";
import { selectSections } from "./content";
import { SiteRenderer } from "./SiteRenderer";
import { SiteDemoNotice, SiteEmpty, SiteFallbackNotice, SiteLoading } from "./states";
import { usePublicSite } from "./usePublicSite";

export interface SitePageProps {
  types?: SiteSection["type"][];
  includeAll?: boolean;
  emptyMessage?: string;
}

const EMPTY_TITLES: Partial<Record<SiteSection["type"], string>> = {
  mission: "About TechWomenAZ",
  programs: "About TechWomenAZ",
  team: "About TechWomenAZ",
  events: "Events",
  mentorship: "Mentorship",
  partners: "Our supporters",
  contact: "Contact",
};

/** Shared loading / error / empty handling for every public leaf page. */
export function SitePage({
  types = [],
  includeAll = false,
  emptyMessage = "This part of the site has not been published yet. Please check back soon.",
}: SitePageProps) {
  const { data, loading, error, usingFallback, refresh } = usePublicSite();

  if (loading) return <SiteLoading />;

  const sections = includeAll ? data.document.sections : selectSections(data.document, types);
  const emptyTitle = types.map((type) => EMPTY_TITLES[type]).find(Boolean) ?? "Not available yet";

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
        />
      ) : (
        <SiteEmpty message={emptyMessage} title={emptyTitle} />
      )}
    </>
  );
}
