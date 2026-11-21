# Staff dashboard — TDD and verification evidence (tw-admin)

Source: no `*.plan.md` was supplied. Journeys were derived from the frozen `docs/API-CONTRACT.md`, `lib/contracts.ts` and the tw-admin execution contract.

## User journeys

1. As staff, I want a dashboard of real record-derived counts so I do not report invented impact.
2. As staff, I want to edit site copy, preview it on the real site renderer, and publish or roll back deliberately.
3. As staff, I want to ask AI for a candidate draft and review it before anything is saved.
4. As staff, I want to save newsletter drafts, copy them for a manual HubSpot paste, and export only consented contacts.
5. As staff, I want to add and update public events without touching shared code.
6. As staff, I want a truthful integration status page that never fakes an AI, email or CRM connection.

## RED → GREEN evidence

Commands were run in `/home/ethan/Projects/hackathon/techwomenaz-platform`.

**RED (before implementation), 11:36 MST:**

```
npx vitest run --config components/admin/vitest.config.ts
FAIL  components/admin/report-utils.test.ts [ ... ]
Error: Cannot find module './report-utils' imported from .../components/admin/report-utils.test.ts
FAIL  components/admin/mailing-utils.test.ts [ ... ]
Error: Cannot find module './mailing-utils' ...
FAIL  components/admin/events-utils.test.ts [ ... ]
Error: Cannot find module './events-utils' ...
FAIL  components/admin/content-utils.test.ts [ ... ]
Error: Cannot find module './content-utils' ...
FAIL  components/admin/format.test.ts [ ... ]
Error: Cannot find module './format' ...
FAIL  components/admin/integrations.test.ts > integrationCards ...
AssertionError: expected 'No Postgres connection is configured.…' to match /not persisted|not configured/i
 Test Files  6 failed (6)      Tests  1 failed | 6 passed (7)
```

Five failures were compile-time RED for the intended missing implementations; the sixth was the child agent's own assertion mismatch, which it corrected before implementing.

**GREEN (after implementation), 11:39 MST:**

```
npx vitest run --config components/admin/vitest.config.ts
 Test Files  6 passed (6)      Tests  51 passed (51)
```

**Coverage:**

```
npx vitest run --config components/admin/vitest.config.ts --coverage
Statements   : 91.66% ( 121/132 )
Branches     : 85.71% ( 84/98 )
Functions    : 97.36% ( 37/38 )
Lines        : 98.95% ( 95/96 )
```

**Typecheck:**

```
npx tsc --noEmit
```

At 11:40 MST, `lib/api.ts` and `components/ui.tsx` landed. Re-running `npx tsc --noEmit` produced **zero errors in tw-admin files** (owned pages and `components/admin/**`). One related fix was made after inspecting the real API: `useQuery.error` is a `string`, so `errorText` now preserves string messages instead of replacing them with generic text; a test was added and the suite rerun (51 passing). Other owners' files were not modified.

## Guarantees

| # | Guarantee | Test | Type | Result |
|---|-----------|------|------|--------|
| 1 | Counts format safely; missing dates use an em dash; trends never divide by zero | `format.test.ts` (13 tests) | unit | PASS |
| 2 | Section ids are stable and deterministic; reorder/toggle are immutable | `content-utils.test.ts` (11 tests) | unit | PASS |
| 3 | Invalid drafts and empty section sets are rejected before publish | `content-utils.test.ts` | unit | PASS |
| 4 | HubSpot copy is plain text; consented-export filename is dated | `mailing-utils.test.ts` (6 tests) | unit | PASS |
| 5 | Event forms validate title/date/description/location and safe URLs | `events-utils.test.ts` (6 tests) | unit | PASS |
| 6 | Every report card maps to a field from `admin.stats`; no invented impact | `report-utils.test.ts` (6 tests) | unit | PASS |
| 7 | Integration copy is honest and demo mode is excluded from configured counts | `integrations.test.ts` (7 tests, child agent) | unit | PASS |

## Known gaps

- Shared component props were initially inferred from the frozen contract; after `components/ui.tsx` landed, typecheck confirmed all tw-admin usages match the real API (`PageHeading.title/description`, `Loading.label`, `ErrorNotice.message`, `StatCard.label/value/hint`, `EmptyState.title/description`, `Button.onClick/disabled/type`, `Card.className`).
- `SiteRenderer` in this checkout takes `document` (not `doc`); the content editor passes `document` plus `events`, `team`, `partners`, `preview`.
- Page-level behavior was not exercised with Playwright; only pure utilities are unit tested. Browser E2E remains with tw-review/controller.
- Coverage report did not list `integrations.ts` even though its test passed; the aggregate figures above are exactly what v8 reported.

## Fan-out round (four concrete tasks, three HY4 children + lead)

| Task | Owner | Exclusive files | RED → GREEN evidence |
|------|-------|-----------------|----------------------|
| CMS validation/preview/rollback | `tw-admin-cms` | `app/admin/content/page.tsx`, `content-utils.ts`, `content-utils.test.ts` | 3 failed / 15 passed → 18/18 pass; added `duplicateSectionIds`, collision-safe `ensureStableIds`, publish blocked while dirty, AI candidate explicitly unreviewed, version-conflict reload action |
| Newsletter / HubSpot flow | `tw-admin-news` | `app/admin/mailing/page.tsx`, `mailing-utils.ts`, `mailing-utils.test.ts` | 2 failed / 13 passed → 15/15 pass; `exportFileName` now rejects non-ISO and calendar-invalid dates; clipboard guarded and wrapped; no fake send |
| Mobile nav / form a11y | `tw-admin-a11y` | `app/admin/page.tsx`, `app/admin/events/page.tsx`, `a11y-utils.ts`, `a11y-utils.test.ts` | missing-module RED → 8/8 pass; explicit label/id/error wiring, `aria-live`, named landmarks/targets, 44px touch targets |
| Stats correctness | lead (`tw-admin`) | `app/admin/reports/page.tsx`, `report-utils.ts`, `report-utils.test.ts` | 2 failed / 9 passed → 11/11 pass; `safeCount` prevents NaN/negative stats; all eight `admin.stats` fields mapped exactly; demo-mode badge added |

Combined verification after all four tasks:

```
npx vitest run --config components/admin/vitest.config.ts
 Test Files  7 passed (7)      Tests  79 passed (79)
npx tsc --noEmit
 zero errors in app/admin/{page,content,mailing,reports,events,settings} and components/admin/**
```

Full-repo `npm test` had 3 failures in backend/quality-owned files (`tests/quality/content-ai.test.ts` duplicate-id rejection missing in `server/content-utils.ts` and `server/ai.ts`; `tests/quality/public-renderer.test.ts` JSX parse issue). These are outside tw-admin scope and were not modified.

### Read-only accessibility findings for controller (shared shell, not edited)

1. Active sidebar links use a visual class only — add `aria-current="page"`.
2. Mobile menu button lacks `aria-expanded` / `aria-controls`.
3. Off-canvas close button and overlay share the name "Close navigation"; closed sidebar should be inert/hidden.
4. Breadcrumbs are plain spans — use `<nav aria-label="Breadcrumb">` with an ordered list.
5. No skip link to existing `#main-content`.
6. Sidebar icons are not `aria-hidden`; user avatar uses `title` instead of an accessible label.
