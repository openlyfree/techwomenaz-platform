"use client";

import Link from "next/link";
import { useQuery, useSession } from "@/lib/api";
import type { Match, Member } from "@/lib/contracts";
import { Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { MatchCard } from "./MatchCard";
import { actionLink, eyebrow, focusRing, shell } from "./styles";
import { isProfileComplete, safeMessage } from "./utils";

export function MatchesBoard() {
  const session = useSession();
  const me = useQuery<Member | null>("membership.me");
  const matches = useQuery<Match[]>("mentorship.matches");

  const signInGate = (
    <Card className="grid gap-4 p-6">
      <PageHeading
        title="Sign in to see your mentorships"
        description="Matches and check-ins belong to the people in them and to coordinators. We never show a guessed identity."
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
          <p className={eyebrow}>TechWomenAZ · Member portal</p>
          <PageHeading
            title="My mentorships"
            description="Every match below was returned by the server for your account. Each card shows the current status and what happens next."
          />
        </header>

        {session.loading ? <Loading label="Checking your session…" /> : null}
        {!session.loading && (!session.user || session.error) ? signInGate : null}

        {session.user && !session.error ? (
          <>
            {me.loading ? <Loading label="Checking your profile…" /> : null}
            {me.error ? (
              <div className="grid gap-3">
                <ErrorNotice message={safeMessage(me.error, "We could not check your profile.")} />
                <div>
                  <Button type="button" onClick={() => void me.refresh()}>Retry profile</Button>
                </div>
              </div>
            ) : null}
            {!me.loading && !me.error && !isProfileComplete(me.data ?? null) ? (
              <Card className="grid gap-3 p-5">
                <p className={eyebrow}>Application requirement</p>
                <p className="m-0 text-[0.95rem] leading-[1.6] text-[#6B5E56]">
                  Complete your profile before applying for a new mentorship match.
                </p>
                <div>
                  <Link className={actionLink} href="/portal/profile">Complete my profile</Link>
                </div>
              </Card>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Link className={actionLink} href="/portal/discover">Discover members</Link>
              <Button type="button" onClick={() => void matches.refresh()}>Refresh matches</Button>
            </div>

            {matches.loading ? <Loading label="Loading your matches…" /> : null}
            {matches.error ? (
              <div className="grid gap-3">
                <ErrorNotice
                  message={safeMessage(matches.error, "We could not load your matches. Please try again.")}
                />
                <div>
                  <Button type="button" onClick={() => void matches.refresh()}>Retry matches</Button>
                </div>
              </div>
            ) : null}
            {!matches.loading && !matches.error && (!matches.data || !matches.data.length) ? (
              <EmptyState
                title="No mentorship matches yet"
                description="Express interest in a compatible member and, once it is mutual, your match will appear here."
              />
            ) : null}
            {!matches.loading && !matches.error && matches.data && matches.data.length ? (
              <section aria-label="Your matches" className="grid gap-5">
                {matches.data.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
