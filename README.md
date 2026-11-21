# TechWomenAZ — A community that grows together

An independent hackathon build for TechWomenAZ: a mobile-first public website, membership portal, human mentorship discovery and an intuitive staff workspace.

## Implementation status (final draft, 2026-11-21)

Target demo: November 21, 2026, 12:30 PM America/Phoenix. This is an unofficial build, not the nonprofit's live website or a production-ready service. All member records in the demo database are fictional.

### Working end to end (verified)

- Public website with the TechWomenAZ desert palette and dynamic Postgres-backed sections (`public.site`), preserving the original Givebutter donation link and external event registration links.
- Member signup, individual magic-link endpoints (email transport unconfigured and honestly reported), private profile with weekly availability/timezone/meeting-format preferences, major/career/interest fields and optional Jev-assisted interest categorization.
- Google Forms CSV import with preview, duplicate/invalid classification, idempotent commit and staff review.
- Mentorship discovery with Jev-ranked (or manual fallback) eligible profiles, Interested/Pass, mutual interest, coordinator approval by default (`REQUIRE_MATCH_APPROVAL` configurable), goals, meetings, calendar download and author-only private check-ins.
- Staff console with real Postgres statistics, AI-assisted landing-page drafts, preview, publish and rollback, newsletter drafting with HubSpot copy/export handoff, event management and truthful integration status.
- End-to-end Playwright journeys at desktop and 360px mobile widths; unit, integration and real-Postgres suites green at feature freeze (see docs/backend-report.md).
- Quality polish pass: branded 404/error/loading states, SVG favicon, robots.txt and sitemap, accessible form hints/error summaries/live confirmations, responsive admin card views, branded real copy for the public site (synthetic data still honestly labeled), and a plain-language feature guide in docs/FEATURES.md.

### Known gaps

- Real member email delivery requires an onboarded Cloudflare sending domain; login verification is honest-but-unavailable until configured, and no bypass exists.
- TypeSafe Jev and Workers AI depend on `TYPESAFE_API_KEY` and the `AI` binding; without them the UI falls back to manual/deterministic flows with clear notices.
- HubSpot newsletter sending stays in the existing HubSpot account; this platform prepares drafts and consented exports only.
- The demo database is a temporary 72-hour claimable Neon project; claim it before storing anything real.

### Stack

TypeScript, React, vinext App Router, Tailwind, tRPC/Zod, PostgreSQL/Drizzle, Cloudflare Workers/Hyperdrive/Workers AI. TypeSafe Jev requests may route through AI Gateway; a separate TypeSafe credential is required.

Cloudflare does not host this PostgreSQL database. Neon provides PostgreSQL. The initial development database is a free claimable project that expires after 72 hours unless claimed; do not store real member data in it. Claim links and credentials are private local files, never committed.

### Development and verification

```sh
npm ci
cp .env.example .env.local
# Fill in development credentials locally, never in Git.
npm run db:migrate
node --env-file=.env.local scripts/seed.mjs
npm run dev
```

Quality gates used for the final draft (all must pass before any deploy):

```sh
npm run typecheck        # strict TypeScript
npm test                 # unit suites; Postgres integration runs when DATABASE_URL is set
npm run test:e2e         # Playwright: public routes, auth gates, admin/portal journeys at 1280px and 360px
npm run build            # vinext RSC/client/SSR Workers bundle
npm run deploy           # build + deploy to the demo Worker
```

Worker secrets and integration prerequisites will be documented as implementation proceeds. Missing AI/email/HubSpot configuration must be visibly reported, never replaced with fake successes.

### Data safety

Do not commit raw membership responses, database exports, private screenshots, auth state or credentials. Real imports, member outreach, spending upgrades and replacement of the existing site require explicit authorization.

## License

Original code: MIT. TechWomenAZ names/branding, supplied photographs, and third-party assets are not relicensed by this repository. Their inclusion in an official deployment requires the organization's approval.
