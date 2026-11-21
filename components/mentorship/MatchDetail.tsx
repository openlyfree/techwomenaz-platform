"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, Pause } from "lucide-react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { Checkin, Match } from "@/lib/contracts";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { actionLink, card, eyebrow, focusRing, input, label, shell } from "./styles";
import {
  buildMatchIcs,
  fromDateTimeLocal,
  matchNextStep,
  safeHttpUrl,
  safeMessage,
  toDateTimeLocal,
  toIcsDate,
} from "./utils";

interface UpdateInput {
  id: string;
  goal?: string;
  nextMeeting?: string;
  meetingUrl?: string;
  status?: "paused" | "completed";
}

export function MatchDetail({ id }: { id: string }) {
  const session = useSession();
  const matches = useQuery<Match[]>("mentorship.matches");
  const checkinInput = useMemo(() => ({ matchId: id }), [id]);
  const checkins = useQuery<Checkin[]>("mentorship.checkins", checkinInput);

  // The match is located only inside the server-authorized list. Never build a
  // match object from the URL, and never let the UI grant access on its own.
  const match = matches.data?.find((item) => item.id === id) ?? null;

  const [goal, setGoal] = useState("");
  const [nextMeeting, setNextMeeting] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [met, setMet] = useState(true);
  const [useful, setUseful] = useState(true);
  const [continueFlag, setContinueFlag] = useState(true);
  const [privateNote, setPrivateNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setGoal(match.goal);
    setNextMeeting(toDateTimeLocal(match.nextMeeting));
    setMeetingUrl(match.meetingUrl);
  }, [match?.id, match?.goal, match?.nextMeeting, match?.meetingUrl]);

  useEffect(() => {
    setNotice(null);
  }, [id]);

  async function saveDetails() {
    if (!match || saving) return;
    if (meetingUrl.trim() && !safeHttpUrl(meetingUrl)) {
      setNotice("Meeting links must start with https:// or http://. Leave the field blank if you have no link.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const input: UpdateInput = {
        id: match.id,
        goal: goal.trim(),
        meetingUrl: safeHttpUrl(meetingUrl) ?? "",
      };
      const iso = fromDateTimeLocal(nextMeeting);
      if (iso) input.nextMeeting = iso;
      await mutate<Match>("mentorship.updateMatch", input);
      await matches.refresh();
      setNotice("Match details saved.");
    } catch (error) {
      setNotice(safeMessage(error, "We could not save these details. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "paused" | "completed") {
    if (!match || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await mutate<Match>("mentorship.updateMatch", { id: match.id, status });
      await matches.refresh();
      setNotice(status === "paused" ? "Match paused." : "Match completed.");
    } catch (error) {
      setNotice(safeMessage(error, "We could not change the match status. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function submitCheckin() {
    if (!match || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await mutate<Checkin>("mentorship.checkin", {
        matchId: match.id,
        met,
        useful,
        continue: continueFlag,
        privateNote: privateNote.trim(),
      });
      setPrivateNote("");
      await checkins.refresh();
      setNotice("Check-in saved.");
    } catch (error) {
      setNotice(safeMessage(error, "We could not save your check-in. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function downloadCalendar() {
    if (!match) return;
    const ics = buildMatchIcs(match);
    if (!ics) {
      setNotice("Add a valid meeting date before downloading a calendar event.");
      return;
    }
    if (typeof URL.createObjectURL !== "function") {
      setNotice("Calendar download is not supported by this browser.");
      return;
    }
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techwomenaz-mentorship-${match.id.replace(/[^a-zA-Z0-9_-]/g, "")}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const signInGate = (
    <Card className="grid gap-4 p-6">
      <PageHeading
        title="Sign in to open this match"
        description="Only the two members in a match and coordinators can see its details. The server decides access."
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
        <Link className={`${actionLink} justify-self-start`} href="/portal/mentorship">
          <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" /> My mentorships
        </Link>

        <header className="grid gap-3 border-b border-[#E7D7CC] pb-6">
          <p className={eyebrow}>TechWomenAZ · Mentorship relationship</p>
          <PageHeading
            title="Match details"
            description="Access is verified by the server. Edit your shared plan, record check-ins and close the match when you are done."
          />
        </header>

        {notice ? (
          <p aria-live="polite" className="m-0 rounded-[10px] bg-[#FFF4E8] px-4 py-3 text-[0.92rem] leading-[1.6] text-[#6B4A31]" role="status">
            {notice}
          </p>
        ) : null}

        {session.loading ? <Loading label="Checking your session…" /> : null}
        {session.error ? (
          <ErrorNotice
            message={safeMessage(session.error, "We could not check your session. Please try again.")}
            onRetry={() => void session.refresh()}
          />
        ) : null}
        {!session.loading && (!session.user || session.error) ? signInGate : null}

        {session.user && !session.error ? (
          <>
            {matches.loading ? <Loading label="Loading this match…" /> : null}
            {matches.error ? (
              <div className="grid gap-3">
                <ErrorNotice message={safeMessage(matches.error, "We could not load this match. Please try again.")} />
                <div>
                  <Button type="button" onClick={() => void matches.refresh()}>Retry match</Button>
                </div>
              </div>
            ) : null}
            {!matches.loading && !matches.error && !match ? (
              <Card className="grid gap-4 p-6">
                <EmptyState
                  title="Match not available"
                  description="This match does not exist, is not authorized for your account, or is no longer available."
                />
                <div>
                  <Link className={actionLink} href="/portal/mentorship">Back to my mentorships</Link>
                </div>
              </Card>
            ) : null}

            {match ? (
              <>
                <Card className={card}>
                  <section aria-label="Match overview" className="grid gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className={eyebrow}>{match.status.replace(/-/g, " ")}</p>
                        <h2 className="m-0 mt-1 text-[1.6rem] font-normal leading-[1.2] text-[#C85512]">
                          {match.mentorName} &amp; {match.menteeName}
                        </h2>
                      </div>
                      <Badge>{match.status}</Badge>
                    </div>
                    <div className="rounded-[10px] bg-[#F8F3EE] px-4 py-3">
                      <p className={label}>Clear next step</p>
                      <p className="m-0 text-[0.95rem] leading-[1.6] text-[#2E2620]">{matchNextStep(match)}</p>
                    </div>
                    <p className="m-0 text-[0.9rem] text-[#6B5E56]">
                      Created {new Date(match.createdAt).toLocaleDateString()}
                    </p>
                  </section>
                </Card>

                <Card className={card}>
                  <section aria-label="Edit match plan" className="grid gap-4">
                    <div>
                      <p className={eyebrow}>Shared plan</p>
                      <h2 className="m-0 mt-1 text-[1.35rem] font-normal text-[#22395A]">Goal, date and meeting link</h2>
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <label className={label} htmlFor="match-goal">Goal</label>
                        <textarea
                          className={`${input} min-h-[96px]`}
                          id="match-goal"
                          onChange={(event) => setGoal(event.target.value)}
                          value={goal}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={label} htmlFor="match-date">Next meeting</label>
                          <input
                            className={input}
                            id="match-date"
                            onChange={(event) => setNextMeeting(event.target.value)}
                            type="datetime-local"
                            value={nextMeeting}
                          />
                        </div>
                        <div>
                          <label className={label} htmlFor="match-url">Meeting link</label>
                          <input
                            className={input}
                            id="match-url"
                            onChange={(event) => setMeetingUrl(event.target.value)}
                            placeholder="https://…"
                            type="url"
                            value={meetingUrl}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button disabled={saving} onClick={() => void saveDetails()} type="button">
                        Save details
                      </Button>
                      {toIcsDate(match.nextMeeting) ? (
                        <Button disabled={saving} onClick={downloadCalendar} type="button">
                          <Download aria-hidden="true" className="mr-1.5 inline h-4 w-4" /> Add to calendar
                        </Button>
                      ) : null}
                    </div>
                    {safeHttpUrl(match.meetingUrl) ? (
                      <p className="m-0 text-[0.9rem] text-[#6B5E56]">
                        <a
                          className={`inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-[#C85512] underline underline-offset-4 ${focusRing}`}
                          href={safeHttpUrl(match.meetingUrl)!}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open meeting link <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 border-t border-[#E1D2C7] pt-4">
                      {match.status !== "paused" && match.status !== "completed" ? (
                        <Button disabled={saving} onClick={() => void setStatus("paused")} type="button">
                          <Pause aria-hidden="true" className="mr-1.5 inline h-4 w-4" /> Pause match
                        </Button>
                      ) : null}
                      {match.status !== "completed" ? (
                        <Button disabled={saving} onClick={() => void setStatus("completed")} type="button">
                          <CheckCircle2 aria-hidden="true" className="mr-1.5 inline h-4 w-4" /> Complete match
                        </Button>
                      ) : null}
                    </div>
                  </section>
                </Card>

                <Card className={card}>
                  <section aria-label="Check-ins" className="grid gap-4">
                    <div>
                      <p className={eyebrow}>Reflection</p>
                      <h2 className="m-0 mt-1 text-[1.35rem] font-normal text-[#22395A]">Check-ins</h2>
                      <p className="m-0 mt-1 text-[0.88rem] leading-[1.6] text-[#6B5E56]">
                        Private notes appear only where the server permits. A blank note means it is restricted.
                      </p>
                    </div>

                    {checkins.loading ? <Loading label="Loading check-ins…" /> : null}
                    {checkins.error ? (
                      <div className="grid gap-3">
                        <ErrorNotice message={safeMessage(checkins.error, "We could not load check-ins.")} />
                        <div>
                          <Button type="button" onClick={() => void checkins.refresh()}>Retry check-ins</Button>
                        </div>
                      </div>
                    ) : null}
                    {!checkins.loading && !checkins.error && !checkins.data?.length ? (
                      <p className="m-0 text-[0.92rem] text-[#6B5E56]">No check-ins recorded for this match yet.</p>
                    ) : null}
                    {!checkins.loading && !checkins.error && checkins.data?.length ? (
                      <ul className="m-0 grid list-none gap-3 p-0">
                        {checkins.data.map((entry) => (
                          <li className="rounded-[10px] bg-[#F8F3EE] p-4" key={entry.id}>
                            <p className="m-0 text-[0.78rem] uppercase tracking-[0.12em] text-[#C85512]">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </p>
                            <p className="m-0 mt-1 text-[0.92rem] text-[#2E2620]">
                              Met: {entry.met ? "Yes" : "No"} · Useful: {entry.useful ? "Yes" : "No"} · Continue:{" "}
                              {entry.continue ? "Yes" : "No"}
                            </p>
                            {entry.privateNote ? (
                              <p className="m-0 mt-1 text-[0.92rem] italic leading-[1.6] text-[#6B5E56]">
                                Private note: {entry.privateNote}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <form
                      className="grid gap-4 border-t border-[#E1D2C7] pt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitCheckin();
                      }}
                    >
                      <fieldset className="m-0 grid gap-2 border-0 p-0">
                        <legend className={label}>How did this meeting go?</legend>
                        {(
                          [
                            ["Met", met, setMet],
                            ["Useful", useful, setUseful],
                            ["Continue", continueFlag, setContinueFlag],
                          ] as const
                        ).map(([text, checked, setter]) => (
                          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 text-[0.95rem]" key={text}>
                            <input
                              checked={checked}
                              className="h-5 w-5 accent-[#DE6219]"
                              onChange={(event) => setter(event.target.checked)}
                              type="checkbox"
                            />
                            {text}
                          </label>
                        ))}
                      </fieldset>
                      <div>
                        <label className={label} htmlFor="checkin-note">Private note</label>
                        <textarea
                          className={`${input} min-h-[96px]`}
                          id="checkin-note"
                          onChange={(event) => setPrivateNote(event.target.value)}
                          value={privateNote}
                        />
                      </div>
                      <div>
                        <Button disabled={saving} type="submit">Save check-in</Button>
                      </div>
                    </form>
                  </section>
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
