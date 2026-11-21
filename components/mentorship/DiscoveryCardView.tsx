"use client";

import { useRef } from "react";
import { ArrowRight, Ban, Clock3, Globe2, Sparkles } from "lucide-react";
import type { DiscoveryCard } from "@/lib/contracts";
import { Badge, Button, Card } from "@/components/ui";
import { card, chip, eyebrow, label } from "./styles";
import {
  canSubmitDecision,
  describeMeeting,
  formatAvailability,
  hasHorizontalSwipe,
  overlapText,
} from "./utils";

export interface DiscoveryCardViewProps {
  card: DiscoveryCard;
  pending: boolean;
  decided: boolean;
  onDecide: (decision: "interested" | "pass") => void;
}

/**
 * Pure, testable core of the pointer gesture. Only a clearly horizontal drag
 * from a non-mouse pointer can decide, and never while a decision is pending
 * or already confirmed. The buttons remain the primary accessible path.
 */
export function swipeDecision(
  pointerType: string,
  dx: number,
  dy: number,
  enabled: boolean,
): "interested" | "pass" | null {
  if (!enabled || pointerType === "mouse") return null;
  if (!hasHorizontalSwipe(dx, dy)) return null;
  return dx > 0 ? "interested" : "pass";
}

/**
 * Presentation-only candidate card. It deliberately renders no email, phone
 * or other contact details; the server owns ranking and compatibility.
 */
export function DiscoveryCardView({ card: candidate, pending, decided, onDecide }: DiscoveryCardViewProps) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const enabled = canSubmitDecision(pending, decided);
  const availability = formatAvailability(candidate.availability);
  const reasons = candidate.reasons.length
    ? candidate.reasons
    : ["No specific reasons were supplied by the server."];

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Mouse users have buttons; dragging with a mouse should not decide for them.
    if (event.pointerType === "mouse") return;
    origin.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = origin.current;
    origin.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const decision = swipeDecision(event.pointerType, dx, dy, enabled);
    if (decision) onDecide(decision);
  };

  return (
    <Card
      className={`${card} motion-safe:transition-shadow motion-safe:hover:shadow-[0_12px_30px_rgba(46,38,32,0.1)] motion-reduce:transition-none`}
    >
      <article
        aria-busy={pending}
        aria-label={`${candidate.name}, ${candidate.headline}`}
        className="grid gap-4"
        onPointerCancel={() => {
          origin.current = null;
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={eyebrow}>
              {candidate.source === "jev" ? "Jev-assisted ranking" : "Manual ranking"}
            </p>
            <h3 className="m-0 mt-1 text-[1.45rem] font-normal leading-[1.2] text-[#C85512]">
              {candidate.name}
            </h3>
            <p className="m-0 mt-1 text-[0.95rem] leading-[1.6] text-[#6B5E56]">
              {candidate.headline || "Professional profile"}
            </p>
          </div>
          {pending ? <Badge>Saving…</Badge> : null}
          {decided ? <Badge>Decision saved</Badge> : null}
        </div>

        <section aria-label="Why this member was suggested" className="grid gap-2">
          <p className={label}>Why you are seeing this member</p>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {reasons.map((reason) => (
              <li className="text-[0.95rem] leading-[1.6] text-[#2E2620]" key={reason}>
                <span aria-hidden="true" className="mr-2 text-[#DE6219]">
                  •
                </span>
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <dl className="m-0 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className={label}>Expertise</dt>
            <dd className="m-0 flex flex-wrap gap-2">
              {candidate.expertise.length ? (
                candidate.expertise.map((item) => (
                  <span className={chip} key={item}>
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-[0.9rem] text-[#6B5E56]">Not provided</span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className={label}>Goals</dt>
            <dd className="m-0 flex flex-wrap gap-2">
              {candidate.goals.length ? (
                candidate.goals.map((item) => (
                  <span className={chip} key={item}>
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-[0.9rem] text-[#6B5E56]">Not provided</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="grid gap-4 rounded-[10px] bg-[#F8F3EE] p-4 sm:grid-cols-3">
          <div className="min-w-0">
            <p className={label}>
              <Clock3 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 text-[#C85512]" />
              Availability
            </p>
            {availability.length ? (
              <ul className="m-0 grid list-none gap-1 p-0 text-[0.9rem] text-[#2E2620]">
                {availability.slice(0, 3).map((slot) => (
                  <li key={slot}>{slot}</li>
                ))}
                {availability.length > 3 ? <li>+{availability.length - 3} more</li> : null}
              </ul>
            ) : (
              <p className="m-0 text-[0.9rem] text-[#6B5E56]">Not provided</p>
            )}
          </div>
          <div className="min-w-0">
            <p className={label}>
              <Globe2 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 text-[#C85512]" />
              Meeting
            </p>
            <p className="m-0 text-[0.9rem] leading-[1.6] text-[#2E2620]">
              {describeMeeting(candidate.meetingFormat, candidate.timezone)}
            </p>
          </div>
          <div className="min-w-0">
            <p className={label}>
              <Sparkles aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 text-[#C85512]" />
              Schedule overlap
            </p>
            <p className="m-0 text-[0.9rem] leading-[1.6] text-[#2E2620]">
              {overlapText(candidate.overlapMinutes)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#E1D2C7] pt-4">
          <Button
            className="min-h-[44px] motion-reduce:transition-none"
            disabled={!enabled}
            onClick={() => onDecide("interested")}
            type="button"
          >
            <ArrowRight aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
            Interested
          </Button>
          <Button
            className="min-h-[44px] motion-reduce:transition-none"
            disabled={!enabled}
            onClick={() => onDecide("pass")}
            type="button"
          >
            <Ban aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
            Pass
          </Button>
          <p className="m-0 text-[0.78rem] leading-[1.4] text-[#6B5E56] sm:ml-auto">
            On touch screens, swipe right for Interested or left for Pass.
          </p>
        </div>
      </article>
    </Card>
  );
}
