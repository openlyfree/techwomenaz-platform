"use client";

import { useId, useState } from "react";
import { AlertCircle, ArrowUpRight, Check, Instagram, Linkedin, Mail } from "lucide-react";
import type {
  EventRecord,
  PartnerRecord,
  SiteDocument,
  SiteSection,
  TeamRecord,
} from "@/lib/contracts";
import {
  BRAND,
  BODY_FONT,
  DISPLAY_FONT,
  SITE_LINKS,
  formatEventDateRange,
  getEventBadge,
  isExternalHref,
  isPastEvent,
  partitionEvents,
  parseListBody,
  safeHref,
} from "./content";

export interface SiteRendererProps {
  document: SiteDocument;
  events?: EventRecord[];
  team?: TeamRecord[];
  partners?: PartnerRecord[];
  preview?: boolean;
  /** When true, every section heading renders at level 2 (landing page after the hero h1). */
  sectionsLevel2?: boolean;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--twaz-accent)]";

function Wrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1140px] px-4 sm:px-6 ${className}`}>{children}</div>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`m-0 text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.24em] ${
        light ? "text-[#FFE7D4]" : "text-[var(--twaz-accent-text)]"
      }`}
    >
      {children}
    </p>
  );
}

function SectionHeading({
  title,
  body,
  light = false,
  align = "center",
  level = 2,
}: {
  title: string;
  body?: string;
  light?: boolean;
  align?: "center" | "left";
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div
      className={`mb-9 grid gap-3 ${align === "center" ? "mx-auto max-w-[720px] justify-items-center text-center" : "max-w-[720px]"}`}
    >
      <Heading
        className="m-0 font-normal leading-[1.15] tracking-[-0.01em] text-[var(--twaz-accent-text)]"
        style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2rem, 7vw, 2.9rem)" }}
      >
        {title}
      </Heading>
      {body ? (
        <p className={`m-0 max-w-[60ch] text-[1rem] leading-[1.7] ${light ? "text-white/85" : "text-[#6B5E56]"}`}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

/** Recurring desert-sun arch motif, drawn inline so it works without image assets. */
export function Arches({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`block h-[26px] w-[44px] text-[var(--twaz-arch)] ${className}`}
      viewBox="0 0 44 26"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 25 A19 19 0 0 1 41 25" />
        <path d="M10 25 A12 12 0 0 1 34 25" />
        <path d="M17 25 A5 5 0 0 1 27 25" />
      </g>
    </svg>
  );
}

function DesertArchArt() {
  // Stable per-instance ids so multiple SiteRenderers on one page (e.g. a
  // draft preview beside a published preview) do not collide on SVG defs.
  const uid = useId();
  const clipId = `${uid}-arch-clip`;
  const skyId = `${uid}-sky`;
  return (
    <svg
      aria-hidden="true"
      className="mx-auto block h-auto w-full max-w-[340px]"
      viewBox="0 0 360 470"
      role="presentation"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M10 465 V190 A170 170 0 0 1 350 190 V465 Z" />
        </clipPath>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FCE9D8" />
          <stop offset="0.55" stopColor="#F9CFA6" />
          <stop offset="1" stopColor="#F5AE72" />
        </linearGradient>
      </defs>
      <path
        d="M2 470 V190 A178 178 0 0 1 358 190 V470"
        fill="none"
        stroke="#F07828"
        strokeWidth="1.4"
        opacity="0.7"
      />
      <g clipPath={`url(#${clipId})`}>
        <rect width="360" height="470" fill={`url(#${skyId})`} />
        <circle cx="180" cy="250" r="78" fill="#FBEBDD" opacity="0.9" />
        <path d="M0 300 C60 270 100 285 150 262 C200 240 250 275 300 258 C330 248 350 255 360 252 V470 H0Z" fill="#F6A766" />
        <path d="M0 338 C70 312 120 330 180 306 C240 284 300 320 360 300 V470 H0Z" fill="#F28A3E" />
        <path d="M0 382 C80 360 150 378 220 356 C280 338 330 360 360 352 V470 H0Z" fill="#F07828" />
        <path d="M0 420 C90 404 180 422 260 406 C310 396 340 404 360 400 V470 H0Z" fill="#D9611A" />
        <g fill={BRAND.navy}>
          <rect x="232" y="232" width="20" height="210" rx="10" />
          <path d="M232 340 h-22 a10 10 0 0 1 -10 -10 v-46 a10 10 0 0 1 20 0 v36 h12Z" />
          <path d="M252 312 h22 a10 10 0 0 0 10 -10 v-52 a10 10 0 0 0 -20 0 v42 h-12Z" />
          <rect x="105" y="296" width="15" height="150" rx="7.5" />
          <path d="M105 372 h-15 a7.5 7.5 0 0 1 -7.5 -7.5 v-32 a7.5 7.5 0 0 1 15 0 v25 h7.5Z" />
          <path d="M120 352 h15 a7.5 7.5 0 0 0 7.5 -7.5 v-28 a7.5 7.5 0 0 0 -15 0 v21 h-7.5Z" />
        </g>
      </g>
    </svg>
  );
}

function CtaLink({
  href,
  children,
  variant = "primary",
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "navy";
  external?: boolean;
}) {
  const safe = safeHref(href);
  const base = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-6 py-3 text-[11px] font-semibold uppercase leading-none tracking-[0.16em] transition-colors ${focusRing}`;
  const styles = {
    primary: "border-[var(--twaz-accent)] bg-[var(--twaz-accent)] text-white hover:bg-[var(--twaz-accent-deep)] hover:border-[var(--twaz-accent-deep)]",
    ghost: "border-[var(--twaz-accent)] bg-transparent text-[var(--twaz-accent-text)] hover:bg-[var(--twaz-accent)] hover:text-white",
    navy: "border-[#22395A] bg-transparent text-white hover:bg-white hover:text-[#22395A]",
  }[variant];
  return (
    <a
      className={`${base} ${styles}`}
      href={safe ?? "#"}
      {...(external && safe && isExternalHref(safe)
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
      {external ? <ArrowUpRight aria-hidden="true" className="h-4 w-4" /> : null}
    </a>
  );
}

function emphasizeTitle(title: string) {
  const marked = /^(.*?)\*(.+?)\*(.*)$/.exec(title);
  const source = marked ? `${marked[1]}${marked[2]}${marked[3]}` : title;
  const target = marked ? marked[2]! : "women";
  const index = source.toLowerCase().indexOf(target.toLowerCase());
  if (index < 0) return title;
  return (
    <>
      {source.slice(0, index)}
      <em className="italic text-[#DE6219]">{source.slice(index, index + target.length)}</em>
      {source.slice(index + target.length)}
    </>
  );
}

function HeroSection({ section }: { section: SiteSection }) {
  return (
    <section id={section.id} className="bg-[#F8F3EE] py-7 sm:py-10">
      <Wrap>
        <div className="grid overflow-hidden rounded-[6px] bg-[#EFE4DD] lg:grid-cols-[1.15fr_1fr]">
          <div className="grid justify-items-center gap-5 px-5 py-11 text-center sm:px-10 sm:py-14 lg:px-16 lg:py-20">
            <Eyebrow>Phoenix · Scottsdale · East Valley</Eyebrow>
            <h1
              className="m-0 max-w-[16ch] font-normal leading-[1.12] tracking-[-0.015em] text-[var(--twaz-accent-text)]"
              style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2.35rem, 8.5vw, 4.4rem)" }}
            >
              {emphasizeTitle(section.title)}
            </h1>
            <Arches />
            {section.body ? (
              <p className="m-0 max-w-[46ch] text-[1rem] leading-[1.7] text-[#6B5E56]">{section.body}</p>
            ) : null}
            <div className="flex w-full flex-wrap items-center justify-center gap-3">
              <CtaLink href="/events">Explore events</CtaLink>
              <CtaLink href="/join" variant="ghost">
                Become a member
              </CtaLink>
            </div>
          </div>
          <div className="grid place-items-center bg-[#E7D7CC] px-6 pb-8 pt-2 sm:px-10 sm:pb-10">
            <DesertArchArt />
          </div>
        </div>
      </Wrap>
    </section>
  );
}

function MissionSection({ section }: { section: SiteSection }) {
  const marker = "the entire Arizona ecosystem grows.";
  const at = section.body.toLowerCase().indexOf(marker.toLowerCase());
  const lead = at >= 0 ? section.body.slice(0, at) : section.body;
  const tail = at >= 0 ? section.body.slice(at) : "";
  return (
    <section id={section.id} className="bg-[var(--twaz-accent)] py-14 text-white sm:py-16">
      <Wrap className="grid justify-items-center gap-5 text-center">
        <Eyebrow light>{section.title}</Eyebrow>
        <blockquote
          className="m-0 max-w-[36ch] font-normal leading-[1.4] text-white"
          style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.4rem, 5.5vw, 2.1rem)" }}
        >
          {lead}
          {tail ? <em className="italic text-[#FFE7D4]">{tail}</em> : null}
        </blockquote>
        <p aria-hidden="true" className="m-0 tracking-[0.5em] text-[#FFE7D4]">
          • • •
        </p>
      </Wrap>
    </section>
  );
}

function ProgramsSection({ section, level }: { section: SiteSection; level: 1 | 2 }) {
  const { intro, items } = parseListBody(section.body);
  return (
    <section id={section.id} className="bg-[#F8F3EE] py-16 sm:py-20">
      <Wrap>
        <SectionHeading title={section.title} body={intro || undefined} level={level} />
        {items.length ? (
          <div className="grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.title} className="grid min-w-0 justify-items-center gap-2 text-center">
                <Arches />
                <h3
                  className="m-0 text-[1.25rem] font-normal leading-[1.2] text-[#DE6219]"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  {item.title}
                </h3>
                <p className="m-0 max-w-[30ch] text-[0.95rem] leading-[1.6] text-[#6B5E56]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Wrap>
    </section>
  );
}

function MentorshipSection({
  section,
  involve,
  level,
}: {
  section: SiteSection;
  involve: boolean;
  level: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  if (involve) {
    return (
      <section id={section.id} className="bg-[#F8F3EE] py-6 sm:py-10">
        <Wrap>
          <div className="grid overflow-hidden rounded-[6px] lg:grid-cols-2">
            <div className="grid justify-items-center gap-4 bg-[var(--twaz-accent)] px-6 py-12 text-center text-white sm:px-10 sm:py-16">
              <Eyebrow light>Get involved</Eyebrow>
              <Heading
                className="m-0 max-w-[18ch] font-normal leading-[1.15] text-white"
                style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2rem, 7vw, 2.9rem)" }}
              >
                {section.title}
              </Heading>
              <p aria-hidden="true" className="m-0 tracking-[0.5em] text-[#FFE7D4]">
                • • •
              </p>
            </div>
            <div className="grid content-center gap-6 bg-[#E7D7CC] px-6 py-10 sm:px-10">
              {section.body ? (
                <p className="m-0 text-[1rem] leading-[1.7] text-[#2E2620]">{section.body}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <CtaLink href="/join">Become a member</CtaLink>
                <CtaLink href={SITE_LINKS.donate} variant="ghost" external>
                  Make a donation
                </CtaLink>
              </div>
            </div>
          </div>
        </Wrap>
      </section>
    );
  }

  return (
    <section id={section.id} className="bg-[#22395A] py-16 text-white sm:py-20">
      <Wrap className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div className="grid max-w-[720px] justify-items-start gap-5">
          <Eyebrow light>Mentorship & community</Eyebrow>
          <Heading
            className="m-0 font-normal leading-[1.15] text-white"
            style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2rem, 7vw, 2.9rem)" }}
          >
            {section.title}
          </Heading>
          <Arches />
          {section.body ? (
            <p className="m-0 max-w-[60ch] text-[1rem] leading-[1.7] text-white/85">{section.body}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <CtaLink href="/join">Find your community</CtaLink>
            <CtaLink href="/login" variant="navy">
              Member login
            </CtaLink>
          </div>
        </div>
        <svg
          aria-hidden="true"
          className="hidden h-[220px] w-[220px] text-[#E9A872] lg:block"
          viewBox="0 0 44 26"
          preserveAspectRatio="none"
        >
          <g stroke="currentColor" strokeWidth="0.4" fill="none">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <path key={index} d={`M${3 + index * 2} 25 A${19 - index * 2} ${19 - index * 2} 0 0 1 ${41 - index * 2} 25`} />
            ))}
          </g>
        </svg>
      </Wrap>
    </section>
  );
}

function EventCard({ event }: { event: EventRecord }) {
  const past = isPastEvent(event);
  const badge = getEventBadge(event);
  const label = event.location;
  const href = safeHref(event.registerUrl);
  const descriptionLines = event.description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const details = descriptionLines.slice(1);
  return (
    <article className="grid min-w-0 gap-4 rounded-[6px] bg-[#FFFBF8] p-5 sm:p-7 md:grid-cols-[96px_1fr_auto] md:gap-7">
      <div className="flex items-center gap-4 md:block md:w-[96px]">
        <div className="w-[96px] shrink-0 rounded-t-[48px] rounded-b-[6px] bg-[var(--twaz-accent)] px-2 pb-3 pt-5 text-center text-white">
          <div className="text-[11px] font-medium uppercase leading-none tracking-[0.2em]">{badge.month}</div>
          <div
            className="mt-1.5 leading-none"
            style={{ fontFamily: DISPLAY_FONT, fontSize: "2.3rem" }}
          >
            {badge.day}
          </div>
        </div>
        <span
          className={`inline-flex min-h-[28px] items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] md:hidden ${
            past ? "bg-[#EFE4DD] text-[#6B5E56]" : "bg-[#22395A] text-white"
          }`}
        >
          {past ? "Past event" : "Upcoming"}
        </span>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#22395A]">
            {formatEventDateRange(event)}
          </span>
          <span
            className={`hidden rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] md:inline-flex ${
              past ? "bg-[#EFE4DD] text-[#6B5E56]" : "bg-[#22395A] text-white"
            }`}
          >
            {past ? "Past event" : "Upcoming"}
          </span>
        </div>
        <h3
          className="m-0 mb-2 text-[1.5rem] font-normal leading-[1.2] text-[var(--twaz-accent-text)]"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {event.title}
        </h3>
        {descriptionLines[0] ? (
          <p className="m-0 text-[0.98rem] leading-[1.65] text-[#6B5E56]">{descriptionLines[0]}</p>
        ) : null}
        {label ? (
          <p className="m-0 mt-1 text-[0.88rem] leading-[1.6] text-[#6B5E56]">{label}</p>
        ) : null}
        {details.length ? (
          <ul className="mt-3 grid gap-1.5 border-t border-[#E1D2C7] pt-3">
            {details.map((line) => {
              const split = /^(.{3,9})\s+—\s+(.+)$/.exec(line);
              return (
                <li key={line} className="grid gap-0.5 text-[0.92rem] text-[#2E2620] sm:grid-cols-[72px_1fr] sm:gap-3">
                  {split ? (
                    <>
                      <time className="text-[0.76rem] font-medium uppercase tracking-[0.1em] text-[var(--twaz-accent-text)]">
                        {split[1]}
                      </time>
                      <span>{split[2]}</span>
                    </>
                  ) : (
                    <span className="sm:col-start-2">{line}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {href ? (
        <div className="flex items-start md:justify-end">
          <CtaLink href={href} variant="primary" external>
            {past ? "View details" : "Register"}
          </CtaLink>
        </div>
      ) : null}
    </article>
  );
}

function EventsSection({
  section,
  events,
  level,
}: {
  section: SiteSection;
  events: EventRecord[];
  level: 1 | 2;
}) {
  const { upcoming, past } = partitionEvents(events);
  return (
    <section id={section.id} className="bg-[#EFE4DD] py-16 sm:py-20">
      <Wrap>
        <SectionHeading title={section.title} body={section.body || undefined} level={level} />
        {upcoming.length || past.length ? (
          <div className="mx-auto grid max-w-[920px] gap-5">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {past.length ? (
              <div className="mt-3 grid gap-4">
                <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6B5E56]">
                  Past events
                </h3>
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-[920px] rounded-[6px] bg-[#FFFBF8] px-6 py-9 text-center text-[#6B5E56]">
            <p className="m-0">
              New events are on the way. Follow us on{" "}
              <a
                className={`inline-flex min-h-[44px] items-center font-semibold text-[var(--twaz-accent-text)] underline underline-offset-4 ${focusRing}`}
                href={safeHref(SITE_LINKS.instagram) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>{" "}
              or{" "}
              <a
                className={`inline-flex min-h-[44px] items-center font-semibold text-[var(--twaz-accent-text)] underline underline-offset-4 ${focusRing}`}
                href={safeHref(SITE_LINKS.linkedin) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>{" "}
              to hear first.
            </p>
          </div>
        )}
      </Wrap>
    </section>
  );
}

function TeamAvatar({ member }: { member: TeamRecord }) {
  const src = safeHref(member.photo);
  const [failed, setFailed] = useState(false);
  const initials = member.name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2);
  return (
    <div className="relative mb-3 aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-t-[50%] rounded-b-[8px] bg-[#E7D7CC]">
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[2.2rem] text-[var(--twaz-accent-text)]" style={{ fontFamily: DISPLAY_FONT }}>
          {initials || "TW"}
        </span>
      </div>
      {src && isExternalHref(src) && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="relative h-full w-full object-cover object-top"
          loading="lazy"
          onError={() => setFailed(true)}
          src={src}
        />
      ) : null}
    </div>
  );
}

function TeamSection({
  section,
  team,
  level,
}: {
  section: SiteSection;
  team: TeamRecord[];
  level: 1 | 2;
}) {
  return (
    <section id={section.id} className="bg-[#EFE4DD] py-16 sm:py-20">
      <Wrap>
        <SectionHeading title={section.title} body={section.body || undefined} level={level} />
        {team.length ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-7 lg:grid-cols-5">
            {team.map((member) => (
              <div key={member.id} className="grid min-w-0 justify-items-center text-center">
                <TeamAvatar member={member} />
                <h3
                  className="m-0 text-[1.1rem] font-normal leading-[1.25] text-[#2E2620]"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  {member.name}
                </h3>
                <p className="m-0 text-[0.68rem] font-semibold uppercase leading-[1.5] tracking-[0.12em] text-[var(--twaz-accent-text)]">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-center text-[#6B5E56]">Our team information is not available right now.</p>
        )}
      </Wrap>
    </section>
  );
}

function PartnerLogo({ partner }: { partner: PartnerRecord }) {
  const src = safeHref(partner.logo);
  const url = safeHref(partner.url);
  const [imageState, setImageState] = useState<"pending" | "loaded" | "failed">("pending");
  const showImage = src && isExternalHref(src) && imageState !== "failed";
  const inner = (
    <div className="relative grid h-full w-full place-items-center">
      {imageState !== "loaded" ? (
        <span className="px-2 text-center text-[0.95rem] font-medium text-[#6B5E56]">
          {partner.name}
        </span>
      ) : null}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={imageState === "loaded" ? partner.name : ""}
          className={`max-h-[76px] max-w-full object-contain ${imageState === "loaded" ? "relative" : "absolute inset-0 m-auto opacity-0"}`}
          loading="lazy"
          onError={() => setImageState("failed")}
          onLoad={() => setImageState("loaded")}
          src={src}
        />
      ) : null}
    </div>
  );
  const classes =
    "grid h-[112px] w-full max-w-[230px] place-items-center rounded-[6px] bg-white p-5 transition-transform hover:-translate-y-0.5";
  return url && isExternalHref(url) ? (
    <a className={classes} href={url} rel="noopener noreferrer" target="_blank">
      {inner}
    </a>
  ) : (
    <div className={classes}>{inner}</div>
  );
}

function PartnersSection({
  section,
  partners,
  level,
}: {
  section: SiteSection;
  partners: PartnerRecord[];
  level: 1 | 2;
}) {
  const email = safeHref(`mailto:${SITE_LINKS.email}`);
  return (
    <section id={section.id} className="bg-[#F8F3EE] py-16 sm:py-20">
      <Wrap>
        <SectionHeading title={section.title} level={level} />
        {partners.length ? (
          <div className="flex flex-wrap items-center justify-center gap-5">
            {partners.map((partner) => (
              <PartnerLogo key={partner.id} partner={partner} />
            ))}
          </div>
        ) : (
          <p className="m-0 text-center text-[#6B5E56]">
            Partner information is not available right now.
          </p>
        )}
        <p className="m-0 mt-9 text-center text-[0.95rem] text-[#6B5E56]">
          Interested in sponsoring? Email us at{" "}
          {email ? (
            <a
              className={`inline-flex min-h-[44px] items-center font-semibold text-[var(--twaz-accent-text)] underline underline-offset-4 ${focusRing}`}
              href={email}
            >
              {SITE_LINKS.email}
            </a>
          ) : (
            SITE_LINKS.email
          )}
          .
        </p>
      </Wrap>
    </section>
  );
}

function CopyEmailButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#E1D2C7] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2E2620] hover:border-[var(--twaz-accent)] hover:text-[var(--twaz-accent-text)] ${focusRing}`}
      onClick={() => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        navigator.clipboard.writeText(SITE_LINKS.email).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      type="button"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
      {copied ? "Copied" : "Copy email"}
    </button>
  );
}

function ContactSection({ section, level }: { section: SiteSection; level: 1 | 2 }) {
  const email = safeHref(`mailto:${SITE_LINKS.email}`);
  return (
    <section id={section.id} className="bg-[#EFE4DD] py-16 sm:py-20">
      <Wrap>
        <SectionHeading title={section.title} body={section.body || undefined} level={level} />
        <div className="mx-auto grid max-w-[900px] gap-8 text-center sm:grid-cols-3 sm:gap-0">
          <div className="grid justify-items-center gap-2 px-2 sm:border-r sm:border-[#E1D2C7]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--twaz-accent-text)]">Email</span>
            <span className="break-all text-[1.15rem]" style={{ fontFamily: DISPLAY_FONT }}>
              {email ? (
                <a
                  className={`inline-flex min-h-[44px] items-center underline underline-offset-4 ${focusRing}`}
                  href={email}
                >
                  {SITE_LINKS.email}
                </a>
              ) : (
                SITE_LINKS.email
              )}
            </span>
            <CopyEmailButton />
          </div>
          <div className="grid justify-items-center gap-2 px-2 sm:border-r sm:border-[#E1D2C7]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--twaz-accent-text)]">Follow</span>
            <span className="flex flex-wrap items-center justify-center gap-3 text-[1.05rem]" style={{ fontFamily: DISPLAY_FONT }}>
              <a
                className={`inline-flex min-h-[44px] items-center gap-1.5 underline underline-offset-4 ${focusRing}`}
                href={safeHref(SITE_LINKS.instagram) ?? "#"}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Instagram aria-hidden="true" className="h-4 w-4" /> Instagram
              </a>
              <a
                className={`inline-flex min-h-[44px] items-center gap-1.5 underline underline-offset-4 ${focusRing}`}
                href={safeHref(SITE_LINKS.linkedin) ?? "#"}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Linkedin aria-hidden="true" className="h-4 w-4" /> LinkedIn
              </a>
            </span>
          </div>
          <div className="grid justify-items-center gap-2 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--twaz-accent-text)]">Based in</span>
            <span className="text-[1.15rem]" style={{ fontFamily: DISPLAY_FONT }}>
              Phoenix, Arizona
            </span>
            <span className="text-[0.9rem] text-[#6B5E56]">Proudly serving the Valley of the Sun</span>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <CtaLink href="/join">Join the community</CtaLink>
          <CtaLink href={SITE_LINKS.donate} variant="ghost" external>
            Support our work
          </CtaLink>
        </div>
        <p className="m-0 mt-8 flex items-center justify-center gap-2 text-center text-[0.85rem] text-[#6B5E56]">
          <Mail aria-hidden="true" className="h-4 w-4" />
          <a
            className={`inline-flex min-h-[44px] items-center underline underline-offset-4 ${focusRing}`}
            href={safeHref(SITE_LINKS.candid) ?? "#"}
            rel="noopener noreferrer"
            target="_blank"
          >
            View our Candid profile
          </a>
        </p>
      </Wrap>
    </section>
  );
}

const VISIBLE_HEADING_TYPES: SiteSection["type"][] = [
  "hero",
  "programs",
  "mentorship",
  "events",
  "team",
  "partners",
  "contact",
];

function SectionView({
  section,
  events,
  team,
  partners,
  preview,
  firstHeadingId,
  sectionsLevel2 = false,
}: {
  section: SiteSection;
  events: EventRecord[];
  team: TeamRecord[];
  partners: PartnerRecord[];
  preview: boolean;
  firstHeadingId?: string;
  sectionsLevel2?: boolean;
}) {
  const hidden = preview && !section.enabled;
  const level: 1 | 2 = !sectionsLevel2 && section.id === firstHeadingId ? 1 : 2;
  let content: React.ReactNode = null;
  switch (section.type) {
    case "hero":
      content = <HeroSection section={section} />;
      break;
    case "mission":
      content = <MissionSection section={section} />;
      break;
    case "programs":
      content = <ProgramsSection section={section} level={level} />;
      break;
    case "mentorship":
      content = (
        <MentorshipSection
          section={section}
          involve={section.id.toLowerCase().includes("involved")}
          level={level}
        />
      );
      break;
    case "events":
      content = <EventsSection section={section} events={events} level={level} />;
      break;
    case "team":
      content = <TeamSection section={section} team={team} level={level} />;
      break;
    case "partners":
      content = <PartnersSection section={section} partners={partners} level={level} />;
      break;
    case "contact":
      content = <ContactSection section={section} level={level} />;
      break;
    default:
      content = null;
  }
  if (!content) return null;
  return (
    <div
      className={hidden ? "relative outline-dashed outline-2 outline-offset-[-2px] outline-[var(--twaz-accent)] opacity-70" : ""}
    >
      {hidden ? (
        <span className="absolute right-3 top-3 z-10 inline-flex min-h-[28px] items-center rounded-full bg-[var(--twaz-accent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          <AlertCircle aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          Hidden from public site
        </span>
      ) : null}
      {content}
    </div>
  );
}

/**
 * Renders published site sections from the `public.site` (or admin content)
 * document. Kept presentation-only so staff previews and the live site match.
 */
export function SiteRenderer({
  document,
  events = [],
  team = [],
  partners = [],
  preview = false,
  sectionsLevel2 = false,
}: SiteRendererProps) {
  const visibleSections = document.sections.filter((section) => preview || section.enabled);
  const firstHeadingId = sectionsLevel2
    ? undefined
    : visibleSections.find((section) => VISIBLE_HEADING_TYPES.includes(section.type))?.id;
  const fallbackHeading = sectionsLevel2
    ? null
    : visibleSections.some((section) => VISIBLE_HEADING_TYPES.includes(section.type))
      ? null
      : visibleSections[0]?.title;
  const palette =
    document.theme === "navy"
      ? {
          "--twaz-accent": BRAND.navy,
          "--twaz-accent-deep": "#1A2B45",
          "--twaz-accent-text": BRAND.navy,
          "--twaz-arch": BRAND.apricot,
        }
      : {
          "--twaz-accent": BRAND.orange,
          "--twaz-accent-deep": BRAND.orangeDeep,
          "--twaz-accent-text": BRAND.orangeText,
          "--twaz-arch": BRAND.logoOrange,
        };
  return (
    <div
      data-theme={document.theme === "navy" ? "navy" : "desert"}
      style={{ ...palette, fontFamily: BODY_FONT, color: BRAND.ink, backgroundColor: BRAND.cream } as React.CSSProperties}
    >
      {fallbackHeading ? <h1 className="sr-only">{fallbackHeading}</h1> : null}
      {visibleSections.map((section) => (
        <SectionView
          key={section.id}
          section={section}
          events={events}
          team={team}
          partners={partners}
          preview={preview}
          firstHeadingId={firstHeadingId}
          sectionsLevel2={sectionsLevel2}
        />
      ))}
    </div>
  );
}

export default SiteRenderer;
