"use client";

import { useState } from "react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { Match, Member, ParticipationRole } from "@/lib/contracts";
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

const wrapClass = "min-w-0 break-words [overflow-wrap:anywhere]";
const dtClass = "m-0 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]";
const ddClass = `m-0 mt-1 text-[#2E2620] ${wrapClass}`;
const tapClass =
  "min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85512]";

function safeMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatParticipation(value: ParticipationRole | null): string {
  if (!value) return "Not set";
  if (value === "both") return "Mentor and mentee";
  return value === "mentor" ? "Mentor" : "Mentee";
}

function formatStatus(status: Match["status"]): string {
  return status.replace(/-/g, " ");
}

export default function AdminMentorshipPage() {
  const session = useSession();
  const members = useQuery<Member[]>("admin.members");
  const matches = useQuery<Match[]>("admin.matches");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  const isStaff = session.user
    ? session.user.role === "admin" || session.user.role === "coordinator"
    : false;

  const approvedMentors = members.data?.filter(
    (item) => item.status === "approved" && (item.participation === "mentor" || item.participation === "both"),
  ) ?? [];
  const capacity = members.data
    ? {
        mentorCount: approvedMentors.length,
        menteeCount: members.data.filter(
          (item) => item.status === "approved" && (item.participation === "mentee" || item.participation === "both"),
        ).length,
        pendingCount: members.data.filter((item) => item.status === "pending").length,
        mentorSeats: approvedMentors.reduce((total, item) => total + (Number(item.capacity) || 0), 0),
      }
    : null;

  async function approveMatch(match: Match, approve: boolean) {
    if (busyId) return;
    setBusyId(match.id);
    setNotice("");
    setFailure("");
    try {
      await mutate<Match>("admin.approveMatch", { id: match.id, approve });
      await matches.refresh();
      setNotice(approve ? "Match approved." : "Match declined.");
    } catch (error) {
      setFailure(safeMessage(error, "We could not update this match. Please try again."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full bg-[#F8F3EE] pb-16 pt-8 text-[#2E2620] sm:pt-10">
      <div className="mx-auto grid w-full max-w-6xl gap-7 px-4 sm:px-6">
        <header className="grid gap-3 border-b border-[#E7D7CC] pb-6">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">
            TechWomenAZ · Staff workspace
          </p>
          <PageHeading
            title="Mentorship management"
            description="Review mentor capacity and pending applications, then approve or decline matches returned by the server."
          />
        </header>

        {/* Always mounted so later confirmations are announced by assistive tech. */}
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={
            notice
              ? "m-0 rounded-[10px] border border-[#B7C9A8] bg-[#F2F8EC] px-4 py-3 text-[0.92rem] leading-[1.6] text-[#37522B]"
              : "sr-only"
          }
        >
          {notice}
        </p>
        {failure ? (
          <div aria-live="assertive">
            <ErrorNotice message={failure} />
          </div>
        ) : null}

        {session.loading ? <Loading label="Checking your staff session…" /> : null}
        {!session.loading && (!session.user || !isStaff) ? (
          <Card className="grid gap-4 p-6">
            <PageHeading
              title="Staff sign-in required"
              description="Match approval uses real member and match records. We will not show sample users or grant access in the browser."
            />
            <div>
              <Button className={tapClass} href="/login">
                Sign in to continue
              </Button>
            </div>
          </Card>
        ) : null}

        {session.user && isStaff ? (
          <>
            <section aria-label="Mentorship capacity" className="grid gap-4">
              {members.loading ? <Loading label="Loading member records…" /> : null}
              {members.error ? (
                <div className="grid gap-3">
                  <ErrorNotice message={members.error} />
                  <div>
                    <Button className={tapClass} type="button" onClick={() => void members.refresh()}>
                      Retry members
                    </Button>
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
                  <Card className="grid min-w-0 gap-3 p-5">
                    <div className="grid gap-2">
                      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">
                        Mentors and capacity
                      </p>
                      <h2 className="m-0 text-[1.3rem] font-normal text-[#22395A]">Who can take a match</h2>
                    </div>
                    {/* Below sm these stack as one labeled card per mentor; nothing is dropped on mobile. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {approvedMentors.map((item) => (
                        <Card className="grid min-w-0 gap-2 p-4" key={item.id}>
                          <h3 className={`m-0 text-[1.05rem] font-semibold text-[#22395A] ${wrapClass}`}>{item.name}</h3>
                          <dl className="m-0 grid min-w-0 gap-2 text-[0.9rem] leading-[1.5]">
                            <div>
                              <dt className={dtClass}>Participation</dt>
                              <dd className={ddClass}>{formatParticipation(item.participation)}</dd>
                            </div>
                            <div>
                              <dt className={dtClass}>Capacity</dt>
                              <dd className={ddClass}>{Number(item.capacity) || 0}</dd>
                            </div>
                            <div>
                              <dt className={dtClass}>Discoverable</dt>
                              <dd className={ddClass}>{item.discoverable ? "Yes" : "No"}</dd>
                            </div>
                            <div>
                              <dt className={dtClass}>Status</dt>
                              <dd className={ddClass}>{item.status}</dd>
                            </div>
                          </dl>
                        </Card>
                      ))}
                    </div>
                    {!approvedMentors.length ? (
                      <p className="m-0 text-[0.9rem] text-[#6B5E56]">No approved mentors are available right now.</p>
                    ) : null}
                    <p className="m-0 border-t border-[#E1D2C7] pt-3 text-[0.88rem] text-[#6B5E56]">
                      Pending applications are reviewed on the{" "}
                      <a
                        className={`font-semibold text-[#C85512] underline underline-offset-4 ${tapClass}`}
                        href="/admin/members"
                      >
                        members page
                      </a>
                      .
                    </p>
                  </Card>
                </>
              ) : null}
            </section>

            <section aria-label="Match review" className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">
                    Coordinator review
                  </p>
                  <h2 className="m-0 mt-1 text-[1.35rem] font-normal text-[#C85512]">Matches</h2>
                </div>
                <Button className={tapClass} type="button" onClick={() => void matches.refresh()}>
                  Refresh matches
                </Button>
              </div>

              {matches.loading ? <Loading label="Loading matches…" /> : null}
              {matches.error ? (
                <div className="grid gap-3">
                  <ErrorNotice message={matches.error} />
                  <div>
                    <Button className={tapClass} type="button" onClick={() => void matches.refresh()}>
                      Retry matches
                    </Button>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {matches.data.map((match) => (
                    <Card className="grid min-w-0 gap-3 p-5" key={match.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className={`m-0 text-[1.15rem] font-normal text-[#C85512] ${wrapClass}`}>
                          {match.mentorName} &amp; {match.menteeName}
                        </h3>
                        <Badge>{formatStatus(match.status)}</Badge>
                      </div>
                      <dl className="m-0 grid min-w-0 gap-2 text-[0.9rem] leading-[1.5]">
                        <div>
                          <dt className={dtClass}>Mentor</dt>
                          <dd className={ddClass}>{match.mentorName}</dd>
                        </div>
                        <div>
                          <dt className={dtClass}>Mentee</dt>
                          <dd className={ddClass}>{match.menteeName}</dd>
                        </div>
                        <div>
                          <dt className={dtClass}>Status</dt>
                          <dd className={ddClass}>{formatStatus(match.status)}</dd>
                        </div>
                        <div>
                          <dt className={dtClass}>Goal</dt>
                          <dd className={ddClass}>{match.goal || "No goal recorded."}</dd>
                        </div>
                        <div>
                          <dt className={dtClass}>Created</dt>
                          <dd className={ddClass}>{new Date(match.createdAt).toLocaleDateString()}</dd>
                        </div>
                        {match.nextMeeting ? (
                          <div>
                            <dt className={dtClass}>Next meeting</dt>
                            <dd className={ddClass}>{match.nextMeeting}</dd>
                          </div>
                        ) : null}
                        {match.meetingUrl ? (
                          <div>
                            <dt className={dtClass}>Meeting link</dt>
                            <dd className={ddClass}>{match.meetingUrl}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {match.status === "awaiting-coordinator" ? (
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className={tapClass}
                            disabled={busyId === match.id}
                            onClick={() => void approveMatch(match, true)}
                            type="button"
                          >
                            Approve match
                          </Button>
                          <Button
                            className={tapClass}
                            variant="secondary"
                            disabled={busyId === match.id}
                            onClick={() => void approveMatch(match, false)}
                            type="button"
                          >
                            Decline match
                          </Button>
                          {busyId === match.id ? <Loading message="Saving…" /> : null}
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
