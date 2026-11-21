# Professure: A community that grows together

A mentorship platform built for TechWomenAZ.

> Structured to the FireBytes Hackathon README checklist. The 3-minute video shows what we built; this README covers what does not fit in three minutes, and judges use it to check what really works.

## 1. Project, team and nonprofit

**Project name:** Professure, a mentorship platform for TechWomenAZ (*A community that grows together*)

**Team members:** Ethan Jimmy (controller / integration owner). *Add your teammate names here before submitting.*

**Nonprofit partner:** [TechWomenAZ](https://techwomenaz.org), a Phoenix, Arizona community supporting women in tech.

**Built for:** FireBytes Hackathon, Nov 21 2026, an independent, unofficial build by Basis Phoenix's Computer Science Honor Society. This is **not** the nonprofit's live website or a production service. All member records in the demo database are fictional, and the nonprofit's production systems were left untouched.

## 2. The problem

TechWomenAZ runs a volunteer-driven mentorship community, but matching people with the right mentor or mentee, and keeping those relationships going, depends on manual spreadsheets and email. Members have busy, varying schedules and meeting preferences, so good matches are hard to find and even harder to maintain. The nonprofit needed one simple, mobile-first place for people to join, find compatible connections, and for staff to run the community without heavy administration.

## 3. How it works

Professure has two sides: a public-facing site for the community and signed-in spaces for members and staff.

- **Public website.** A mobile-first site in TechWomenAZ's desert palette with dynamic, Postgres-backed sections; the original Givebutter donation link and external event registration links are preserved.
- **Membership.** People apply as a mentor, a mentee, or both, then complete a private profile with weekly availability, timezone and preferred meeting format, plus major/career/interest fields. Applications are reviewed by staff.
- **Mentorship discovery.** Eligible profiles are ranked by Jev (with a manual fallback). Members choose **Interested** or **Pass**; when two people are mutually interested, the match activates immediately, with no coordinator approval gate. Each match has a shared goal, next meeting, calendar download, and author-only private check-ins.
- **Staff workspace.** Real record-based statistics, section-by-section website editing with AI-assisted drafts plus preview/publish/rollback, newsletter drafting with HubSpot copy/export handoff, event management, and an honest integration-status page.

![The TechWomenAZ public site on mobile (360px)](artifacts/public-site-smoke.png)

*A plain-language tour for nonprofit staff is in [docs/FEATURES.md](docs/FEATURES.md).*

## 4. Tech stack

TypeScript · React · vinext App Router · Tailwind · tRPC + Zod · PostgreSQL/Drizzle · Cloudflare Workers + Hyperdrive · optional Workers AI. Jev requests route through OpenRouter's OpenAI-compatible chat endpoint using `typesafe/jev-router`; a separate Cloudflare Workers AI binding is optional.

Cloudflare does **not** host this PostgreSQL database; Neon provides it. The initial development database is a free, claimable project that expires after 72 hours unless claimed; do not store real member data in it. Claim links and credentials are private local files and are never committed.

## 5. How to run it

```sh
npm ci
cp .env.example .env.local
# Fill in development credentials locally, never in Git.
npm run db:migrate
node --env-file=.env.local scripts/seed.mjs
npm run dev
```

Quality gates used for the final draft (all must pass before deploy):

```sh
npm run typecheck        # strict TypeScript
npm test                 # unit suites; Postgres integration runs when DATABASE_URL is set
npm run test:e2e         # Playwright: public, auth and admin/portal journeys at 1280px and 360px
npm run build            # vinext RSC/client/SSR Workers bundle
npm run deploy           # build + deploy to the demo Worker
```

## 6. What's finished, what's mocked up, what's next

**Finished and verified** (see [docs/backend-report.md](docs/backend-report.md) and [docs/FINISH-REPORT.md](docs/FINISH-REPORT.md)):

- Public site, membership signup and profiles, CSV import with preview/deduplication, Jev-ranked discovery with instant mutual matches, staff console with real statistics and safe AI drafts, and branded 404/error/loading states.
- End-to-end Playwright journeys at desktop and 360px; unit, integration and real-Postgres suites green at feature freeze (`npm test` → 232 passed; `npm run test:e2e` → 12 passed; real-Postgres auth → 16 passed; `npm run typecheck` clean).

**Mocked up / honestly unavailable:**

- Real member email delivery needs an onboarded Cloudflare sending domain; verification links are unavailable until configured; there is no bypass and no fake "sent" success.
- Jev runs through OpenRouter when `TYPESAFE_API_KEY` and `AI_GATEWAY_URL` are set; Workers AI needs the `AI` binding. Without them the UI falls back to manual/deterministic flows with clear notices.
- HubSpot remains the sender; Professure only prepares drafts and consented exports.
- The demo database is a temporary 72-hour claimable Neon project. All member data shown is synthetic and labeled as such.

**Next:** onboard a sending domain and claim or replace the demo database before storing anything real; configure Jev / Workers AI; and complete the remaining non-blocking review items (e.g. sign-in rate limiting). Replacing the nonprofit's existing site requires explicit authorization.

## 7. Links

- **3-minute video:** *TODO: add the unlisted YouTube or Google Drive link (named `TeamName_ProjectName`) before the 1:30 PM deadline.*
- **Live Cloudflare app:** *TODO: add the deployed `…workers.dev` link. Deploy with `npx wrangler deploy` and verify it opens in a private window.*

> Judging note: every project must be live on Cloudflare to be scored; judges open the `workers.dev` link first.

## Data safety

Do not commit raw membership responses, database exports, private screenshots, auth state or credentials. Real imports, member outreach, spending upgrades and replacement of the existing site require explicit authorization.

## License

Original code: MIT. TechWomenAZ names/branding, supplied photographs and third-party assets are not relicensed by this repository; using them in an official deployment requires the organization's approval.
