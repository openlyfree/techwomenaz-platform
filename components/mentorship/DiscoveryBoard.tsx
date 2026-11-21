"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { DiscoveryCard, DiscoveryResult, Member } from "@/lib/contracts";
import { Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { DiscoveryCardView } from "./DiscoveryCardView";
import { eyebrow, focusRing, shell, toggle } from "./styles";
import {
  canSubmitDecision,
  decisionMessage,
  isProfileComplete,
  safeMessage,
  sourceNotice,
} from "./utils";

type Role = "mentor" | "mentee";
type Decision = "interested" | "pass";

interface DecideResponse {
  mutual: boolean;
  matchId?: string;
}

export function DiscoveryBoard() {
  const session = useSession();
  const me = useQuery<Member | null>("membership.me");
  const [role, setRole] = useState<Role>("mentee");
  const roleInput = useMemo(() => ({ role }), [role]);
  const discovery = useQuery<DiscoveryResult>("mentorship.discover", roleInput);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [decidedIds, setDecidedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPendingIds([]);
    setDecidedIds([]);
    setNotice(null);
  }, [role]);

  const signInGate = (
    <Card className="grid gap-4 p-6">
      <PageHeading
        title="Sign in to discover members"
        description="Discovery is available to approved members. We will not guess who you are or show private profiles."
      />
      <div>
        <Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ${focusRing}`} href="/login">
          Sign in to continue
        </Link>
      </div>
    </Card>
  );

  const profileGate = (
    <Card className="grid gap-4 p-6">
      <p className={eyebrow}>One step first</p>
      <h2 className="m-0 text-[1.35rem] font-normal text-[#C85512]">Complete your profile before applying</h2>
      <p className="m-0 max-w-[62ch] text-[0.95rem] leading-[1.6] text-[#6B5E56]">
        Add your participation role, headline, expertise, goals, timezone and weekly availability so
        the server can find genuinely compatible members.
      </p>
      <div>
        <Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ${focusRing}`} href="/portal/profile">
          Open my profile
        </Link>
      </div>
    </Card>
  );

  async function decide(candidate: DiscoveryCard, decision: Decision) {
    if (!canSubmitDecision(pendingIds.includes(candidate.id), decidedIds.includes(candidate.id))) return;
    setPendingIds((ids) => [...ids, candidate.id]);
    setNotice(null);
    try {
      // Advance only after the server confirms the decision was recorded.
      const result = await mutate<DecideResponse>("mentorship.decide", {
        candidateId: candidate.id,
        role,
        decision,
      });
      setDecidedIds((ids) => [...ids, candidate.id]);
      setNotice(decisionMessage(result.mutual));
      await discovery.refresh();
    } catch (error) {
      setNotice(safeMessage(error, "We could not save your decision. Please try again."));
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== candidate.id));
    }
  }

  return (
    <div className="w-full bg-[#F8F3EE] pb-16 pt-8 text-[#2E2620] sm:pt-10">
      <div className={`${shell} grid gap-7`}>
        <header className="grid gap-3 border-b border-[#E7D7CC] pb-6">
          <p className={eyebrow}>TechWomenAZ · Member portal</p>
          <PageHeading
            title="Discover mentorship matches"
            description="Only approved, opted-in members with a compatible schedule are shown. Contact details are never listed here."
          />
        </header>

        {session.loading ? <Loading label="Checking your session…" /> : null}
        {!session.loading && (!session.user || session.error) ? signInGate : null}

        {session.user && !session.error ? (
          <>
            {me.loading ? <Loading label="Loading your profile…" /> : null}
            {me.error ? (
              <div className="grid gap-3">
                <ErrorNotice
                  message={safeMessage(me.error, "We could not load your profile. Please try again.")}
                />
                <div>
                  <Button type="button" onClick={() => void me.refresh()}>Retry profile</Button>
                </div>
              </div>
            ) : null}
            {!me.loading && !me.error && !isProfileComplete(me.data ?? null) ? profileGate : null}

            {!me.loading && !me.error && isProfileComplete(me.data ?? null) ? (
              <>
                <div className="grid gap-3 rounded-[14px] bg-[#EFE4DD] p-4 sm:p-5">
                  <p className="m-0 text-[0.95rem] font-semibold text-[#22395A]">I am discovering as a…</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Discovery role">
                    {(["mentee", "mentor"] as Role[]).map((option) => (
                      <button
                        aria-pressed={role === option}
                        className={`${toggle} ${
                          role === option
                            ? "border-[#DE6219] bg-[#DE6219] text-white"
                            : "border-[#DE6219] bg-transparent text-[#C85512] hover:bg-[#FFF4E8]"
                        }`}
                        key={option}
                        onClick={() => setRole(option)}
                        type="button"
                      >
                        {option === "mentee" ? "Mentee looking for a mentor" : "Mentor looking for a mentee"}
                      </button>
                    ))}
                  </div>
                </div>

                {notice ? (
                  <p aria-live="polite" className="m-0 rounded-[10px] bg-[#FFF4E8] px-4 py-3 text-[0.92rem] leading-[1.6] text-[#6B4A31]" role="status">
                    {notice}
                  </p>
                ) : null}

                {discovery.loading ? <Loading label="Loading compatible members…" /> : null}
                {discovery.error ? (
                  <div className="grid gap-3">
                    <ErrorNotice
                      message={safeMessage(
                        discovery.error,
                        "Discovery is unavailable right now. Check the server configuration and try again.",
                      )}
                    />
                    <div>
                      <Button type="button" onClick={() => void discovery.refresh()}>Retry discovery</Button>
                    </div>
                  </div>
                ) : null}
                {!discovery.loading && !discovery.error && !discovery.data ? (
                  <EmptyState
                    title="No discovery results yet"
                    description="The server did not return any results. Try again, or update your profile and availability."
                  />
                ) : null}
                {!discovery.loading && !discovery.error && discovery.data && !discovery.data.cards.length ? (
                  <EmptyState
                    title="No compatible members right now"
                    description="There are no approved, opted-in members with a matching schedule. Update your availability or check back later."
                  />
                ) : null}

                {discovery.data && sourceNotice(discovery.data) ? (
                  <p aria-live="polite" className="m-0 rounded-[10px] border border-[#E7D7CC] bg-white px-4 py-3 text-[0.9rem] leading-[1.6] text-[#6B5E56]" role="status">
                    {sourceNotice(discovery.data)}
                  </p>
                ) : null}

                {discovery.data && discovery.data.cards.length ? (
                  <section aria-label="Suggested members" className="grid gap-5">
                    {discovery.data.cards.map((candidate) => (
                      <DiscoveryCardView
                        decided={decidedIds.includes(candidate.id)}
                        key={candidate.id}
                        onDecide={(decision) => void decide(candidate, decision)}
                        pending={pendingIds.includes(candidate.id)}
                        card={candidate}
                      />
                    ))}
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
