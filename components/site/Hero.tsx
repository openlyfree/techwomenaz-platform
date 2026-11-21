"use client";

import type { SiteSection } from "@/lib/contracts";
import { SITE_LINKS, safeHref } from "./content";
import { Arches } from "./SiteRenderer";

/** Site tagline already published in app/layout.tsx metadata — real brand copy. */
export const HERO_TAGLINE = "Find your people. Grow your possibilities.";

/**
 * Scoped hero styles live here so globals.css stays controller-owned.
 * The landscape is now a single fixed, full-viewport backdrop mounted once by
 * app/page.tsx, so the hero itself is transparent: only a light cream scrim
 * sits between the copy and the moving terrain.
 */
const HERO_STYLES = `
.twaz-hero {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  background: transparent;
}
.twaz-hero__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(92% 72% at 12% 30%, rgba(255, 251, 248, 0.5) 0%, rgba(255, 251, 248, 0) 70%),
    linear-gradient(180deg, rgba(248, 243, 238, 0.42) 0%, rgba(248, 243, 238, 0.22) 42%, rgba(248, 243, 238, 0.08) 74%, rgba(248, 243, 238, 0.02) 100%);
}
.twaz-hero__inner { position: relative; z-index: 2; }
.twaz-hero__headline {
  color: #22395A;
  text-shadow: 0 1px 0 rgba(255, 251, 248, 0.5), 0 2px 18px rgba(255, 251, 248, 0.35);
}
.twaz-hero__scroll { color: #6B5E56; }
@media (prefers-reduced-motion: reduce) {
  .twaz-hero__scroll { display: none; }
}
`;

export interface HeroProps {
  /** The published `hero` section from `public.site`. */
  section?: SiteSection;
}

export interface HeroCopy {
  eyebrow: string;
  tagline: string;
  title: string;
  body: string;
}

/** Pure copy resolution so the hero always reflects published public.site data. */
export function resolveHeroCopy(section?: SiteSection): HeroCopy {
  return {
    eyebrow: "Phoenix · Scottsdale · East Valley",
    tagline: HERO_TAGLINE,
    title: section?.title?.trim() ?? "",
    body: section?.body?.trim() ?? "",
  };
}

const linkBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-6 py-3 text-[11px] font-semibold uppercase leading-none tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22395A]";

/**
 * Full-viewport editorial hero. The TechWomenAZ desert landscape is rendered
 * once behind the whole page by <DesertBackdrop> in app/page.tsx; this section
 * only contributes a light scrim and the published copy, including the
 * preserved Givebutter support link.
 */
export function Hero({ section }: HeroProps) {
  if (!section) return null;

  const copy = resolveHeroCopy(section);
  const donate = safeHref(SITE_LINKS.donate) ?? SITE_LINKS.donate;

  return (
    <section
      id={section.id}
      aria-labelledby="twaz-hero-title"
      className="twaz-hero relative isolate min-h-screen w-full"
    >
      <style>{HERO_STYLES}</style>
      <div className="twaz-hero__scrim" aria-hidden="true" />
      <div className="twaz-hero__inner mx-auto flex min-h-screen w-full max-w-[1140px] flex-col justify-center gap-5 px-4 py-16 sm:gap-6 sm:px-6 sm:py-24">
        <p className="m-0 text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.24em] text-[#6B5E56] sm:text-[11px]">
          {copy.eyebrow}
        </p>
        <h1
          id="twaz-hero-title"
          className="twaz-hero__headline m-0 max-w-[15ch] font-normal leading-[1.06] tracking-[-0.02em]"
          style={{ fontFamily: '"Fraunces", Georgia, "Times New Roman", serif', fontSize: "clamp(2.6rem, 11vw, 5.6rem)" }}
        >
          {copy.tagline}
        </h1>
        {copy.title ? (
          <p
            className="m-0 max-w-[26ch] font-normal leading-[1.25] text-[#C85512]"
            style={{ fontFamily: '"Fraunces", Georgia, "Times New Roman", serif', fontSize: "clamp(1.35rem, 5vw, 2rem)" }}
          >
            {copy.title}
          </p>
        ) : null}
        {copy.body ? (
          <p className="m-0 max-w-[52ch] text-[0.98rem] leading-[1.7] text-[#2E2620] sm:text-[1.05rem]">
            {copy.body}
          </p>
        ) : null}
        <div className="mt-1">
          <Arches />
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 pt-1">
          <a
            className={`${linkBase} border-[#22395A] bg-[#22395A] hover:bg-[#1A2B45]`}
            href="/join"
            style={{ color: "#FFFFFF" }}
          >
            Find your people
          </a>
          <a
            className={`${linkBase} border-[#22395A] bg-transparent text-[#22395A] hover:bg-[#22395A] hover:text-white`}
            href="/about"
          >
            Our community
          </a>
          <a
            className={`${linkBase} border-[#C85512] bg-transparent text-[#C85512] hover:bg-[#C85512] hover:text-white`}
            href={donate}
            rel="noopener noreferrer"
            target="_blank"
          >
            Support our work
          </a>
        </div>
        <p className="twaz-hero__scroll m-0 pt-6 text-[10px] font-semibold uppercase tracking-[0.22em]" aria-hidden="true">
          Scroll to explore ↓
        </p>
      </div>
    </section>
  );
}

export default Hero;
