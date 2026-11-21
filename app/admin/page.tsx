"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { useQuery, useSession } from "@/lib/api";
import type { Statistics } from "@/lib/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeading,
  StatCard,
} from "@/components/ui";
import { touchTargetClass } from "@/components/admin/a11y-utils";
import { errorText, formatNumber, trendPoints } from "@/components/admin/format";
import { statCards } from "@/components/admin/report-utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";

const shortcuts = [
  { href: "/admin/content", label: "Edit site content", detail: "Draft, preview, publish and roll back", icon: FileText },
  { href: "/admin/members", label: "Review members", detail: "Approve or pause applications", icon: Users },
  { href: "/admin/mailing", label: "Newsletter drafts", detail: "Write, copy for HubSpot, export contacts", icon: Mail },
  { href: "/admin/reports", label: "Reports", detail: "Numbers queried from real records", icon: ClipboardList },
  { href: "/admin/events", label: "Events", detail: "Add and update listed events", icon: CalendarDays },
  { href: "/admin/settings", label: "Integrations", detail: "See what is actually connected", icon: Sparkles },
];

export default function AdminDashboardPage() {
  const session = useSession();
  const stats = useQuery<Statistics>("admin.stats");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  if (session.loading) {
    return <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"><Loading label="Checking your staff session…" /></main>;
  }

  if (!session.user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <PageHeading
          title="Staff dashboard"
          description="Sign in with a staff account to view applications, matches and site tools."
        />
        <Card className="mt-6 grid gap-4 p-6">
          <p className="m-0 text-[#6B5E56]">No staff session was found. We will not guess who you are or show private data.</p>
          <div>
            <Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ${focusRing}`} href="/login">
              Sign in to continue
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-8 grid gap-4 border-b border-[#E1D2C7] pb-7">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">TechWomenAZ · Staff workspace</p>
        <PageHeading
          title={`${greeting}, ${session.user.name.split(" ")[0] || "there"}.`}
          description="Here is what the current records say. Numbers come from the database, not estimates."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{session.user.role}</Badge>
          <Badge>{session.user.email}</Badge>
        </div>
      </header>

      <section aria-labelledby="today-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="today-heading" className="m-0 text-[1.6rem] font-normal text-[#C85512]">Today at a glance</h2>
          <Button className={touchTargetClass} type="button" onClick={() => void stats.refresh()}>Refresh numbers</Button>
        </div>

        {stats.error ? <ErrorNotice message={errorText(stats.error)} /> : null}
        <div aria-live="polite" aria-atomic="false">
          {stats.loading ? <Loading label="Loading statistics…" /> : null}
          {!stats.loading && !stats.error && !stats.data ? (
            <EmptyState title="No statistics yet" description="Statistics will appear once the database connection is configured." />
          ) : null}
        </div>

        {stats.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statCards(stats.data).slice(0, 8).map((card) => (
                <StatCard key={card.key} label={card.label} value={formatNumber(card.value)} hint={card.hint} />
              ))}
            </div>

            <Card className="mt-2 grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Signups over time</h3>
                <p aria-live="polite" className="mb-0 mt-1 text-[0.9rem] text-[#6B5E56]">
                  {stats.data.signupTrend.length
                    ? `${stats.data.signupTrend.length} recorded days of signup activity.`
                    : "No signup trend has been recorded yet."}
                </p>
              </div>
              {stats.data.signupTrend.length ? (
                <svg aria-label="Signup trend" className="h-12 w-full sm:w-48" preserveAspectRatio="none" role="img" viewBox="0 0 100 20">
                  <polyline
                    fill="none"
                    points={trendPoints(stats.data.signupTrend, 100, 20)}
                    stroke="#DE6219"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <span className="text-[0.9rem] text-[#6B5E56]">—</span>
              )}
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="grid gap-3 p-5">
                <div className="flex items-center gap-2">
                  <ClipboardList aria-hidden="true" className="h-5 w-5 text-[#C85512]" />
                  <h3 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Needs attention</h3>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-3">
                  <div className="rounded-[6px] bg-[#F8F3EE] p-3">
                    <dt className="m-0 text-[0.78rem] uppercase tracking-[0.1em] text-[#6B5E56]">Applications</dt>
                    <dd className="m-0 mt-1 text-[1.5rem] text-[#C85512]">{formatNumber(stats.data.pendingApplications)}</dd>
                  </div>
                  <div className="rounded-[6px] bg-[#F8F3EE] p-3">
                    <dt className="m-0 text-[0.78rem] uppercase tracking-[0.1em] text-[#6B5E56]">Matches awaiting review</dt>
                    <dd className="m-0 mt-1 text-[1.5rem] text-[#C85512]">{formatNumber(stats.data.pendingMatches)}</dd>
                  </div>
                </dl>
                <nav aria-label="Review actions" className="flex flex-wrap gap-2">
                  <Link className={`inline-flex items-center gap-1.5 rounded-full border border-[#DE6219] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C85512] ${focusRing} ${touchTargetClass}`} href="/admin/members">
                    Review applications <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                  <Link className={`inline-flex items-center gap-1.5 rounded-full border border-[#DE6219] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C85512] ${focusRing} ${touchTargetClass}`} href="/admin/mentorship">
                    Review matches <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </nav>
              </Card>
              <Card className="grid gap-3 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles aria-hidden="true" className="h-5 w-5 text-[#C85512]" />
                  <h3 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Keep the site current</h3>
                </div>
                <p className="m-0 text-[0.92rem] leading-[1.6] text-[#6B5E56]">
                  Edit copy, preview it on the real site renderer, then publish deliberately. AI suggestions are drafts until you save them.
                </p>
                <div>
                  <Link className={`inline-flex items-center gap-1.5 rounded-full bg-[#22395A] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white ${focusRing} ${touchTargetClass}`} href="/admin/content">
                    Open content editor <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </section>

      <section aria-labelledby="shortcuts-heading" className="mt-10 grid gap-4">
        <h2 id="shortcuts-heading" className="m-0 text-[1.6rem] font-normal text-[#C85512]">Staff tasks</h2>
        <nav aria-label="Staff tasks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ href, label, detail, icon: Icon }) => (
            <Card key={href} className="min-w-0">
              <Link className={`grid h-full gap-2 p-5 no-underline ${focusRing} ${touchTargetClass}`} href={href}>
                <span className="flex items-center gap-2 text-[1.05rem] font-semibold text-[#22395A]">
                  <Icon aria-hidden="true" className="h-5 w-5 text-[#DE6219]" />
                  {label}
                </span>
                <span className="text-[0.88rem] leading-[1.55] text-[#6B5E56]">{detail}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C85512]">Open task →</span>
              </Link>
            </Card>
          ))}
        </nav>
      </section>
    </main>
  );
}
