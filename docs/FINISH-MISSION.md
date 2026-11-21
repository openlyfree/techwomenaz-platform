# Finish swarm mission — final verification, split into independent slices

Goal: get the TechWomenAZ platform to a fully verified, deployable state after the latest landing-page and email/password changes. Deadline: ASAP; do not start paid services or touch the nonprofit's live site.

## Ownership (single shared checkout — exclusive files, no overlapping edits)

| Agent | Model | Owns (exclusive) | Deliverable |
|---|---|---|---|
| tw-final-lead | GLM-5.3-Flash | `docs/FINISH-REPORT.md`; integration review only | Coordinate, resolve conflicts, capture evidence, final report. May delegate only through Herdr in wN. |
| tw-e2e | HY4-Flash | `tests/e2e/**` (all files) | `npm run test:e2e` fully green (all specs). Fix selector ambiguity (two "Find your people" links: header + hero — scope with `.last()` or hero-scoped locator), admin 360px overflow if still present, and any other E2E failure. Do not edit app/** or components/**; if a production fix is needed, report exact selector/route/error to lead. |
| tw-auth | HY4-Flash | `server/postgres.integration.test.ts`, `tests/password-auth.test.ts`, `scripts/bootstrap.mjs`, `server/auth-utils.ts` | Real-Postgres integration tests for `auth.signIn` (valid/invalid/wrong-password/paused), join-with-password, hashed storage (no plaintext), and bootstrap script. Run with `node --env-file=.env.local node_modules/vitest/vitest.mjs run server/postgres.integration.test.ts`. Fix only owned files. |
| tw-review | GLM-5.3-Flash | `docs/review/final/**` (new files only) | Read-only security & correctness review of the latest diff (landing parallax, password auth, audit log, directory, calendar links, dark mode, config sync). File findings by severity with exact file/line + reproduction. Write failing reproducer tests only under `tests/quality/**` if zero-collision; otherwise document. No app edits. |

## Global rules
- Load TDD / e2e-testing / security-review skills as relevant. Evidence = actual commands + outputs; no invented PASS.
- Herdr CLI only for any delegation; `--no-focus`; parse IDs; unique names; no native subagents; no auto-respawn; reap finished children after capturing reports. Leads/review GLM-5.3-Flash, workers HY4-Flash.
- No Git commit, no deploy, no cloud/account changes — controller handles those. No edits outside owned files. If an out-of-scope fix is needed, send one concise message to tw-final-lead with exact details.
- Report format: files changed, commands run, result (RED→GREEN if applicable), known gaps. Finish your turn completely.
