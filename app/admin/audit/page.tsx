"use client";

import { useState } from "react";
import { useQuery } from "@/lib/api";
import type { AuditEvent } from "@/lib/contracts";
import { Badge, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { errorText } from "@/components/admin/format";

const ACTION_VARIANT: Record<string, string> = {
  "membership.approved": "success",
  "membership.paused": "warning",
  "match.approved": "success",
  "match.declined": "danger",
  "content.saved": "neutral",
  "content.published": "primary",
  "event.saved": "neutral",
  "import.committed": "primary",
};

function formatStamp(value: string): string {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminAuditPage() {
  const audit = useQuery<AuditEvent[]>("audit.list");
  const [filter, setFilter] = useState("");

  const events = (audit.data ?? []).filter((event) =>
    filter.trim().length === 0 ||
    `${event.actorName} ${event.action} ${event.summary}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading
        eyebrow="ACCOUNTABILITY"
        title="Audit log"
        description="Every staff action that changes member records, matches, published content, events or imports is recorded here automatically. Entries cannot be edited or removed from the app."
      />

      <div className="mb-6">
        <label htmlFor="audit-search" className="mb-1 block text-[13px] font-semibold">Filter entries</label>
        <input
          id="audit-search"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="e.g. content, approve, or a staff name"
          className="min-h-[44px] w-full min-w-0 rounded-lg border border-[#d8d2c8] bg-white px-3 py-2"
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">{events.length} audit entries shown</p>

      {audit.loading ? <Loading label="Loading the audit log…" /> : null}
      {audit.error ? <ErrorNotice message={errorText(audit.error)} onRetry={audit.refresh} /> : null}
      {!audit.loading && !audit.error && events.length === 0 ? (
        <EmptyState
          title={filter ? "No entries match that filter" : "No staff activity recorded yet"}
          description={filter ? "Clear the filter to see the newest entries." : "Actions like approving a match or publishing content will appear here automatically."}
        />
      ) : null}

      <ol className="m-0 grid list-none gap-3 p-0">
        {events.map((event) => (
          <li key={event.id}>
            <Card className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION_VARIANT[event.action] ?? "neutral"}>{event.action}</Badge>
                  <span className="text-[0.85rem] font-semibold">{event.actorName}</span>
                </div>
                <p className="m-0 mt-1 text-[0.9rem] text-[#49382E]">{event.summary}</p>
              </div>
              <time dateTime={event.createdAt} className="whitespace-nowrap text-[0.78rem] text-[#6B5E56]">
                {formatStamp(event.createdAt)}
              </time>
            </Card>
          </li>
        ))}
      </ol>
    </main>
  );
}
