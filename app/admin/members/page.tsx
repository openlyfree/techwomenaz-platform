"use client";

import { useEffect, useMemo, useState } from "react";
import { mutate, query, useSession } from "@/lib/api";
import type { Member } from "@/lib/contracts";
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
import { canShowEmail, filterMembers, safeErrorText } from "@/components/membership/admin-helpers";
import {
  actionLabel,
  formatMemberStatus,
  formatParticipation,
  formatRole,
  shortenForDisplay,
} from "@/components/membership/member-a11y";

type MemberStatus = "approved" | "paused";

const wrapClass = "min-w-0 break-words [overflow-wrap:anywhere]";
const tapClass =
  "min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85512]";
const inputClass =
  "mt-1 w-full min-w-0 min-h-[44px] rounded-[6px] border border-[#D9C6B9] bg-[#FFFBF8] px-3 py-2 text-[0.95rem] text-[#2E2620] placeholder:text-[#A2958B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85512]";
const statusVariant: Record<string, string> = {
  approved: "success",
  pending: "warning",
  paused: "danger",
};

export default function AdminMembersPage() {
  const session = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  // Client-side query loading with cancellation so a slow request cannot overwrite fresh data.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    query<Member[]>("admin.members")
      .then((data: Member[]) => {
        if (!active) return;
        setMembers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(safeErrorText(error));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visible = useMemo(() => filterMembers(members ?? [], search), [members, search]);
  const counts = useMemo(
    () => ({
      total: members?.length ?? 0,
      pending: members?.filter((member) => member.status === "pending").length ?? 0,
      approved: members?.filter((member) => member.status === "approved").length ?? 0,
      paused: members?.filter((member) => member.status === "paused").length ?? 0,
    }),
    [members],
  );

  // UI gating is not security: the server validates the role and returns email only to staff.
  const showEmail = canShowEmail(session.user?.role);

  async function setStatus(member: Member, status: MemberStatus) {
    setBusyId(member.id);
    setNotice("");
    setFailure("");
    try {
      await mutate<{ success: true }>("admin.approveMember", { id: member.id, status });
      setNotice(`${member.name} is now ${formatMemberStatus(status)}.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFailure(safeErrorText(error));
    } finally {
      setBusyId("");
    }
  }

  if (session.loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Loading message="Checking your staff session…" />
      </main>
    );
  }

  if (!session.user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <PageHeading
          title="Members"
          description="Sign in with a coordinator or admin account to review applications."
        />
        <Card className="mt-6 grid gap-4 p-6">
          <p className="m-0 text-[#6B5E56]">
            No staff session was found. We will not guess who you are or show private member data.
          </p>
          <div>
            <Button href="/login">Sign in to continue</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-7 grid gap-3 border-b border-[#E1D2C7] pb-6">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">
          TechWomenAZ · Staff workspace
        </p>
        <PageHeading
          title="Members"
          description="Review applications and update approval status. Email addresses are only shown to coordinators and admins."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Signed in as {formatRole(session.user.role)}</Badge>
          <Badge>Records from the database</Badge>
        </div>
      </header>

      {session.error ? (
        <div className="mb-4" aria-live="polite">
          {/* The shared client already sanitizes this to a safe string. */}
          <ErrorNotice message={session.error} />
        </div>
      ) : null}

      {notice ? (
        <p
          className="m-0 mb-4 rounded-[6px] border border-[#B7C9A8] bg-[#F2F8EC] px-4 py-3 text-[0.92rem] text-[#37522B]"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
      {failure ? (
        <div className="mb-4" aria-live="assertive">
          <ErrorNotice message={failure} />
        </div>
      ) : null}

      <section aria-labelledby="member-counts-heading" className="mb-7">
        <h2 id="member-counts-heading" className="sr-only">
          Membership counts
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total members" value={String(counts.total)} hint="Stored member records" />
          <StatCard label="Pending" value={String(counts.pending)} hint="Awaiting a staff decision" />
          <StatCard label="Approved" value={String(counts.approved)} hint="Active in the program" />
          <StatCard label="Paused" value={String(counts.paused)} hint="Temporarily inactive" />
        </div>
      </section>

      <section aria-labelledby="member-list-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="member-list-heading" className="m-0 text-[1.6rem] font-normal text-[#C85512]">
            Applications and members
          </h2>
          <Button
            type="button"
            className={tapClass}
            aria-label={actionLabel("member list", "Refresh")}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Refresh list
          </Button>
        </div>

        <div className="grid max-w-md gap-1">
          <label
            htmlFor="member-search"
            className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]"
          >
            Search by name, career, major or interest
          </label>
          <input
            id="member-search"
            className={inputClass}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. Learning AI, Phoenix, developer"
            type="search"
            value={search}
          />
        </div>

        {loading ? <Loading message="Loading members…" /> : null}
        {loadError ? (
          <div className="grid gap-3">
            <ErrorNotice message={loadError} />
            <div>
              <Button
                type="button"
                className={tapClass}
                aria-label={actionLabel("member list", "Retry loading")}
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : null}
        {!loading && !loadError && !members?.length ? (
          <EmptyState
            title="No members yet"
            description="Applications will appear here once people join. There is no demo data in this list."
          />
        ) : null}
        {!loading && !loadError && members?.length && !visible.length ? (
          <EmptyState
            title="No matching members"
            description="Try a different name, career, major or interest. Clear the search to see everyone again."
          />
        ) : null}

        {!loading && !loadError ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list" aria-labelledby="member-list-heading">
            {visible.map((member) => {
              const headingId = `member-${member.id}`;
              return (
                <Card
                  className="grid min-w-0 gap-3 p-5"
                  key={member.id}
                  role="listitem"
                  aria-labelledby={headingId}
                >
                  <div className="grid gap-2">
                    <h3 id={headingId} className={`m-0 text-[1.08rem] font-semibold text-[#22395A] ${wrapClass}`}>
                      {member.name || "Unnamed member"}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariant[member.status]}>Status: {formatMemberStatus(member.status)}</Badge>
                      <Badge>Role: {formatRole(member.role)}</Badge>
                      <Badge>{formatParticipation(member.participation)}</Badge>
                    </div>
                  </div>

                  <dl className="m-0 grid min-w-0 gap-2 text-[0.9rem] leading-[1.5]">
                    <div className="grid min-w-0 gap-0.5">
                      <dt className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Career</dt>
                      <dd className={`m-0 text-[#2E2620] ${wrapClass}`}>{member.career || "Not provided"}</dd>
                    </div>
                    <div className="grid min-w-0 gap-0.5">
                      <dt className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Major</dt>
                      <dd className={`m-0 text-[#2E2620] ${wrapClass}`}>{member.major || "Not provided"}</dd>
                    </div>
                    <div className="grid min-w-0 gap-0.5">
                      <dt className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Interests</dt>
                      <dd className="m-0 flex min-w-0 flex-wrap gap-1.5 text-[#2E2620]">
                        {member.interests?.length
                          ? member.interests.map((interest) => (
                              <Badge className={wrapClass} key={interest}>
                                {interest}
                              </Badge>
                            ))
                          : "Not provided"}
                      </dd>
                    </div>
                    {member.interestAnswer ? (
                      <div className="grid min-w-0 gap-0.5">
                        <dt className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Why they joined</dt>
                        <dd className={`m-0 text-[#2E2620] ${wrapClass}`} title={member.interestAnswer}>
                          <span aria-hidden="true">{shortenForDisplay(member.interestAnswer, 180)}</span>
                          <span className="sr-only">{member.interestAnswer}</span>
                        </dd>
                      </div>
                    ) : null}
                    {showEmail && member.email ? (
                      <div className="grid min-w-0 gap-0.5">
                        <dt className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8B7D73]">Email</dt>
                        <dd className={`m-0 text-[#2E2620] ${wrapClass}`}>{member.email}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {member.status !== "approved" ? (
                      <Button
                        className={tapClass}
                        aria-label={actionLabel(member.name, "Approve")}
                        disabled={busyId === member.id}
                        onClick={() => void setStatus(member, "approved")}
                        type="button"
                      >
                        Approve
                      </Button>
                    ) : null}
                    {member.status !== "paused" ? (
                      <Button
                        className={tapClass}
                        aria-label={actionLabel(member.name, "Pause")}
                        disabled={busyId === member.id}
                        onClick={() => void setStatus(member, "paused")}
                        type="button"
                      >
                        Pause
                      </Button>
                    ) : null}
                    {busyId === member.id ? <Loading message="Saving…" /> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
