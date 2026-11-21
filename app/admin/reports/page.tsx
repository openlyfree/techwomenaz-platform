"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/lib/api";
import type { Statistics } from "@/lib/contracts";
import type { IntegrationStatus } from "@/components/admin/integrations";
import { Badge, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { errorText, formatNumber, formatShortDate, trendPoints } from "@/components/admin/format";
import { meetingRate, statCards, trendTotal } from "@/components/admin/report-utils";

export default function AdminReportsPage() {
  const stats = useQuery<Statistics>("admin.stats");
  const integrations = useQuery<IntegrationStatus>("admin.integrations");
  const [notice, setNotice] = useState("");

  function refreshReports() {
    setNotice("Report data refreshed.");
    void stats.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-8 grid gap-3 border-b border-[#E1D2C7] pb-7">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">TechWomenAZ · Reporting</p>
        <PageHeading
          title="Reports"
          description="Every number below is read from stored records. No projected reach or invented impact is shown."
        />
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLike href="/admin" label="Back to dashboard" />
          <Badge>Record-based</Badge>
          {integrations.data?.demo ? <Badge>Sample data · demo mode</Badge> : null}
        </div>
      </header>

      {/* Live region is always mounted so a screen reader announces later confirmations. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={notice ? "m-0 mb-4 rounded-[6px] border border-[#B7C9A8] bg-[#F2F8EC] px-4 py-3 text-[0.92rem] text-[#37522B]" : "sr-only"}
      >
        {notice}
      </p>

      {stats.loading ? <Loading label="Loading report data…" /> : null}
      {stats.error ? <ErrorNotice message={errorText(stats.error)} /> : null}
      {!stats.loading && !stats.error && !stats.data ? (
        <EmptyState
          title="No report data available"
          description="Connect the database and record real activity to see statistics here."
        />
      ) : null}

      {stats.data ? (
        <div className="grid gap-7">
          <section aria-labelledby="summary-heading" className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="summary-heading" className="m-0 text-[1.6rem] font-normal text-[#C85512]">Program summary</h2>
              <button
                className="inline-flex min-h-[44px] items-center rounded-full border border-[#DE6219] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C85512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]"
                onClick={refreshReports}
                type="button"
              >
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statCards(stats.data).map((card) => (
                <Card key={card.key} className="min-w-0 p-4">
                  <p className="m-0 text-[0.72rem] font-semibold uppercase leading-[1.4] tracking-[0.12em] text-[#6B5E56]">{card.label}</p>
                  <p className="m-0 mt-2 text-[1.8rem] leading-none text-[#C85512]">{formatNumber(card.value)}</p>
                  <p className="m-0 mt-2 text-[0.78rem] leading-[1.4] text-[#6B5E56]">{card.hint}</p>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="meetings-heading" className="grid gap-4 sm:grid-cols-2">
            <Card className="grid gap-3 p-5">
              <h2 id="meetings-heading" className="m-0 text-[1.2rem] font-normal text-[#22395A]">Meetings recorded</h2>
              <p className="m-0 text-[2.4rem] leading-none text-[#DE6219]">{meetingRate(stats.data)}%</p>
              <p className="m-0 text-[0.9rem] leading-[1.6] text-[#6B5E56]">
                {formatNumber(stats.data.recordedMeetings)} recorded meetings across {formatNumber(stats.data.activeMatches)} active matches. This share is capped at 100% because one match can log several meetings. Check-ins reflect submitted reflections only.
              </p>
            </Card>
            <Card className="grid gap-3 p-5">
              <h2 className="m-0 text-[1.2rem] font-normal text-[#22395A]">Applications in review</h2>
              <p className="m-0 text-[2.4rem] leading-none text-[#DE6219]">{formatNumber(stats.data.pendingApplications)}</p>
              <p className="m-0 text-[0.9rem] leading-[1.6] text-[#6B5E56]">
                {formatNumber(stats.data.pendingMatches)} matches are awaiting coordinator review. Participant decisions are shown as recorded, not inferred.
              </p>
              <div>
                <ButtonLike href="/admin/members" label="Review applications" />
              </div>
            </Card>
          </section>

          <section aria-labelledby="trend-heading" className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="trend-heading" className="m-0 text-[1.6rem] font-normal text-[#C85512]">Signup trend</h2>
                <p className="m-0 mt-1 text-[0.9rem] text-[#6B5E56]">
                  {formatNumber(trendTotal(stats.data.signupTrend))} signups across {stats.data.signupTrend.length} recorded days.
                </p>
              </div>
            </div>
            {stats.data.signupTrend.length ? (
              <>
                <Card className="p-5">
                  <svg aria-label="Signups by day" className="h-28 w-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      points={trendPoints(stats.data.signupTrend, 100, 20)}
                      stroke="#DE6219"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </Card>
                {/* Below md: one labeled card per recorded day; every table column is preserved. */}
                <div className="grid gap-2 md:hidden">
                  {stats.data.signupTrend.map((point: Statistics["signupTrend"][number]) => (
                    <Card key={point.date} className="min-w-0 p-4">
                      <dl className="m-0 grid grid-cols-2 gap-3 text-[0.92rem]">
                        <div className="min-w-0">
                          <dt className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Date</dt>
                          <dd className="m-0 mt-1 break-words text-[#22395A]">{formatShortDate(point.date)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">New members</dt>
                          <dd className="m-0 mt-1 break-words text-[#C85512]">{formatNumber(point.count)}</dd>
                        </div>
                      </dl>
                    </Card>
                  ))}
                </div>
                {/* md and up: semantic table, horizontally scrollable on narrower tablets. */}
                <Card className="hidden overflow-hidden p-0 md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-left text-[0.92rem]">
                      <thead className="bg-[#F8F3EE] text-[0.72rem] uppercase tracking-[0.12em] text-[#6B5E56]">
                        <tr><th className="p-4 font-semibold">Date</th><th className="p-4 font-semibold">New members</th></tr>
                      </thead>
                      <tbody>
                        {stats.data.signupTrend.map((point: Statistics["signupTrend"][number]) => (
                          <tr className="border-t border-[#E1D2C7]" key={point.date}>
                            <td className="p-4 text-[#22395A]">{formatShortDate(point.date)}</td>
                            <td className="p-4 text-[#C85512]">{formatNumber(point.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <EmptyState title="No signups recorded yet" description="The trend will fill in as members join." />
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ButtonLike({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="inline-flex min-h-[44px] items-center rounded-full border border-[#DE6219] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C85512] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]"
      href={href}
    >
      {label}
    </Link>
  );
}
