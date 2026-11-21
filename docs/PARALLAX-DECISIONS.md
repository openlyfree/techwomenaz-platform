# Parallax perception fix — lead decisions record

Owner: tw-parallax-lead (wP:p1). Authority: docs/PARALLAX-FIX-MISSION.md.
Status: DISPATCHED 2026-11-21. No Git/deploy performed by this swarm.

## Diagnosis adopted
Parallax fires (`--progress` writes, transforms change) but is imperceptible because
the landscape lives inside the hero, which scrolls away with the page. Fix is
architectural, not "more travel": fixed full-viewport backdrop + document-wide scroll
progress + much larger layer travel.

## Frozen contract (all workers build against exactly this)

### D1 — Architecture
- One `<DesertBackdrop />` instance, rendered by **`SiteBackdropMount.tsx`**
  (new, tw-sections) as the first child of `<main>` in `app/page.tsx`, **outside**
  the loading early-return so the terrain exists during `SiteLoading`.
- `.twaz-desert`: `position: fixed; inset: 0; z-index: 0; pointer-events: none;`
  Scene `overflow: hidden` → layers can never create page overflow.
- Page content wrapper in `app/page.tsx`: `relative z-[1]` so all content stacks
  above the backdrop.

### D2 — Controller request (NOT applied by this swarm)
`app/layout.tsx` is controller-owned. Proposed one-line addition, to be applied by the
controller after review, at which point `app/page.tsx` drops its local mount:
  `<SiteBackdropMount />` immediately inside `<body>`.
Until then the `page.tsx` mount covers every landing-page route (all parallax routes).

### D3 — Travel & drift (px at full document scroll)
`DESERT_LAYER_TRAVEL = { frame: 0, sky: 20, sun: 45, far: 140, mid: 240, near: 340,
foreground: 440, cacti: 520 }` (mission values). Keys unchanged.
Horizontal drift (`--layer-drift`, new): `foreground: 24`, `cacti: 36`, all others `0`.
Drift is leftward (negative x) and driven by the same `--progress`; vertical+x
combined in one `translate3d`. Exact SVG path data and palette are FROZEN
(docs/LANDING-MISSION.md) — only transforms/travel change.

### D4 — Scroll progress semantics
`range = document.documentElement.scrollHeight - window.innerHeight` (guard
`Math.max(1, …)`; `computeProgress` still clamps 0..1, non-finite range → 0).
Same CSS vars (`--scroll-y`, `--progress` on `:root`), same passive-listener +
single-rAF coalescing, same zero-React-state contract, same reduced-motion
behavior (no listeners, cleared properties).

### D5 — DesertBackdrop API
`children` becomes optional; the `.twaz-desert__content` wrapper is removed
(scene-only render). `Hero` stops nesting copy inside the backdrop and stops
rendering it; the hero scrim stays (still stacks above scene z:0, which keeps
`tests/e2e/landing.spec.ts` scrim assertions valid).

### D6 — Section translucency without touching SiteRenderer.tsx
`SiteRenderer.tsx` is UNOWNED by this mission and must not be edited by any swarm
member. Its opaque root (`backgroundColor: BRAND.cream`) and neutral section
surfaces (`#F8F3EE`, `#EFE4DD`) are neutralized from files tw-sections owns: a
`<style>` block (same pattern as `HERO_STYLES`) in `SiteBackdropMount.tsx`
scopes overrides under `.twaz-parallax-host` (class added by tw-sections in
`app/page.tsx`). Accent/navy color bands stay opaque (intentional design
blocks, Delta-reference look). If a direct `SiteRenderer.tsx` edit is proven
necessary, workers STOP and report — lead escalates to controller.

### D7 — Test responsibilities (failing-first, then green)
- tw-visqa: new `tests/e2e/parallax-visual.spec.ts` (backdrop computed
  `position: fixed`, screenshots at scroll 0 / 40% / 80% of the document with
  real pixel deltas, per-layer transform deltas with thresholds,
  `reducedMotion: "reduce"` → zero movement, 360px no overflow + cacti visible)
  + update `components/site/parallax.test.ts` to D4 semantics (mock doc
  scrollHeight 2400, innerHeight 800 → range 1600: 600px scroll → 0.375;
  overscroll clamps to 1). `tests/e2e/landing.spec.ts` is UNOWNED: run it, do
  not edit it; report failures to lead.
- Commands: unit `npx vitest run components/site`; e2e `npx playwright test
  tests/e2e/parallax-visual.spec.ts` (dev server per playwright.config).
- Screenshots stored under `tests/e2e/__screenshots__/`-style Playwright output;
  no new deps.

### D8 — Sequencing
All three workers start in parallel (contract above is frozen, so no blocking).
Visqa's green run requires terrain2 + sections landed; visqa re-runs e2e after
their reports. Lead reviews diffs, resolves conflicts, owns this file only.

## Outcome / evidence
(filled at close — see final worker reports)
