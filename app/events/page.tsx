"use client";

import { SitePage } from "@/components/site/SitePage";

export default function EventsPage() {
  return (
    <SitePage
      types={["events"]}
      emptyMessage="Events have not been published yet. Follow us on Instagram or LinkedIn to hear first."
    />
  );
}
