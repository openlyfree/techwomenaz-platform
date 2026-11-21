# Landing page mission — Delta-style immersive scroll + TechWomenAZ desert terrain

## Goal
Recreate the *experience* of https://deltacafes.com/en as our public landing page: an immersive, full-bleed scrolling landscape where layered terrain visibly moves as the user scrolls (parallax). Use TechWomenAZ's **own desert SVG** from the original site, adapted to fill the viewport width. Keep TechWomenAZ branding/copy. Do NOT copy Delta Cafés' text, logo, photos or brand assets — only the interaction pattern (immersive full-viewport hero + scroll-linked landscape layers + bold editorial type).

## Exact source SVG (from https://techwomenaz.org hero-art)
```svg
<svg viewBox="0 0 360 470">
  <defs>
    <clipPath id="archclip"><path d="M10 465 V190 A170 170 0 0 1 350 190 V465 Z"/></clipPath>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FCE9D8"/><stop offset=".55" stop-color="#F9CFA6"/><stop offset="1" stop-color="#F5AE72"/>
    </linearGradient>
  </defs>
  <path d="M2 470 V190 A178 178 0 0 1 358 190 V470" fill="none" stroke="#F07828" stroke-width="1.4" opacity=".7"/>
  <g clip-path="url(#archclip)">
    <rect width="360" height="470" fill="url(#sky)"/>
    <circle cx="180" cy="250" r="78" fill="#FBEBDD" opacity=".9"/>
    <path d="M0 300 C60 270 100 285 150 262 C200 240 250 275 300 258 C330 248 350 255 360 252 V470 H0Z" fill="#F6A766"/>
    <path d="M0 338 C70 312 120 330 180 306 C240 284 300 320 360 300 V470 H0Z" fill="#F28A3E"/>
    <path d="M0 382 C80 360 150 378 220 356 C280 338 330 360 360 352 V470 H0Z" fill="#F07828"/>
    <path d="M0 420 C90 404 180 422 260 406 C310 396 340 404 360 400 V470 H0Z" fill="#D9611A"/>
    <g fill="#22395A">
      <rect x="232" y="232" width="20" height="210" rx="10"/>
      <path d="M232 340 h-22 a10 10 0 0 1 -10 -10 v-46 a10 10 0 0 1 20 0 v36 h12Z"/>
      <path d="M252 312 h22 a10 10 0 0 0 10 -10 v-52 a10 10 0 0 0 -20 0 v42 h-12Z"/>
      <rect x="105" y="296" width="15" height="150" rx="7.5"/>
      <path d="M105 372 h-15 a7.5 7.5 0 0 1 -7.5 -7.5 v-32 a7.5 7.5 0 0 1 15 0 v25 h7.5Z"/>
      <path d="M120 352 h15 a7.5 7.5 0 0 0 7.5 -7.5 v-28 a7.5 7.5 0 0 0 -15 0 v21 h-7.5Z"/>
    </g>
  </g>
</svg>
```
Adaptation: make it fill width (viewBox stretched to ~1440x470, preserveAspectRatio="none" or xMidYMax slice). Extract each colored mountain path + the cacti into separate stacked layers for parallax. Keep the sky gradient and sun.

## Required behavior
- Full-viewport hero with the terrain as its background; content (headline/subtitle/CTAs) readable on top with a subtle scrim.
- As the user scrolls, layers move at different speeds: sky/sun slowest, far ridge (F6A766) slow, mid (F28A3E) medium, near (F07828) faster, foreground (D9611A) + cacti fastest. Terrain should feel like it travels past as you scroll.
- Use a passive scroll listener + requestAnimationFrame to update a CSS custom property (`--scroll-y`) or transforms; no React re-render per scroll frame. `transform: translate3d()` only.
- `prefers-reduced-motion: reduce` → parallax disabled, static landscape, no scroll-linked transforms.
- Mobile: same effect, no horizontal overflow, cacti/foreground still visible, text legible at 360px.

## File ownership (single shared checkout, exclusive files)
- Controller: Git/deploy/config/globals.css (only adds a scoped import if needed), docs/API-CONTRACT.md.
- tw-land-lead (GLM-5.3-Flash): integration, final review, owns `docs/LANDING-DECISIONS.md` only. May reassign scoped fixes via Herdr in wM.
- tw-terrain (HY4 Flash): owns `components/site/DesertBackdrop.tsx`, `components/site/useScrollProgress.ts`, `components/site/desert-backdrop.css`. Implements the layered SVG + parallax hook + CSS. No edits to globals.css.
- tw-hero (HY4 Flash): owns `app/page.tsx`, `components/site/Hero.tsx`, `components/site/LandingSections.tsx`. Uses `DesertBackdrop` from tw-terrain via the agreed props. Keeps `usePublicSite`/`SiteRenderer` API intact; dynamic content still comes from `public.site`.
- tw-qa (GLM-5.3-Flash): owns `tests/e2e/landing.spec.ts`, `components/site/parallax.test.ts`. Writes failing tests first (RED), then after owner fixes verifies GREEN. Tests: layers transform differently on scroll, reduced-motion disables movement, no overflow at 360/1280, headline/CTA visible.

## Agreed component contract (do not change without lead approval)
`DesertBackdrop({ children, className? }: { children: ReactNode; className?: string })` — renders absolutely-positioned layered SVG behind `children`; parallax driven internally by `useScrollProgress()`.
`useScrollProgress(): { scrollY: number; progress: number }` — passive + rAF, updated via CSS custom property, not state per frame.

## Rules
- Load TDD, security, e2e-testing, workers-best-practices skills as relevant.
- RED→GREEN evidence with actual commands.
- No Git, no deploy, no cloud account changes, no native subagents. All delegation via Herdr CLI in wM, `--no-focus`, parse pane IDs, unique names. Leads/review use `openrouter/z-ai/glm-5.3-flash`, workers `openrouter/tencent/hy4-flash`. No auto-respawn; reap finished owned children after capturing their reports.
- No fabricated impact claims, testimonials or events. Use the seeded public copy (`public.site`).
- Deadline: finish with verified build + E2E before controller deployment.
