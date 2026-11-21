# TechWomenAZ — A community that grows together

An independent hackathon prototype for TechWomenAZ: a mobile-first public website, membership portal, human mentorship discovery and an intuitive staff workspace.

## Implementation in progress

Target demo: November 21, 2026, 12:30 PM America/Phoenix. This is an unofficial prototype, not the nonprofit's live website or a production-ready service. All demo members are fictional.

### Intended workflows

- Mentor and mentee applications with availability, timezone and meeting preferences.
- Jev-assisted professional discovery, Interested/Pass, mutual interest and coordinator approval.
- Staff membership management and a private, duplicate-safe Google Forms CSV import.
- AI-assisted landing-page drafts, preview, publishing and rollback.
- Newsletter drafting and a handoff to the existing HubSpot account, not unauthorized bulk sending.
- Statistics from recorded platform activity, not fabricated impact claims.

### Stack

TypeScript, React, vinext App Router, Tailwind, tRPC/Zod, PostgreSQL/Drizzle, Cloudflare Workers/Hyperdrive/Workers AI. TypeSafe Jev requests may route through AI Gateway; a separate TypeSafe credential is required.

Cloudflare does not host this PostgreSQL database. Neon provides PostgreSQL. The initial development database is a free claimable project that expires after 72 hours unless claimed; do not store real member data in it. Claim links and credentials are private local files, never committed.

### Development

```sh
npm ci
cp .env.example .env.local
# Fill in development credentials locally, never in Git.
npm run db:migrate
npm run dev
```

Worker secrets and integration prerequisites will be documented as implementation proceeds. Missing AI/email/HubSpot configuration must be visibly reported, never replaced with fake successes.

### Data safety

Do not commit raw membership responses, database exports, private screenshots, auth state or credentials. Real imports, member outreach, spending upgrades and replacement of the existing site require explicit authorization.

## License

Original code: MIT. TechWomenAZ names/branding, supplied photographs, and third-party assets are not relicensed by this repository. Their inclusion in an official deployment requires the organization's approval.
