"use client";

import Link from "next/link";
import { useState } from "react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { Match, Member } from "@/lib/contracts";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading, StatCard } from "@/components/ui";
import { actionLink, card, eyebrow, focusRing, label, shell } from "./styles";
import { capacitySummary, safeMessage } from "./utils";

export function AdminMentorshipBoard() {
  const session = useSession();
  const members = useQuery<Member[]>("admin.members");
  const matches = useQuery<Match[]>("admin.matches");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isStaff = session.user
    ? session.user.role === "admin" || session.user.role === "coordinator"
    : false;
  const capacity = members.data ? capacitySummary(members.data) : null;

  async function approveMatch(match: Match, approve: boolean) {
    if (busyId) return;
    setBusyId(match.id);
    setNotice(null);
    try {
      await mutate<Match>("admin.approveMatch", { id: match.id, approve });
      await matches.refresh();
      setNotice(approve ? "Match approved." : "Match declined.");
    } catch (error) {
      setNotice(safeMessage(error, "We could not update this match. Please try again."));
    } finally {
      setBusyId(null);
    }
  }

  const signInGate = (
    <Card className="grid gap-4 p-6">
      <PageHeading
        title="Staff sign-in required"
        description="Match approval uses real member and match records. We will not show sample users or grant access in the browser."
      />
      <div>
        <Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ${focusRing}`} href="/login">
          Sign in to continue
        </Link>
      </div>
    </Card>
  );

  return (
    <div className="w-full bg-[#F8F3EE] pb-16 pt-8 text-[#2E2620] sm:pt-10">
      <div className={`${shell} grid gap-7`}>
        <header className="grid gap-3 border-b border-[#E7D7CC] pb-6">
          <p className={eyebrow}>TechWomenAZ · Staff workspace</p>
          <PageHeading
            title="Mentorship management"
            description="Review mentor capacity and pending applications, then approve or decline matches returned by the server."
          />
        </header>

        {notice ? (
          <p aria-live="polite" className="m-0 rounded-[10px] bg-[#FFF4E8] px-4 py-3 text-[0.92rem] leading-[1.6] text-[#6B4A31]" role="status">
            {notice}
          </p>
        ) : null}

        {session.loading ? <Loading label="Checking your staff session…" /> : null}
        {!session.loading && (!session.user || !isStaff) ? signInGate : null}

        {session.user && isStaff ? (
          <>
            <section aria-label="Mentorship capacity" className="grid gap-4">
              {members.loading ? <Loading label="Loading member records…" /> : null}
              {members.error ? (
                <div className="grid gap-3">
                  <ErrorNotice message={safeMessage(members.error, "We could not load member records.")} />
                  <div>
                    <Button type="button" onClick={() => void members.refresh()}>Retry members</Button>
                  </div>
                </div>
              ) : null}
              {!members.loading && !members.error && !members.data?.length ? (
                <EmptyState
                  title="No member records returned"
                  description="Capacity and pending applications will appear when the member service is available."
                />
              ) : null}
              {!members.loading && !members.error && members.data?.length ? (
                <>
                  {capacity ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatCard label="Approved mentors" value={String(capacity.mentorCount)} hint="From member records" />
                      <StatCard label="Approved mentees" value={String(capacity.menteeCount)} hint="From member records" />
                      <StatCard label="Pending applications" value={String(capacity.pendingCount)} hint="Awaiting staff review" />
                      <StatCard label="Mentor seats" value={String(capacity.mentorSeats)} hint="Declared capacity" />
                    </div>
                  ) : null}
                  <Card className={card}>
                    <div className="grid gap-3">
                      <div>
                        <p className={eyebrow}>Mentors and capacity</p>
                        <h2 className="m-0 mt-1 text-[1.3rem] font-normal text-[#22395A]">Who can take a match</h2>
                      </div>
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {members.data!
                          .filter((item) => item.status === "approved" && (item.participation === "mentor" || item.participation === "both"))
                          .map((item) => (
                            <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-[#F8F3EE] px-4 py-3" key={item.id}>
                              <span className="font-medium text-[#2E2620]">{item.name}</span>
                              <span className="flex items-center gap-2 text-[0.88rem] text-[#6B5E56]">
                                <Badge>{item.participation}</Badge>
                                Capacity: {item.capacity} · Discoverable: {item.discoverable ? "Yes" : "No"}
                              </span>
                            </li>
                          ))}
                      </ul>
                      {!members.data!.some((item) => item.status === "approved" && (item.participation === "mentor" || item.participation === "both")) ? (
                        <p className="m-0 text-[0.9rem] text-[#6B5E56]">No approved mentors are available right now.</p>
                      ) : null}
                      <p className="m-0 border-t border-[#E1D2C7] pt-3 text-[0.88rem] text-[#6B5E56]">
                        Pending applications are reviewed on the{" "}
                        <Link className={`font-semibold text-[#C85512] underline underline-offset-4 ${focusRing}`} href="/admin/members">
                          members page
                        </Link>
                        .
                      </p>
                    </div>
                  </Card>
                </>
              ) : null}
            </section>

            <section aria-label="Match review" className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={eyebrow}>Coordinator review</p>
                  <h2 className="m-0 mt-1 text-[1.35rem] font-normal text-[#C85512]">Matches</h2>
                </div>
                <Button type="button" onClick={() => void matches.refresh()}>Refresh matches</Button>
              </div>

              {matches.loading ? <Loading label="Loading matches…" /> : null}
              {matches.error ? (
                <div className="grid gap-3">
                  <ErrorNotice message={safeMessage(matches.error, "We could not load matches.")} />
                  <div>
                    <Button type="button" onClick={() => void matches.refresh()}>Retry matches</Button>
                  </div>
                </div>
              ) : null}
              {!matches.loading && !matches.error && !matches.data?.length ? (
                <EmptyState
                  title="No matches returned"
                  description="Mutual interest will appear here when the server records it. Nothing is invented for this view."
                />
              ) : null}
              {!matches.loading && !matches.error && matches.data?.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {matches.data.map((match) => (
                    <li className={card} key={match.id}>
                      <article className="grid gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="m-0 text-[1.15rem] font-normal text-[#C85512]">
                              {match.mentorName} &amp; {match.menteeName}
                            </h3>
                            <p className="m-0 mt-1 text-[0.9rem] text-[#6B5E56]">
                              {match.goal || "No goal recorded."}
                            </p>
                          </div>
                          <Badge>{match.status.replace(/-/g, " ")}</Badge>
                        </div>
                        <p className={label}>Created {new Date(match.createdAt).toLocaleDateString()}</p>
                        {match.status === "awaiting-coordinator" ? (
                          <div className="flex flex-wrap gap-3">
                            <Button
                              disabled={busyId === match.id}
                              onClick={() => void approveMatch(match, true)}
                              type="button"
                            >
                              Approve match
                            </Button>
                            <Button
                              disabled={busyId === match.id}
                              onClick={() => void approveMatch(match, false)}
                              type="button"
                            >
                              Decline match
                            </Button>
                          </div>
                        ) : null}
                      </article>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
