"use client";

import { SitePage } from "@/components/site/SitePage";

export default function AboutPage() {
  return (
    <SitePage
      types={["mission", "programs", "team"]}
      emptyMessage="Our story has not been published yet. Please check back soon."
    />
  );
}
