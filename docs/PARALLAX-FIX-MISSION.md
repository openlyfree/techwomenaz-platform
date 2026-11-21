# Parallax perception fix mission

## Diagnosis (controller, live browser evidence, 2026-11-21 12:54 MST)
The parallax **is technically firing** on the deployed Worker: at scrollY=500, `--progress=0.625`, the far ridge transform changed by -25px and the cacti by -87.5px; zero console errors. But the user reports "the moving svg doesn't work" because the landscape sits **inside the hero**, which scrolls off screen with the page. Net visual effect ≈ ordinary scrolling; movement is imperceptible.

## Goal
Make the landscape behave like the Delta Cafés reference: a **fixed, full-viewport background** that remains visible behind ALL page content while the user scrolls, with the desert terrain layers visibly moving (large travel, different speeds, optional horizontal drift). The user should clearly perceive "the terrain is moving as I scroll".

## Fresh architecture
- A single `SiteBackdrop` mounted once in `app/layout.tsx` (controller owns layout, so coordinate: worker proposes exact one-line addition; controller applies).
- `position: fixed; inset: 0; z-index: 0; pointer-events: none;` landscape behind content.
- Page content wrapper `position: relative; z-index: 1;` with translucent surfaces so the terrain stays faintly visible behind sections.
- Scroll progress across the **whole document** (`scrollY / (scrollHeight - innerHeight)`), not just one hero — so terrain keeps moving on every screen.
- Large, clearly different layer travels: sky 20, sun 45, far 140, mid 240, near 340, foreground 440, cacti 520 px over full page scroll, plus a subtle horizontal drift for foreground/cacti.
- `prefers-reduced-motion: reduce` → completely static, no listeners.
- Mobile 360px: no overflow, text legible, cacti visible.

## Ownership (exclusive files)
| Agent | Model | Owns |
|---|---|---|
| tw-parallax-lead | GLM-5.3-Flash | `docs/PARALLAX-DECISIONS.md`; integration review; proposes layout change to controller |
| tw-terrain2 | HY4-Flash | `components/site/DesertBackdrop.tsx`, `components/site/useScrollProgress.ts`, `components/site/desert-backdrop.css` |
| tw-sections | HY4-Flash | `components/site/Hero.tsx`, `components/site/LandingSections.tsx`, `app/page.tsx`, new `components/site/SiteBackdropMount.tsx` if needed — remove the per-hero backdrop and rely on the fixed global one; make section surfaces translucent but readable |
| tw-visqa | GLM-5.3-Flash | `tests/e2e/parallax-visual.spec.ts` (new) + `components/site/parallax.test.ts` — failing-first then GREEN; capture screenshots at scroll 0 / 40% / 80% and assert visibly different terrain positions |

## Rules
- Keep the exact desert SVG path data and palette from docs/LANDING-MISSION.md.
- No Git/deploy/cloud changes — controller handles. No native subagents. Herdr-only delegation in wP, `--no-focus` intent, unique names, no auto-respawn, reap after report.
- Workers HY4-Flash, leads/review GLM-5.3-Flash. Load TDD / e2e-testing / workers-best-practices skills.
- Evidence: actual commands + screenshots; report to tw-parallax-lead; finish turn completely.
