"use client";

import { Hero } from "@/components/site/Hero";
import { LandingSections } from "@/components/site/LandingSections";
import { SiteLoading } from "@/components/site/states";
import { usePublicSite } from "@/components/site/usePublicSite";

export default function HomePage() {
  const site = usePublicSite();

  if (site.loading) {
    return <SiteLoading label="Loading the TechWomenAZ experience…" />;
  }

  const hero = site.data.document.sections.find(
    (section) => section.type === "hero" && section.enabled,
  );

  return (
    <main>
      <Hero section={hero} />
      <LandingSections site={site} />
    </main>
  );
}
