"use client";

import { SitePage } from "@/components/site/SitePage";

export default function ContactPage() {
  return (
    <SitePage
      types={["contact"]}
      emptyMessage="Contact details have not been published yet. Please check back soon."
    />
  );
}
