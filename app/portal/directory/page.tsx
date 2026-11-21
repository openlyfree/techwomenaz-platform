"use client";

import { useState } from "react";
import { useQuery } from "@/lib/api";
import type { DirectoryEntry } from "@/lib/contracts";
import { Badge, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { errorText } from "@/components/admin/format";

const FORMAT_LABEL: Record<DirectoryEntry["meetingFormat"], string> = {
  online: "Meets online",
  "in-person": "Meets in person",
  either: "Online or in person",
};

export default function PortalDirectoryPage() {
  const directory = useQuery<DirectoryEntry[]>("directory.list");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "mentor" | "mentee">("all");

  const entries = (directory.data ?? []).filter((entry) => {
    if (roleFilter === "mentor" && !["mentor", "both"].includes(entry.participation)) return false;
    if (roleFilter === "mentee" && !["mentee", "both"].includes(entry.participation)) return false;
    const haystack = [entry.name, entry.headline, entry.location, ...entry.expertise, ...entry.goals, ...entry.interests].join(" ").toLowerCase();
    return search.trim().length === 0 || haystack.includes(search.trim().toLowerCase());
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading
        eyebrow="COMMUNITY DIRECTORY"
        title="Member directory"
        description="Professional profiles shared by members who chose to be discoverable. Contact details stay private — connect through mentorship discovery to reach someone."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 grow">
          <label htmlFor="directory-search" className="mb-1 block text-[13px] font-semibold">Search profiles</label>
          <input
            id="directory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. Learning AI, Phoenix, product management"
            className="min-h-[44px] w-full min-w-0 rounded-lg border border-[#d8d2c8] bg-white px-3 py-2"
          />
        </div>
        <fieldset className="flex gap-2" role="radiogroup" aria-label="Filter by participation">
          <legend className="sr-only">Filter by participation</legend>
          {([["all", "Everyone"], ["mentor", "Mentors"], ["mentee", "Mentees"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={roleFilter === value}
              onClick={() => setRoleFilter(value)}
              className={`min-h-[44px] rounded-full border px-4 text-[13px] font-semibold ${roleFilter === value ? "border-[#DE6219] bg-[#DE6219] text-white" : "border-[#d8d2c8] bg-white text-[#49382E]"}`}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {entries.length} profiles shown
      </p>

      {directory.loading ? <Loading label="Loading the directory…" /> : null}
      {directory.error ? <ErrorNotice message={errorText(directory.error)} onRetry={directory.refresh} /> : null}
      {!directory.loading && !directory.error && entries.length === 0 ? (
        <EmptyState
          title={search ? "No profiles match that search" : "No discoverable profiles yet"}
          description={search ? "Try a broader term, or clear the search to see everyone." : "Members appear here once they set their profile to discoverable."}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <Card key={entry.id} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={entry.participation === "mentee" ? "navy" : "orange"}>
                {entry.participation === "both" ? "Mentor + mentee" : entry.participation === "mentor" ? "Mentor" : "Mentee"}
              </Badge>
              <Badge>{FORMAT_LABEL[entry.meetingFormat]}</Badge>
              {entry.location ? <Badge variant="neutral">{entry.location}</Badge> : null}
            </div>
            <div>
              <h2 className="m-0 text-[1.1rem] font-semibold">{entry.name}</h2>
              {entry.headline ? <p className="m-0 text-[0.9rem] text-[#6B5E56]">{entry.headline}</p> : null}
            </div>
            {entry.expertise.length > 0 ? (
              <p className="m-0 text-[0.85rem]"><strong>Offers:</strong> {entry.expertise.join(", ")}</p>
            ) : null}
            {entry.goals.length > 0 ? (
              <p className="m-0 text-[0.85rem]"><strong>Looking for:</strong> {entry.goals.join(", ")}</p>
            ) : null}
            {entry.interests.length > 0 ? (
              <p className="m-0 text-[0.85rem] text-[#6B5E56]">Interests: {entry.interests.join(", ")}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </main>
  );
}
