# Finish-swarm report — TechWomenAZ platform final verification

**Date:** 2026-11-21 · **Lead:** tw-final-lead (workspace `wN`, pane `wN:p1`) · **Scope rule:** per `docs/FINISH-MISSION.md`. No Git commit, no deploy, no cloud/account changes (controller handles those).

## Executive summary

All three finish-slice deliverables are **verified green by actual lead-run commands**:

| Deliverable | Result | Evidence |
|---|---|---|
| `npm run test:e2e` fully green | ✅ **12 passed (49.4s)** | Lead-run after clearing a stale server on port 3100 (see §E2E) |
| Real-Postgres password auth tests | ✅ **16 passed** (exact mission command) | Lead-run `node --env-file=.env.local node_modules/vitest/vitest.mjs run server/postgres.integration.test.ts` → 16/16, 19.7s |
| Final security/correctness review | ✅ `docs/review/final/REVIEW.md` (135 lines) + RED reproducers written, then made GREEN by an out-of-band fix pass (see §Out-of-band) | Lead-run reproducers: 6/6 GREEN post-fix |
| Whole-repo gates (post-fix) | ✅ `npm run typecheck` exit 0 · `npm test` → **24 files passed, 1 skipped; 232 tests passed, 16 skipped** | Lead-run 12:50 MST |

**Critical findings: none.** Two High findings (H1 config-approval default, H2 email-ownership/`emailVerifiedAt`) were **fixed** during the window; remaining Medium/Low items are documented for the controller and are not blocking.

## Coordination record

- Workers dispatched 12:33 MST via `herdr agent prompt` to idle agents: tw-e2e `wN:p2`, tw-auth `wN:p3`, tw-review `wN:p4`. Herdr-CLI-only delegation; no native subagents; controller pane untouched; no pane focused.
- `--no-focus`: this CLI build rejects it as an option to `agent prompt` (parsed as an agent target → `agent_not_found`). Intent preserved: no focus action was ever taken; flag documented here for the controller.
- A background turn-completion monitor (`/tmp/opencode/finish-wait.sh`) required sustained turn idleness (6×20s checks) per pane; Herdr's `agent wait --until idle` was unusable here because worker state fields lagged (it matched the pre-turn idle instantly).
- Baseline `git status --short` snapshotted before dispatch (`/tmp/opencode/baseline-git-status.txt`) for edit attribution.

## Worker results

### tw-e2e (`wN:p2`) — E2E suite ⚠ report lost, deliverable verified by lead

**Anomaly:** the tw-e2e agent exited before its final message could be captured (its pane and agent record vanished; `herdr agent get/read` → `agent_not_found`). Its scrollback was unrecoverable. **No respawn was attempted** (no-auto-respawn rule). The deliverable was instead verified directly by the lead:

- Run 1 (12:47): `npm run test:e2e` → **11 passed, 1 failed** — `platform.spec.ts:60` failed with `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/admin/content`. Root cause found: a **stale dev server (pid 263528) was squatting on 127.0.0.1:3100**; Playwright reused it (`reuseExistingServer`) and it destabilized mid-suite. Environmental, not a test defect.
- Fix: killed pid 263528, confirmed `port 3100 free`.
- Run 2 (12:48): `npm run test:e2e` → **12 passed (49.4s)**, including the previously-known trouble spots: landing CTA locator (hero + scroll-parallax + reduced-motion specs), public routes at desktop + mobile-360, auth gates, and `platform.spec.ts:60` "admin and portal routes load with real Postgres data and no mobile overflow".
- `tests/e2e/**` had **no edits in this window** (git-status delta shows no tests/e2e change): the pre-existing `.last()` CTA fix and the 360px overflow CSS fixes in `app/globals.css` (controller-owned, from the earlier pass) were already sufficient. The admin 360px overflow check passes inside `platform.spec.ts:60` and the landing overflow check passes in `landing.spec.ts:75`.

**Gap:** tw-e2e's own RED→GREEN narrative and pass counts are not captured; the lead-run results above stand in as evidence.

### tw-auth (`wN:p3`) — Real-Postgres password auth ✅

Worker report captured (full text in pane wN:p3 scrollback, 4m47s turn):

- **Files changed (owned only):** `server/postgres.integration.test.ts` (5 new real-Postgres tests + synthetic fixtures + cleanup), `tests/password-auth.test.ts` (paused/missing-account refusal unit test). `scripts/bootstrap.mjs` and `server/auth-utils.ts`: no edits needed — verified by real execution.
- **Coverage:** (1) `auth.signIn` valid credentials → success + `HttpOnly; SameSite=Lax` cookie that replays into `auth.session()`; (2) wrong password / unknown email / no-stored-hash → byte-identical `UNAUTHORIZED` message (no user enumeration); (3) paused member → same generic refusal; (4) `membership.join` with password → `password_hash` starts `pbkdf2$`, no plaintext, `verifyPassword` true, account can sign in; (5) `scripts/bootstrap.mjs` spawned as the real CLI against `DATABASE_URL` → approved coordinator row with `pbkdf2$` hash, no plaintext, re-run rotates the salted hash with no duplicate row.
- **TDD evidence:** baseline 14 passed → RED gate 1 failed/19 passed (valid-credentials failed at `server/router.ts:107` because the fixture lacked a stored hash) → GREEN exact mission command 16 passed (re-confirmed twice) → combined owned suite 20 passed.
- **Lead verification (12:48):** exact mission command → **Test Files 1 passed (1); Tests 16 passed (16); Duration 19.70s**.

### tw-review (`wN:p4`) — Security & correctness review ✅

Worker report captured (3m30s turn). Files written (owned only):

- `docs/review/final/REVIEW.md` — full review, findings by severity with exact file/line + reproduction.
- `tests/quality/review-final-repro.test.ts` — reproducer tests, new filename, zero collision (verified: `tests/e2e/**` and tw-auth's files untouched by review).

**Findings summary (full detail with file/line in `docs/review/final/REVIEW.md`):**

- **Critical:** none.
- **High:** H1 `cloudflare.config.ts:24` — `REQUIRE_MATCH_APPROVAL` `"true"→"false"` self-activates matches without coordinator approval, contradicting the AGENTS.md/API-CONTRACT.md default (unverified nonprofit instruction). H2 `server/router.ts` password joins set `emailVerifiedAt = now()` with zero verification + email pre-claim lockout (`CONFLICT` for the real owner).
- **Medium:** M1 sign-in timing side-channel (PBKDF2 skipped for unknown emails); M2 no rate limiting on `auth.signIn` (unlike `requestLink`'s 5/hour); M3 dark-mode `<html>` attribute leaks onto the member portal (`components/shell.tsx:44-56`, `app/globals.css:141-163`); M4 100k PBKDF2 iterations below OWASP ~600k guidance / possible Workers Free 10ms CPU limit; M5 `verifyPassword` throws (→500) on corrupted hash; M6 `scripts/seed.mjs:242-248` unverified real event ("Money 101", live luma.com URL) without `[fictional]` marker; M7 audit inserts non-atomic + coverage gaps vs `app/admin/audit/page.tsx:38` copy.
- **Low (10):** directory dead `capacity` field, staff self-visibility, no pagination, Google Calendar hardcoded 1-hour duration + PII in URL params, old-Safari `addListener` gap, missing `<h1>` when hero disabled, dark-mode FOUC, bootstrap argv password exposure (ps/history), `update-site-content.mjs` publishes without audit event, observability verbosity (`cloudflare.config.ts:31-32`).
- **Mission concerns verified PASS:** (a) passwords stored only as PBKDF2 hash (16-byte CSPRNG salt, constant-time compare, no plaintext paths); (c) audit summaries contain no emails/password material, `audit.list` admin-only; (d) directory selects never expose emails/bio/availability; (e) parallax honors `prefers-reduced-motion` in both JS (`useScrollProgress.ts:57-60`) and CSS (`desert-backdrop.css:48-53`); (f) join-with-password does not bypass staff approval for discovery (pending gates discovery/directory/privileged surfaces).
- **RED evidence (worker-run):** `vitest run tests/quality/review-final-repro.test.ts` → 1 file failed, 3/3 failed as predicted (M5 ×2, H1 ×1).
- **Known gaps (review):** M1/M2 reasoned from code, not measured end-to-end; Workers plan (Free vs Paid) unverified → M4 open for controller; `app/admin/mentorship/page.tsx` read-level only; `code-reviewer` skill not installed (noted; `security-review` was loaded and applied).

## Out-of-band security-fix pass (not dispatched by this lead) — lineage + conflict resolution

While the finish swarm ran, a **separately dispatched fix worker operated in `wN:p5`** (pane title "Authentication security fixes", OpenCode mini, Hy4-Flash; its reasoning self-identified as "tw-secfix"; the dispatch prompt in its scrollback instructs "Report … to tw-final-lead via Herdr" — it was **not sent by this lead**, whose only prompts went to p2/p3/p4). Attribution for the dispatch therefore points to the controller/parent session (w8 controller pane was "working" during this window).

- **Its exclusive ownership (per its dispatch prompt):** `server/auth-utils.ts`, `server/router.ts`, `tests/quality/review-final-repro.test.ts`, `server/auth.test.ts`; explicitly forbidden to touch `cloudflare.config.ts`, `app/**`, `components/**`, `scripts/**`, tw-auth's files, `tests/e2e/**`. No Git/deploy.
- **What it did (from scrollback, TDD RED→GREEN):**
  - M5: `verifyPassword` (`server/auth-utils.ts`) clamps iterations to `[1, 1_000_000]`, wraps base64/derive in try/catch → returns `false` instead of throwing (degrades to ordinary auth failure, never a 500).
  - M1: new `verifyPasswordForSignIn(password, stored|null)` with a precomputed `DUMMY_PASSWORD_HASH` — every failed sign-in class (unknown email, no hash, paused) pays the same PBKDF2 cost; uniform error kept.
  - H2: `membership.join` now inserts `emailVerifiedAt: null` with a comment documenting the accepted pre-claim risk.
  - Added H2/M1 reproducer tests to `tests/quality/review-final-repro.test.ts` (file grew 3 → 6 tests).
- **H1 (config):** the fixer **refused to touch `cloudflare.config.ts`** (controller-owned) and flagged it; `REQUIRE_MATCH_APPROVAL: bindings.text("true")` was flipped by the controller side at 12:47:33 (mtime), consistent with the ownership boundary. Current state matches the AGENTS.md contract default.
- **Boundary check (lead):** git-status delta vs baseline shows exactly the expected new entries (`server/postgres.integration.test.ts` modified by tw-auth; `docs/review/final/` and `tests/quality/review-final-repro.test.ts` new) — production files were already M at baseline, and **no ownership collisions occurred** (tw-secfix's file set is disjoint from tw-auth/tw-e2e/tw-review's owned files except `review-final-repro.test.ts`, which its own dispatch granted it exclusively).
- **Conflict resolution:** the review's RED reproducers were resolved to GREEN by legitimate fixes (not by editing tests to fake green — the fixer explicitly declined to alter the H1 guard dishonestly). Review file header still labels tests "currently RED"; the table below supersedes it.

## Final verification matrix (all lead-run, 12:48–12:51 MST)

| Command | Result |
|---|---|
| `npm run test:e2e` (after clearing stale :3100 server) | 12 passed (49.4s) |
| `node --env-file=.env.local node_modules/vitest/vitest.mjs run server/postgres.integration.test.ts` | 16 passed (19.70s) |
| `node_modules/.bin/vitest run tests/quality/review-final-repro.test.ts` | 6 passed (post-fix; was 3/3 RED pre-fix) |
| `npm run typecheck` | exit 0 |
| `npm test` (`vitest run`, all suites) | 24 files passed, 1 skipped; 232 tests passed, 16 skipped (1.70s) |

## Known gaps / open items for the controller

1. **tw-e2e report lost** — agent exited uncaptured; deliverable verified directly by lead (above). No respawn per mission rule.
2. **Remaining unfixed review items** (documented, non-blocking): M2 (sign-in rate limiting), M3 (dark-mode attribute leak to portal), M4 (PBKDF2 iteration count vs Workers CPU plan — needs a verified plan decision), M6 (seed event `[fictional]` marker — controller owns `scripts/seed.mjs`), M7 (audit atomicity/coverage), plus the 10 Low items in `REVIEW.md`.
3. **Transient flake flagged by tw-auth:** one first-attempt failure of a pre-existing content-version test ("Content changed since version 4", `server/content.ts:35`), attributed to shared-DB contention from parallel agents; clean on 3 subsequent runs and in the final full-suite run.
4. **Out-of-band dispatch attribution:** the tw-secfix prompt did not come from this lead; the controller should confirm it originated from their side and review its diff (`server/auth-utils.ts`, `server/router.ts`, `server/auth.test.ts`, `tests/quality/review-final-repro.test.ts`, `cloudflare.config.ts` H1 flip) before committing, since these edits land in shared checkout alongside the rest of the uncommitted work.
5. `docs/review/final/REVIEW.md` status labels predate the fixes (its reproducers now pass); review content itself (findings/repros) remains accurate as the record of what was found.
6. Not performed by this swarm (per mission): Git commit/push, deploy, cloud/account changes, paid services, nonprofit live-site work.

## Reaping record

- tw-e2e (`wN:p2`): pane/agent already gone (self-terminated) — nothing to reap.
- tw-auth (`wN:p3`), tw-review (`wN:p4`): reports captured; panes closed after capture.
- tw-secfix lineage (`wN:p5`): session finished ("Session Authentication security fixes"); pane closed after scrollback/report capture.
- No descendants were left running in `wN`; unrelated `w8` panes were never touched.
