# Independent quality review — 2026-11-21 (tw-review)

Owner: tw-review (Kimi quality lead). Children: qr-api, qr-matches, qr-content (HY4, read-only).
Freeze deadline 12:10 MST; findings verified against the shared checkout as of ~11:53 MST. No Git, cloud, dependency or config changes were made by this review.

## Methods

- Read-only inspection of backend (`server/**`, `app/api/**`) and frontend (`lib/**`, `components/**`, `app/**`).
- Failing reproducer tests first, owned under `tests/quality/**` (run: `npx vitest run --config tests/quality/vitest.config.ts`).
- In-process tRPC v11 wire probes (qr-api), mentorship/import concurrency analysis (qr-matches), CMS/AI/renderer analysis (qr-content).
- Live Postgres integration suite (`server/postgres.integration.test.ts`) and unit suites re-run for regression evidence.

## Reproducer suite (tests/quality)

| Test | What it proved | Status |
|---|---|---|
| `trpc-wire.test.ts` (3 tests) | `lib/api.ts` query/mutate envelope and `?input=`/POST encoding interop with installed tRPC 11.29.7 (`fetchRequestHandler`), including nested dot-path `auth.session` and `result.data` unwrapping | PASS (green) — no defect |
| `content-ai.test.ts` (2 tests) | Duplicate section `id`s were accepted by `parseSiteDocument` and by `suggestContent` from untrusted Workers-AI JSON | RED at 11:47 → **FIXED by tw-lead** (uniqueness refine, `server/content-utils.ts:48-51`); green at 11:53 |
| `public-renderer.test.ts` (1 test) | Mission-only published document rendered zero `<h1>` | RED at 11:47 → **FIXED by tw-site** (sr-only fallback `<h1>`, `components/site/SiteRenderer.tsx:854-861`); green at 11:53 |

Full repo suites at 11:47: `npm test` = 15 failed / 155 passed; `npm run typecheck` = 5 errors (pre-existing test/export drift owned by tw-lead, e.g. `server/mentorship.test.ts` imports `supportsRole`/`candidateEligibility`). Re-run by owners after their current fixes land.

## Findings

### Verified and fixed during review

1. **High — duplicate section ids server-side (CMS save + AI suggest).** `server/content-utils.ts` had no uniqueness refinement; `server/ai.ts` passed AI JSON through the same schema. Impact: broken React keys, duplicate DOM ids, id-based edits hitting all matches. Fixed: uniqueness refine + client duplicate validation; reproducer green.
2. **Medium — no `<h1>` on mission-only public pages** (`/about` with a fresh DB). Fixed with sr-only fallback heading; reproducer green.

### Open — from qr-matches (mentorship/imports, verified against 11:54 MST checkout; code-evident, no live repro)

9. **Medium (tw-lead) — self-match.** `decide` has no `candidateId !== user.id` guard; a `both` member deciding twice with opposite roles mints `mentorId === menteeId` and double-counts capacity.
10. **Medium (tw-lead) — any participant can overwrite coordinator decisions.** `updateMatch` sets `status` unconditionally with no current-status guard: a participant can mark a `declined` match `completed`, or complete an `awaiting-coordinator` match to free capacity before approval.
11. **Medium (tw-lead) — `admin.approveMatch` has no source-state check** (`server/router.ts:195-196`): approving a `completed`/`declined`/`paused` match reopens closed relationships.
12. **Low (tw-lead) — check-ins accepted on `awaiting-coordinator` matches** before coordinator approval (`server/mentorship.ts:249-252`).
13. **Low (tw-lead) — import PII retained indefinitely**: every preview stores full parsed name/email rows in `import_batches` with no TTL/reaper/cleanup after commit.
14. **Low (tw-members/tw-lead) — CSV size mismatch**: UI/validator advertise 2 MB (`app/admin/imports/page.tsx:218`, `components/membership/admin-helpers.ts:5`), server rejects >1,000,000 chars (`server/router.ts:213`).
15. **Low (tw-lead, semantics) — repeat commit reports already-imported rows as duplicates** (`server/imports.ts:32`), encoded by the existing integration test; UI copy says "skipped".

qr-matches verified-good: private notes author-only (incl. staff); reciprocal-role and bidirectional existing-match logic consistent for normal pairs; per-request `pg.Client` so transactions do not share sessions (the child's "shared Client" claim was downgraded as unreachable); import tokens hashed, staff-bound, 1-hour expiry, one-shot commit inside a real transaction. Untested risks flagged: no `CHECK (mentor_id <> mentee_id)`/unique-pair constraint, no FK indexes, Postgres-gated service tests skipped without `DATABASE_URL`, no parallel-commit or expiry tests.

### Open — routed to file owners

3. **Medium (tw-lead) — publish has no server-side readiness check.** `server/content.ts:51-61` validates only `baseVersion`; `plainText` has no `.min(1)` on title and no "≥1 enabled section" guard. A staff member can publish a blank site (`public.site` returns zero visible sections → blank home, "not published yet" leaves). Fix: `.min(1)` on title + publish guard (≥1 enabled section, unique ids already enforced).
4. **Low (tw-lead) — 503 pre-handler error envelope is the wrong shape.** `app/api/trpc/[trpc]/route.ts:13` returns `{ error: "PostgreSQL is unavailable…" }`; `lib/api.ts` reads `error.json?.message ?? error.message`, so the actionable config guidance is discarded and users see "This service is unavailable." Fix: return `{ error: { message: "…" } }` (tRPC v11 shape).
5. **Medium (tw-admin) — admin settings masks session errors.** `app/admin/settings/page.tsx:99-109` checks `!session.user` before `session.error`; since `useSession()` returns `user: data ?? null`, any `auth.session` failure (including the 503 above) renders the sign-in gate and the ErrorNotice is unreachable. `/login` (app/login/page.tsx:63-70) does it correctly. Fix: check `session.error` first.
6. **Low (tw-admin) — incomplete ARIA tabs pattern** in `app/admin/content/page.tsx:123-142` (`role="tablist"/tab` without `id`/`aria-controls`, no `role="tabpanel"`, no arrow-key navigation); validation lists on content/mailing pages are not announced (`aria-live`/`role="alert"`).
7. **Low (tw-site) — theme control is inert.** `app/admin/content/page.tsx:153-163` offers Desert/Navy and the schema accepts both, but `SiteRenderer` never reads `document.theme`; selecting Navy changes nothing on preview or live site. Fix: implement variants or remove the control.
8. **Low (tw-lead) — CSV export formula injection defense-in-depth.** `server/router.ts:235` prefixes `'` only for `^[=+\-@]`; names are trimmed at both ingestion paths today, but OWASP also lists tab/CR/LF payloads. Cheap hardening: prefix on `[\t\r\n]` or strip control chars at export.

### Notes for controller (no action requested from this review)

- `lib/api.ts:9,24` retains a dead tRPC v9-era `error.json.message` branch; v11 emits `{ error: { message, code, data } }` (probed by qr-api). Harmless, mildly misleading.
- Secure-cookie flag is now origin-hardened (`server/auth.ts:171-183`): plain-HTTP loopback dev origins only; unparseable origins keep `Secure`. Verified good.
- QR-api verified: sign-out set-cookie reaches the Response via `responseMeta`; `safeNextPath` blocks `/\evil.com` backslash redirects; paused members are rejected at magic-link verify (`npx vitest run server/auth.test.ts` → 15/15).
- CSV-in-Excel behavior and a real-browser pass over admin tabs were NOT executed (child-known gaps).

### Verified correct — do not chase

- tRPC v11 wire interop for GET (`?input=` encoded JSON) and POST (raw JSON body) against 11.29.7 — covered by `trpc-wire.test.ts`.
- Public renderer fallback correctness: `resolvePublicSiteState` discards stale live records after an API error (covered by `components/site/states-render.test.tsx`).
- CSV import parsing (quotes, BOM, CRLF, in-file duplicates), import token binding/expiry/one-shot commit (`postgres.integration.test.ts` import case).
- Private check-in notes are author-only, including from staff (`visiblePrivateNote` + integration test).

## Lineage

- Controller → tw-review (this pane, wJ:pA).
- tw-review → qr-api (wJ:pS, done, reaped), qr-content (wJ:pV, done, reaped), qr-matches (wJ:pT, done; spawned one read-only child qr-imports in wJ:pW, captured by qr-matches and reaped).
- Workspace wJ was closed by the controller after capture; all qr-* reports were read before close. Nothing left to reap from this review.

## Closure (12:06 MST)

Owner fix requests all landed and were verified in code by this review before freeze:

- tw-lead: publish readiness guard (`server/content.ts:39-42`, `server/content-utils.ts:28-39` title min/blank check), 503 envelope in tRPC v11 shape (`app/api/trpc/[trpc]/route.ts:13-16`), CSV export control-char stripping (`server/router.ts:248-249`), self-match rejection (`server/mentorship.ts:174`), participant status-transition guard (`server/mentorship.ts:238-240`), coordinator-approval source-state check (`server/router.ts:196-201`).
- tw-admin: settings page now checks `session.error` before the sign-in gate (`app/admin/settings/page.tsx:99-109`); ARIA tabs completed with `aria-controls`/`role="tabpanel"`/arrow-key navigation (`app/admin/content/page.tsx:163-172,207,384,410`).
- tw-site: mission-only pages get a real heading via sr-only fallback `<h1>` (`components/site/SiteRenderer.tsx:854-861`) and theme is now wired (`document.theme` consumed at `SiteRenderer.tsx:860,875`).

Reproducer suite status at 12:06 (`npx vitest run --config tests/quality/vitest.config.ts`): all six of this review's tests pass. The directory additionally hosts polish workers' in-flight TDD files (`form-a11y.test.ts`, `mentorship-polish.test.ts`, `shell-pages.test.ts`, `admin-responsive.test.ts` — placed here by their owners); 10 of their tests are RED mid-cycle (tw-forms, tw-mentor-polish still working) and belong to those owners' GREEN steps, not to this review.
