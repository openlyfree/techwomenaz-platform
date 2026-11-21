"use client";

import { Hero } from "@/components/site/Hero";
import { LandingSections } from "@/components/site/LandingSections";
import { SiteBackdropMount } from "@/components/site/SiteBackdropMount";
import { SiteLoading } from "@/components/site/states";
import { usePublicSite } from "@/components/site/usePublicSite";

export default function HomePage() {
  const site = usePublicSite();

  const hero = site.data.document.sections.find(
    (section) => section.type === "hero" && section.enabled,
  );

  return (
    <main>
      <SiteBackdropMount />
      <div className="twaz-parallax-host relative z-[1]">
        {site.loading ? (
          <SiteLoading label="Loading the TechWomenAZ experience…" />
        ) : (
          <>
            <Hero section={hero} />
            <LandingSections site={site} />
          </>
        )}
      </div>
    </main>
  );
}
