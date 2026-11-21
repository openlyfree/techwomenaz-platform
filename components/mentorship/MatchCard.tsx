"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Match } from "@/lib/contracts";
import { Badge, Card } from "@/components/ui";
import { actionLink, card, eyebrow, label } from "./styles";
import { matchNextStep } from "./utils";

export function MatchCard({ match }: { match: Match }) {
  return (
    <Card className={card}>
      <article className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={eyebrow}>Mentorship match</p>
            <h3 className="m-0 mt-1 text-[1.35rem] font-normal leading-[1.25] text-[#C85512]">
              {match.mentorName} &amp; {match.menteeName}
            </h3>
          </div>
          <Badge>{match.status.replace(/-/g, " ")}</Badge>
        </div>

        <div className="grid gap-2">
          <div>
            <p className={label}>Goal</p>
            <p className="m-0 text-[0.95rem] leading-[1.6] text-[#2E2620]">
              {match.goal || "No goal recorded yet."}
            </p>
          </div>
          <div className="rounded-[10px] bg-[#F8F3EE] px-4 py-3">
            <p className={label}>Clear next step</p>
            <p className="m-0 text-[0.92rem] leading-[1.6] text-[#2E2620]">{matchNextStep(match)}</p>
          </div>
        </div>

        <div>
          <Link className={actionLink} href={`/portal/relationships/${encodeURIComponent(match.id)}`}>
            Open match details <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </article>
    </Card>
  );
}
