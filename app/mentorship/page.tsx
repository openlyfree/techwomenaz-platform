"use client";

import { SitePage } from "@/components/site/SitePage";

export default function MentorshipPage() {
  return (
    <SitePage
      types={["mentorship"]}
      emptyMessage="Mentorship information has not been published yet. Please check back soon."
    />
  );
}
