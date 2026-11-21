"use client";

import Link from "next/link";
import { useQuery, useSession } from "@/lib/api";
import type { Match, Member } from "@/lib/contracts";
import { Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { actionLink, card, eyebrow, focusRing, shell } from "./styles";
import { isProfileComplete, safeMessage } from "./utils";

const links = [
  { href: "/portal/profile", label: "My profile", detail: "Role, expertise, goals, availability and timezone." },
  { href: "/portal/discover", label: "Discover members", detail: "Approved, opted-in and schedule-compatible only." },
  { href: "/portal/mentorship", label: "My mentorships", detail: "Current matches, next steps and check-ins." },
];

export function PortalHome() {
  const session = useSession();
  const me = useQuery<Member | null>("membership.me");
  const matches = useQuery<Match[]>("mentorship.matches");

  const signInGate = (
    <Card className="grid gap-4 p-6">
      <PageHeading
        title="Sign in to open your portal"
        description="Your profile, matches and check-ins are private to you and the coordinators. We never show a guessed member."
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
            title={session.user ? `Welcome back, ${session.user.name.split(" ")[0] || "there"}.` : "Member portal"}
            description="Set up your profile, find a compatible mentor or mentee, and keep your matches moving."
          />
        </header>

        {session.loading ? <Loading label="Checking your session…" /> : null}
        {!session.loading && (!session.user || session.error) ? signInGate : null}

        {session.user && !session.error ? (
          <>
            {me.loading ? <Loading label="Loading your profile…" /> : null}
            {me.error ? (
              <div className="grid gap-3">
                <ErrorNotice message={safeMessage(me.error, "We could not load your profile.")} />
                <div>
                  <Button type="button" onClick={() => void me.refresh()}>Retry profile</Button>
                </div>
              </div>
            ) : null}
            {!me.loading && !me.error && !isProfileComplete(me.data ?? null) ? (
              <Card className="grid gap-3 p-5">
                <p className={eyebrow}>Get started</p>
                <p className="m-0 text-[0.95rem] leading-[1.6] text-[#6B5E56]">
                  Your profile needs a participation role, headline, expertise, goals, timezone and
                  weekly availability before you can apply for mentorship.
                </p>
                <div>
                  <Link className={actionLink} href="/portal/profile">Complete my profile</Link>
                </div>
              </Card>
            ) : null}

            <section aria-label="Portal shortcuts" className="grid gap-4 sm:grid-cols-3">
              {links.map((link) => (
                <Card className={`${card} min-h-[150px]`} key={link.href}>
                  <Link className={`grid h-full gap-2 no-underline ${focusRing}`} href={link.href}>
                    <span className="text-[1.1rem] font-semibold text-[#22395A]">{link.label}</span>
                    <span className="text-[0.9rem] leading-[1.6] text-[#6B5E56]">{link.detail}</span>
                    <span className="mt-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C85512]">Open →</span>
                  </Link>
                </Card>
              ))}
            </section>

            <section aria-label="Match snapshot" className="grid gap-4">
              <h2 className="m-0 text-[1.35rem] font-normal text-[#C85512]">Your matches at a glance</h2>
              {matches.loading ? <Loading label="Loading matches…" /> : null}
              {matches.error ? (
                <div className="grid gap-3">
                  <ErrorNotice message={safeMessage(matches.error, "We could not load your matches.")} />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => void matches.refresh()}>Retry matches</Button>
                    <Link className={actionLink} href="/portal/mentorship">Open my mentorships</Link>
                  </div>
                </div>
              ) : null}
              {!matches.loading && !matches.error && !matches.data?.length ? (
                <EmptyState
                  title="No matches yet"
                  description="Discover compatible members to express interest. Approved matches will show here."
                />
              ) : null}
              {!matches.loading && !matches.error && matches.data?.length ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {matches.data.map((match) => (
                    <li className="rounded-[10px] bg-[#EFE4DD] px-4 py-3" key={match.id}>
                      <Link className={`inline-flex min-h-[44px] flex-wrap items-center gap-2 text-[0.95rem] ${focusRing}`} href={`/portal/relationships/${encodeURIComponent(match.id)}`}>
                        <span className="font-medium text-[#22395A]">{match.mentorName} &amp; {match.menteeName}</span>
                        <span className="text-[0.82rem] uppercase tracking-[0.1em] text-[#C85512]">
                          {match.status.replace(/-/g, " ")}
                        </span>
                      </Link>
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
