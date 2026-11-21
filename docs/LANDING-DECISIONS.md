# Landing page — decision log (tw-land-lead)

Mission source of truth: `docs/LANDING-MISSION.md`. This file records integration decisions and resolution of conflicts as the swarm works.

## Frozen contract (unchanged, enforced)

- `DesertBackdrop({ children, className? }: { children: ReactNode; className?: string })` — absolute-positioned layered desert SVG behind `children`; parallax internal via `useScrollProgress()`.
- `useScrollProgress(): { scrollY: number; progress: number }` — passive scroll listener + `requestAnimationFrame`; updates CSS custom property/transform, no React re-render per scroll frame; `translate3d()` only.
- Layer speeds (per mission): sky/sun slowest → `#F6A766` → `#F28A3E` → `#F07828` → foreground `#D9611A` + cacti fastest.
- `prefers-reduced-motion: reduce` → static landscape, no scroll-linked transforms.
- No horizontal overflow at 360px/1280px; decorative SVG `aria-hidden`.

## Ownership

| File | Owner |
|---|---|
| `components/site/DesertBackdrop.tsx`, `components/site/useScrollProgress.ts`, `components/site/desert-backdrop.css` | tw-terrain |
| `app/page.tsx`, `components/site/Hero.tsx`, `components/site/LandingSections.tsx` | tw-hero |
| `tests/e2e/landing.spec.ts`, `components/site/parallax.test.ts` | tw-qa |
| `docs/LANDING-DECISIONS.md` | tw-land-lead |
| `app/globals.css`, Git, deploy | controller |

## Decisions

1. **Test sequencing** — QA writes RED tests against the frozen contract first; terrain implements to GREEN; hero composes against the same contract in parallel. RED evidence is required before any implementation is judged.
2. **Scrim ownership** — hero scrim lives in Hero.tsx (tw-hero) own classes, not globals.css. Keeps controller-owned shared stylesheet untouched.
3. **Icons/metadata** — SVG is not a valid apple-touch-icon format; `app/apple-icon.png` (desert TW monogram) already generated. `app/icon.svg` from the shell slice is auto-detected; no duplicate `icons` entry in layout metadata.
4. **No fabricated content** — headline/CTAs reference existing seeded copy only; events remain the real public TechWomenAZ event links already in repo content; no invented stats/testimonials.
5. **globals.css stays untouched** — all terrain/hero styling scoped in `desert-backdrop.css` and component-level classNames. If a controller-side import becomes necessary, it is requested through the controller.
6. **Exactly one h1 on the landing page** (resolved conflict from tw-hero integration check): SiteRenderer auto-h1s the first eligible section, which collided with the hero headline. `SiteRendererProps` gains one backward-compatible optional prop `sectionsLevel2?: boolean` (default false = existing behavior everywhere else); `LandingSections` passes it. Assigned to tw-hero as a lead-reassigned scoped fix; all existing SiteRenderer tests must remain GREEN.
7. **Unit test discovery** — root `vitest.config.ts` excludes `components/site`; the working invocation for parallax/hero unit tests is `npx vitest run --config components/site/vitest.config.ts components/site` (verified by terrain, adopted for QA). No controller file edit required.

## Verification gates (before controller deploy)

- `npx vitest run components/site/parallax.test.ts` → GREEN
- `npx playwright test tests/e2e/landing.spec.ts` → GREEN at 1280 + 360
- `npm run typecheck` → clean for landing files
- `npm run build` → completes
- Manual/agent check: reduced-motion disables parallax; content readable over terrain.

## Integration review

(updated as reports land)

- **tw-terrain: DONE (12:31).** 8 stacked layers from exact source path data, travel 0/8/12/40/70/100/130/140px, passive scroll + rAF writing `--scroll-y`/`--progress` on `:root`, zero setState per frame, reduced-motion `transform:none`, `useId` scoping, `aria-hidden`. RED (isolated `@terrain` harness, 1 suite failed on missing module) → GREEN (14 tests: parallax math, exact paths/colors, unique ids, aria-hidden, reduced-motion, translate3d, overflow). `npm run typecheck` EXIT 0. Verified QA invocation path.
- **tw-hero: DONE (12:32).** app/page.tsx + Hero.tsx + LandingSections.tsx; DesertBackdrop via exact contract; hero title/body from seeded `public.site` + real tagline; CTAs /join, /about, Givebutter link. Scrim scoped in Hero. TDD reproducer RED ('Cannot find module ./Hero') → GREEN 5/5; components suite 32/32. Typecheck clean, build completes. Flagged second-h1 issue → lead decision 6 assigned back to tw-hero. [pending: H1 fix GREEN]
- **tw-qa:** RED suite written against contract; running unit via the adopted invocation + Playwright e2e. [pending GREEN]
- **Lead verification (after all GREEN):** `npx vitest run --config components/site/vitest.config.ts components/site`; `npm run test:e2e -- landing.spec.ts`; `npm run typecheck`; `npm run build`.
