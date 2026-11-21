# Membership UI — TDD evidence

No `*.plan.md` was supplied; journeys were derived from the task, `AGENTS.md` and
`docs/API-CONTRACT.md`. No Git, package, config, lockfile or shared-file changes were made by
this owner; the controller owns checkpoints.

## User journeys

1. As a visitor, I apply to join with a short guided form; newsletter stays off unless I opt in.
2. As a visitor, I request a sign-in link and get an honest error when email is not configured.
3. As a member, I set role, expertise, goals, timezone, weekly slots, format, location, capacity,
   discovery/AI consent and editable interest suggestions.
4. As a member, I review and change my preferences without inventing a newsletter subscription.
5. As staff, I search members by name/career/major/interests and approve or pause them.
6. As staff, I upload a CSV, review new/duplicate/invalid rows, then commit once; no raw CSV is saved.

## RED → GREEN evidence

| Behavior | RED command / result | GREEN command / result |
|---|---|---|
| Pure join/profile helpers | `npx vitest run --config components/membership/vitest.config.ts components/membership/form-helpers.test.ts` → FAIL, `Cannot find module './form-helpers'` (11:37:52 MST) | same command → 1 file passed, 13/13 tests (11:38:03 MST) |
| Staff helpers (child tw-members-admin) | child reported `admin-helpers.test.ts` RED with 23/23 failing against an intentional stub | `npx vitest run --config components/membership/vitest.config.ts` → 2 files passed, 36/36 tests (11:40:35 MST) |
| Shared `Loading` prop mismatch | `npx tsc --noEmit` flagged `<Loading label=…>` in owned pages after controller shipped `components/ui.tsx` | changed to `message=…`; `npx tsc --noEmit` reported no diagnostics in owned files (11:41 MST) |

## Guarantees

| # | Guarantee | Test / check | Result |
|---|---|---|---|
| 1 | `HH:mm` parsing rejects `24:00`, `12:60`, non-clock strings | `form-helpers.test.ts:parseClock` | PASS |
| 2 | Slots require day 0–6 and a positive range | `form-helpers.test.ts:isValidSlot` | PASS |
| 3 | Invalid/duplicate slots dropped and sorted by day/start | `form-helpers.test.ts:normalizeSlots` | PASS |
| 4 | Join defaults newsletter to false and requires name, email, a path | `form-helpers.test.ts:validateJoin` | PASS |
| 5 | Profile requires a valid slot, role, timezone and capacity ≥ 1 | `form-helpers.test.ts:validateProfile` | PASS |
| 6 | Interest suggestions are deduped and never added automatically | `form-helpers.test.ts:mergeInterestSuggestions` | PASS |
| 7 | Unknown error objects never surface to the UI | `form-helpers.test.ts:safeError`, `admin-helpers.test.ts:safeErrorText` | PASS |
| 8 | Member search covers name, career, major, interests, interestAnswer | `admin-helpers.test.ts:filterMembers` | PASS (child) |
| 9 | CSV upload rejects files over 2 MB with an actionable message | `admin-helpers.test.ts:validateCsvFile` | PASS (child) |
| 10 | Preview counts derive from row statuses and omit the token | `admin-helpers.test.ts:summarizePreview` | PASS (child) |
| 11 | Email is only exposed to coordinator/admin roles in the UI | `admin-helpers.test.ts:canShowEmail` + staff pages | PASS (child) |
| 12 | Production build compiles all owned routes | `npm run build` → `Build complete.`, exit 0 | PASS |

## Coverage and gaps

`npx vitest run --config components/membership/vitest.config.ts --coverage` → 36/36 passing;
statements 95.19%, branches 84.21%, functions 100%, lines 98.86% (helper modules only).

Not covered by unit tests: React interaction flows (no `@testing-library/react` in dependencies),
real tRPC responses, real email/Jev/Postgres behavior, and browser layout at 360px. Those remain
integration/E2E gaps, not verified successes. A global `npx tsc --noEmit` at 11:41 reported one
error in another owner's `components/mentorship/MatchDetail.tsx` (`Cannot find name 'shell'`);
no owned file had diagnostics. No component was claimed to send email, approve anyone, or add a
newsletter subscription automatically.

## Lineage

Controller `tw-lead`; this agent `tw-members` (pane wJ:p4); one own-scope child
`tw-members-admin` (pane wJ:p9) owned `app/admin/members/page.tsx`,
`app/admin/imports/page.tsx`, `components/membership/admin-helpers.ts` and its test. Child
finished (Herdr `agent_status: done`, completion_seq 292); its pane was later reaped.

## Follow-up fan-out (three independent slices)

Dedicated tab `wJ:t5` in workspace `wJ`, HY4 workers, no auto-respawn, no native subagents:

| Child | Pane | Exclusive files | RED → GREEN (child-reported, exact commands) |
|---|---|---|---|
| `tw-avail` | wJ:pD | `form-helpers.ts(+test)`, `form-fields.tsx`, new `timezone.ts(+test)` | `npx vitest run --config components/membership/vitest.config.ts components/membership/form-helpers.test.ts components/membership/timezone.test.ts`: 7 failed/15 passed → 29/29 passed |
| `tw-import-ux` | wJ:pH | `app/admin/imports/page.tsx`, `admin-helpers.ts(+test)` | same config, `admin-helpers.test.ts`: 16 failed/24 passed → 40/40 passed |
| `tw-member-a11y` | wJ:pK | `app/admin/members/page.tsx`, new `member-a11y.ts(+test)` | same config, `member-a11y.test.ts`: RED reported → 13 new tests green |

All reached Herdr `done` (completion_seq 355 / 353 / 348). A transient 2-suite failure reported by
`tw-member-a11y` came from concurrent edits mid-fan-out; settled state at 11:48:30 MST:
`npx vitest run --config components/membership/vitest.config.ts` → **4 files, 82/82 passed**;
`npx tsc --noEmit` → no owned-file diagnostics. `npm run build` → `Build complete`, exit 0.

Controller-side integration done after the children: `app/portal/profile/page.tsx` and
`app/portal/preferences/page.tsx` now import `timezoneOptions` from
`components/membership/timezone.ts` instead of maintaining duplicate local timezone lists.

**Checkpoint flag for controller:** `git check-ignore -v app/admin/imports/page.tsx` →
`.gitignore:13:imports/`. That owned page needs `git add -f` to be checkpointed.
