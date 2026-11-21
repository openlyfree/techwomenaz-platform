# TechWomenAZ execution contract

User authorized implementation, public GitHub checkpoints and Herdr coordination. Deadline 2026-11-21 12:30 MST; feature freeze at 12:10. Keep nonprofit production systems untouched; only synthetic member data. Current controller is the integration/commit owner.

## Scope

Full mobile-first site and portal: branded public site, mentor/mentee/both applications, weekly availability/timezones/meeting formats, Jev-ranked discovery, Interested/Pass and mutual interest then coordinator approval by default. The attached nonprofit message was truncated and has NOT been verified; do not claim Melissa confirmed exact fields or removed approval. Make coordinator approval configurable for later verified feedback. Proposed major (when studying), career and interest fields are useful draft requirements, not quoted requirements from Melissa: networking, learning AI, finding a mentor, volunteering and other. Add free-text answers with Jev-suggested interest categories, editable by member/staff; suggestions do not auto-subscribe to email or approve anything. CSV membership import, staff content editing with safe AI drafts/publish/rollback, newsletter draft composer with HubSpot copy/export handoff, real record-based statistics.

## Ownership

- Controller: config/package/lockfiles, shared types/API client, globals/layout, deployment, Git checkpoints.
- tw-lead (Kimi): backend router/services/database/schema/auth and migration scripts. May delegate backend slices with explicit boundaries.
- tw-site (HY4): app/(public) public pages, components/site/*.
- tw-members (HY4): join/login UI, membership profile/admin members/import UI.
- tw-mentor (HY4): portal discovery/mentoring/relationship UI.
- tw-admin (HY4): admin overview/content/mailing/reports/events UI and components/admin/*.
- tw-review (Kimi): read-only code/security review, tests owned after permission from controller.

Use a single shared checkout with EXCLUSIVE files. Do not stage, commit, push, edit another owner's files or modify dependencies; request shared changes from the controller. Controller stages explicit paths only. Worktree isolation may be added when boundaries diverge.

Load the applicable TDD, verification, security, documentation and framework skills. Write and execute focused failing tests before feature implementation and rerun after. Cite actual evidence; do not declare mocks/in-memory stores equivalent to Postgres. Missing integrations must remain honestly unconfigured, not fake AI/email successes.

## API/client contract

Shared domain DTOs live in lib/contracts.ts. UI uses lib/api.ts exports query<T>(procedure,input?) and mutate<T>(procedure,input?), useQuery<T>(procedure,input?) returns {data,loading,error,refresh}, and useSession() returns {user,loading,error,refresh}. These use tRPC over /api/trpc; final backend exports its AppRouter for inferred client types as well. Errors must show actionable text. Root paths remain top-level app/ per scaffold. Shared UI components are components/ui.tsx exports Button, Card, Badge, Field, EmptyState, Loading, ErrorNotice, PageHeading and StatCard. Shared styles are in app/globals.css, do not edit unless owner agrees; use className utility styles.

Procedures and DTOs are specified in docs/API-CONTRACT.md. Do not rename procedures or make incompatible input changes without controller acknowledgement. Components should use useEffect for query loading unless their page wrapper does SSR; every page has loading/error/empty states. Server procedures validate roles and object ownership; UI checks are not security.

## Herdr

All execution delegation uses Herdr CLI, never native subagent. Validate HERDR_ENV=1. Worker model openrouter/tencent/hy4-flash; leads/review openrouter/z-ai/glm-5.3-flash. Use --no-focus and returned IDs. Stay in this mission workspace. Leads should proactively decompose remaining work into concrete independently owned tasks and delegate early rather than doing every subtask serially. Children may delegate further scoped work with lineage and the same rules; do not force trivial delegation or create duplicate work. No automatic respawn; report lineage and reap unused owned descendants after capture. Never touch unrelated panes or the controller. Use current CLI help. Resource checks before fan-out; report quota issues, do not globally switch models.

Reports: concise final answer with owned files, actual commands/results, known gaps and children spawned/reaped. Controller may request a report file if terminal output is inaccessible.
