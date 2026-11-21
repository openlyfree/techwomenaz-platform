# End-to-end tests (Playwright)

E2E setup follows the ECC [`e2e-testing`](https://github.com/affaan-m/ECC) skill:
Page Object Model, semantic locators, condition-based waits, trace/video on
failure, and CI artifact uploads.

## Layout

```
tests/e2e/
├── pages/                  # Page Object Model
│   ├── BasePage.ts         # navigation, assertions, error collection, screenshots
│   ├── PublicPage.ts       # public content pages
│   └── LoginPage.ts        # passwordless sign-in flow
├── fixtures/
│   └── auth.ts             # local admin cookie helper (skips if absent)
├── features/
│   └── critical-journeys.spec.ts
└── platform.spec.ts        # existing broad route/auth smoke coverage
```

## Running

```bash
npm run test:e2e                 # headless, all specs
npm run test:e2e:headed          # watch the browser
npm run test:e2e:ui              # Playwright UI / inspector
npm run test:e2e:report          # open the last HTML report
npx playwright test --project=chromium tests/e2e/features/critical-journeys.spec.ts
```

The web server is started automatically on `127.0.0.1:3100`. Override with
`E2E_BASE_URL` if you already have the app running elsewhere.

The authenticated admin/portal journey is **local-only**: it needs a private
session cookie produced by the controller-approved bootstrap script:

```bash
node --env-file=.env.local scripts/local-session.mjs
```

CI runs the anonymous smoke/auth-gate tests; the admin journey skips when no
session cookie is present (never provision a privileged session in CI).

## Conventions

- Put locators in page objects; keep specs as journeys/assertions.
- Prefer `getByRole`/`getByLabel` over CSS or XPath. Add `data-testid` only when
  semantic selectors are genuinely unavailable.
- Wait for conditions (`expect(...).toBeVisible()`, `waitForResponse()`), never
  `waitForTimeout()`. For transient layout/animation settling use `expect.poll()`,
  as in `expectNoOverflow()`.
- Collect `pageerror` events and assert an empty list at the end of a journey.
- Quarantine flaky tests with `test.fixme()` / `test.skip()` and link an issue.

## Artifacts

- `playwright-report/` — HTML report
- `artifacts/junit.xml`, `artifacts/results.json` — machine-readable results
- `artifacts/*.png` — screenshots from page objects
- `test-results/` — traces, videos, and failure context (`trace: on-first-retry`,
  `video: retain-on-failure`)

All of these are gitignored. CI uploads them even on failure.

## Adding browsers

Only Chromium is installed locally by default. To enable the cross-browser
projects commented in `playwright.config.ts`:

```bash
npx playwright install firefox webkit
```
