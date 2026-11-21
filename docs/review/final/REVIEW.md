# tw-review — Final security & correctness review of the latest diff

Reviewer: tw-review (GLM-5.3-Flash) · Date: 2026-11-21 · Mission: `docs/FINISH-MISSION.md`
Scope: `git diff HEAD` plus new untracked files in the reviewed feature areas: landing parallax (DesertBackdrop / useScrollProgress / desert-backdrop.css), email+password auth (`server/router.ts`, `server/auth-utils.ts`, `scripts/bootstrap.mjs`), audit log (`audit_events` + router writes + `/admin/audit`), directory (`directory.list`, `/portal/directory`), calendar links, admin dark mode, `cloudflare.config.ts` sync (incl. `scripts/update-site-content.mjs`, `scripts/seed.mjs`).

Method: read-only code review against the security-review checklist (secrets, input validation, authn/authz, injection, XSS, CSRF, rate limiting, data exposure) + correctness/a11y review. All findings verified against actual file contents; no app/server edits were made.

## Deliverables

| File | Purpose |
|---|---|
| `docs/review/final/REVIEW.md` | This report |
| `tests/quality/review-final-repro.test.ts` | RED reproducer tests (new, zero-collision: not under `tests/e2e/**`, not `server/postgres.integration.test.ts`, not `tests/password-auth.test.ts`, no other `tests/quality` filename touched) |

Reproducer evidence (actual run):

```
node_modules/.bin/vitest run tests/quality/review-final-repro.test.ts
Test Files  1 failed (1)
     Tests  3 failed (3)
```

All three fail exactly as predicted by findings R2-guard and M5 (`verifyPassword` throws instead of returning `false`; config default is `"false"`). These tests are intentionally left RED for the owning agents to fix or for the controller to accept/delete with a written rationale.

---

## Findings by severity

### Critical

None found.

### High

**H1 — Coordinator-approval default flipped off in config: mutual-interest matches self-activate**
- File: `cloudflare.config.ts:24` — `REQUIRE_MATCH_APPROVAL: bindings.text("false")` (was `"true"` before this diff).
- Effect: `server/matching.ts:14` (`matchStatusForMutualInterest`) maps `"false"` → `"active"`, so a mutual Interested/Pass now creates an immediately active mentorship with **no coordinator approval**. `docs/AGENTS.md` and `docs/API-CONTRACT.md:48` state approval-by-default (`"true"`), with `"false"` permitted only after a verified user instruction — which has NOT been verified per mission rules ("nonprofit message truncated and NOT verified").
- Compounding: match creation is not audited (audit events exist only for coordinator approve/decline, `server/router.ts:236-241`), so under `"false"` there is no record of who activated a match.
- Reproduction: with this config, two approved members both click Interested on each other in `/portal/discover` → match appears in `/portal/mentorship` as "active" instantly, no `/admin/mentorship` review step.
- Reproducer test: `tests/quality/review-final-repro.test.ts` → "config sync guard" (RED).
- Recommended owner: **controller (tw-final-lead)** — config file owner. Either restore `"true"` or document a verified instruction in `docs/API-CONTRACT.md` and flip the guard test deliberately.

**H2 — Join-with-password claims email ownership that was never verified; arbitrary email pre-claim locks real applicants out**
- Files: `server/router.ts:165` (`emailVerifiedAt: passwordHash !== null ? new Date() : null`), `server/router.ts:158` (CONFLICT on existing email), `server/router.ts:107` (sign-in allows any non-paused member — `server/auth-utils.ts:24-26` also lets pending members authenticate by magic link, so this is symmetric, but the password path creates the false "verified" flag).
- Effects:
  1. `email_verified_at` is set to "now" with zero verification — the column's meaning (verified email ownership, set by magic-link verification at `server/auth.ts:119-121`) is falsified for every password join. Any future feature that trusts `emailVerifiedAt` inherits the lie.
  2. Anyone who knows a person's email can submit an application with a password on that email **before** the real person joins; the real owner then gets `CONFLICT` ("An application already exists for this email", `server/router.ts:158`) and cannot apply. Coordinator approval still gates discovery/directory (verified, see PASS-F5), so the impersonator needs human sign-off — but the victim is locked out unconditionally.
- Reproduction: `POST /api/trpc auth.join` with `{email: "victim@example.com", password: "longenough1", …}` → success; repeat as the victim → CONFLICT; sign in with the attacker password → `auth.signIn` returns success while status is still `pending`.
- Recommended owner: **tw-lead** (router). Minimum fix: set `emailVerifiedAt: null` for password joins and keep the column exclusively owned by magic-link verification; document the pre-claim risk for the coordinator (e.g., show "email not verified" on the admin member view). Long-term: verify email ownership before treating the account as verified.

### Medium

**M1 — Timing side-channel enables user enumeration in `auth.signIn`**
- File: `server/router.ts:107-108`. For unknown emails, members without a password, and paused members, `verifyPassword` (PBKDF2, 100 000 SHA-256 iterations ≈ tens of ms of CPU) is **skipped**; only real password holders pay that cost. The response *message* is uniform (good), but latency distinguishes registered password accounts from unknown emails.
- Reproduction: script 20 `auth.signIn` calls per account class (registered+password vs unregistered), same wrong password, compare median latency — the registered class is measurably slower.
- Recommended owner: **tw-lead**. Fix: when `!member?.passwordHash`, still run `verifyPassword(input.password, DUMMY_HASH)` against a precomputed hash so every path costs the same.

**M2 — No rate limiting / lockout on `auth.signIn`**
- File: `server/router.ts:98-121`. `auth.requestLink` is limited to 5 links/hour/email (`server/auth.ts:65-71`), but password guessing is unlimited (Turnstile is only wired to `join`, not `signIn`).
- Reproduction: loop `auth.signIn` with common passwords against a seeded demo account — no 429/lockout ever occurs.
- Recommended owner: **tw-lead** (with controller agreement on storage; a per-email+IP counter table like `auth_tokens`, or Turnstile on the login form, are the in-repo precedents).

**M3 — Admin dark-mode attribute leaks onto the member portal with no way back**
- Files: `components/shell.tsx:44-56` (attribute set on `<html>`, never removed on unmount/role change; toggle button rendered only when `staff`), `app/globals.css:141-163` (selectors scope to `html[data-admin-theme="dark"] .workspace`).
- The member portal uses the same `WorkspaceShell` (`div.workspace`), so the dark CSS applies to member pages too, but the toggle is staff-only.
- Reproduction: sign in as admin → `/admin` → click the moon toggle → navigate to `/portal` → member workspace renders dark; no toggle exists there to switch back (only clearing `localStorage["twaz-admin-theme"]` fixes it). Public pages are unaffected (no `.workspace`).
- Recommended owner: **tw-site/tw-members (HY4)** — `components/shell.tsx` owner per AGENTS.md (route to controller if ambiguous). Fix: clear `data-admin-theme` when `staff` is false (effect cleanup), or scope the persisted key/attribute per shell.

**M4 — PBKDF2 at 100 000 iterations is below OWASP guidance and may exceed Workers Free CPU**
- File: `server/auth-utils.ts:34` (`PBKDF2_ITERATIONS = 100_000`), used by `hashPassword`/`verifyPassword` at `server/auth-utils.ts:37-54` and consumed on every `auth.signIn`, `auth.join` (with password) request.
- OWASP 2023 recommends ≥ 600 000 iterations for PBKDF2-SHA256. Also unverified: on Workers **Free** (10 ms CPU per request), `deriveBits` at 100k iterations may blow the CPU limit and fail sign-in/join at runtime; on Paid it is fine. No evidence of the deployed plan was available to this review.
- Reproduction: measure `node -e` PBKDF2 100k wall time locally (~30–60 ms CPU) and compare to the 10 ms Workers Free budget; deploy to the target plan and watch for CPU-limit errors on `/api/trpc`.
- Recommended owner: **tw-lead** (with controller decision on plan/tuning; iteration count is already encoded in the stored hash, so raising it is backward-compatible for new hashes).

**M5 — `verifyPassword` throws on a corrupted stored hash → INTERNAL 500 instead of the uniform 401 (RED test)**
- File: `server/auth-utils.ts:44-54`. `Number("0")` iterations makes `crypto.subtle.deriveBits` throw; an invalid base64 salt makes `atob` throw. A single corrupted `password_hash` row turns every sign-in attempt for that member into a 500, and the iteration count stored in the row is trusted verbatim (anyone with DB write access can downgrade it to 1).
- Reproducer test: `tests/quality/review-final-repro.test.ts` (RED, 2 cases).
- Recommended owner: **tw-lead**. Fix: clamp iterations to a sane range and wrap `derivePassword` in try/catch → `return false`.

**M6 — Seed data presents an unverified real-world event as fact**
- File: `scripts/seed.mjs:242-248` — event `Finance Series: Money 101`, description "…hosted by the official organizers", `registerUrl: "https://luma.com/52nzzzbq"`, with no `[fictional]` marker while all seeded members/team/partners carry `[fictional]`.
- Mission rule: nonprofit content is unverified; record-level data must stay labeled as fictional. This seed renders on the public `/events` page as a real event with a real registration URL, and `scripts/update-site-content.mjs` branding never touches events.
- Reproduction: run the seed, open the public events page → event shows with title/description/link and no fictional label.
- Recommended owner: **controller** (seed/content owner). Fix: add `[fictional]` or `[unverified]` marker + `example.invalid` URL, or obtain verified confirmation for the event.

**M7 — Audit writes are non-atomic and coverage contradicts the audit page copy**
- Files: every audit insert runs **after** the mutation with no transaction and no error handling — e.g. `server/router.ts:227-228` (approveMember), `236-241` (approveMatch), `253-255` (saveEvent), `315-318` (imports.commit), `341-346` (content.save), `353-356` (content.publish). If the insert fails (e.g. migration 0001 not applied), the mutation is already committed: the user sees an error but the change persisted, and no audit row exists.
- Coverage: `content.rollback` and mailing actions are not audited, while `app/admin/audit/page.tsx:38` claims "Every staff action that changes member records, matches, published content, events or imports is recorded here automatically."
- Reproduction: drop `audit_events` (or point DATABASE_URL at a DB without migration 0001) → approve a member → member is approved in DB, API returns an error, audit page shows nothing.
- Recommended owner: **tw-lead**. Fix: wrap mutation+audit in one transaction (or best-effort insert with explicit logging), and align page copy or add the missing audit writes.

### Low

**L1 — Directory privacy verified, with two nits** — `server/router.ts:307-317` selects no `email`/`bio`/availability (PASS-F4 below). Nits: `capacity` is selected but dropped (dead field, `server/router.ts:311`); free-text `location`/`headline` could embed contact info (member-controlled, opt-in). Owner: tw-lead.

**L2 — Directory self-visibility inconsistency** — staff viewers see their own entry, member viewers are excluded via `isNotViewer` (`server/router.ts:312-315`). Harmless; document or unify. Owner: tw-lead.

**L3 — Directory/audit have no pagination** — `audit.list` caps at 200 (`server/router.ts:351`); `directory.list` is unbounded. Fine at demo scale. Owner: tw-lead.

**L4 — Google Calendar link hardcodes a 1-hour meeting and exports names/goal to Google** — `components/mentorship/utils.ts:156-171` (`endMs = startMs + 60*60*1000`; names + goal in the URL query to a third party). Link uses `target="_blank" rel="noopener noreferrer"` correctly (`components/mentorship/MatchDetail.tsx:303-313`). Owner: tw-mentor (HY4).

**L5 — Old-Safari reduced-motion listener gap** — `components/site/useScrollProgress.ts:96` uses `addEventListener?.` without an `addListener` fallback; on old Safari the JS listener stays active under reduced motion, but the CSS guard (`desert-backdrop.css:48-53`, `transform:none !important`) still freezes the visuals. Net effect: cosmetic-only. Owner: tw-site.

**L6 — Landing page can render without any `<h1>`** — `app/page.tsx:18-24` renders `<Hero section={hero}/>` which returns `null` when the hero section is missing/disabled, and `LandingSections` forces all headings to level 2 (`components/site/SiteRenderer.tsx:788,853-862` via `sectionsLevel2`). If the only section is a disabled hero, the page has no h1 (a11y heading regression). Owner: tw-site (HY4).

**L7 — Dark-mode first-paint flash + login copy overpromise** — theme applied only in `useEffect` (`components/shell.tsx:44-50`) → light flash on staff pages; `app/login/page.tsx:96` says "Opening your workspace…" but the page stays put and shows the signed-in card (`app/login/page.tsx:86-100`) instead of redirecting. Owner: tw-site/HY4.

**L8 — `bootstrap.mjs` takes the password via argv** — `scripts/bootstrap.mjs:13` — visible in shell history/`ps`. Local-only demo tool, uses `redact` for DB errors; acceptable with documentation. Owner: tw-auth.

**L9 — `update-site-content.mjs` publishes directly, bypassing the editor flow and the audit log** — `scripts/update-site-content.mjs:101-113` overwrites `draft` **and** `published` in SQL; no audit event is recorded for the published change (contradicts audit page copy, see M7). Versioning is preserved via `content_revisions`. Owner: controller.

**L10 — Observability verbosity** — `cloudflare.config.ts:31-32`: `logs: { headSamplingRate: 1, invocationLogs: true, persist: true }` maximizes log volume/cost on Workers. Controller decision.

---

## Verified PASS items (mission concerns)

| # | Concern | Verdict | Evidence |
|---|---|---|---|
| P1 | Password stored only as PBKDF2 hash (a) | **PASS** | `server/auth-utils.ts:34-67`: PBKDF2-SHA256, 16-byte CSPRNG per-password salt, constant-time digest compare (`verifyPassword` loop, lines 50-53), no plaintext path; `scripts/bootstrap.mjs:25` stores `hashPassword` output; seed contains no passwords. Hardening notes: M4, M5. |
| P2 | `signIn` no user enumeration (b) | **PARTIAL** | Message is uniform (`server/router.ts:106-108`) but timing leaks existence (M1) and there is no rate limit (M2). |
| P3 | Audit events do not leak PII (c) | **PASS** | Summaries contain member names, match ids, event titles, import counts only — no emails, passwords, tokens, or private notes (`server/router.ts` audit inserts); `audit.list` is `staffProcedure(["admin"])` (`server/router.ts:348-358`); UI is admin-only (`app/admin/audit/page.tsx`). |
| P4 | Directory never exposes emails (d) | **PASS** | `server/router.ts:307-317` select list has no `email`, `bio`, or availability columns; `DirectoryEntry` DTO (`lib/contracts.ts:44`) matches; page copy and server behavior agree (`app/portal/directory/page.tsx`). |
| P5 | Parallax reduced-motion correctness (e) | **PASS** | JS: hook bails with no listeners and clears `--scroll-y`/`--progress` when `prefers-reduced-motion: reduce` matches (`components/site/useScrollProgress.ts:56-60`), live preference changes handled (lines 83-93); CSS: `transform:none !important` + `will-change:auto` (`desert-backdrop.css:48-53`). No React state per scroll frame (lines 39-76). Nits: L5, L6. |
| P6 | Join-with-password does not bypass staff approval for discovery (f) | **PASS** | Join inserts `status: "pending"` (`server/router.ts:166`); discovery requires an approved actor and approved+discoverable candidates (`server/mentorship.ts:85, 90-91, 182`); directory requires `status="approved"` + `discoverable` (`server/router.ts:310-311`). Residual risks are H2/M1/M2, not an approval bypass. |
| P7 | Session/cookie handling | **PASS** | Opaque 32-byte token, only its SHA-256 hash stored (`server/auth.ts:73-80, 122-128`; `auth-utils.ts:28-31`); cookie `HttpOnly; SameSite=Lax; Secure` on all non-loopback origins (`server/auth.ts:171-187`); `getSessionUser` re-checks expiry + `memberCanAuthenticate` (`server/auth.ts:142-163`); `signIn` reuses the same hardened session path. |
| P8 | Input validation on new endpoints | **PASS** | Zod `.strict()` schemas with length caps on `signIn`/`join`/directory/audit inputs (`server/router.ts:98-102, 140-144`); password min 8 / max 200 enforced server-side (`server/router.ts:145`, `auth-utils.ts:64-66`); no string-concatenated SQL (all Drizzle parameterized; raw SQL only with bound params in `bootstrap.mjs`/`update-site-content.mjs`). |

## Known gaps

- No live Postgres/Workers reproduction was performed for M1/M2 (timing, rate limiting) — reasoned from code, not measured end-to-end; the RED unit reproducers cover M5/H1 only.
- Workers plan (Free vs Paid) and its 10 ms CPU budget could not be verified from the repo — M4 remains an open deployment question for the controller.
- `app/admin/mentorship/page.tsx` (rewritten in this diff) was reviewed at read level (UI-only client page calling existing procedures; no new server surface, mutations are the already-audited `admin.approveMatch`); a dedicated UI-behavior test pass was out of my file scope.
- `cloudflare.config.ts` observability flags (L10) assessed for cost/verbosity only; actual deployed behavior not observed.
- The failing reproducer tests intentionally remain RED; per mission rules I did not fix any app/server code, and no Git operations were performed.
