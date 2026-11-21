import { test, expect, type Page } from "@playwright/test";
import { addLocalAdminCookie } from "./fixtures/auth";

const PUBLIC_ROUTES = ["/", "/about", "/mentorship", "/events", "/join", "/login", "/contact"];
const ADMIN_ROUTES = [
  "/admin",
  "/admin/members",
  "/admin/imports",
  "/admin/mentorship",
  "/admin/content",
  "/admin/mailing",
  "/admin/reports",
  "/admin/events",
  "/admin/settings",
];
const PORTAL_ROUTES = ["/portal", "/portal/profile", "/portal/discover", "/portal/mentorship", "/portal/preferences"];

/** Auto-retrying layout check — replaces arbitrary sleeps during animations. */
async function expectNoOverflow(page: Page, label: string) {
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { message: `Horizontal overflow on ${label}` },
    )
    .toBeLessThanOrEqual(1);
}

test.describe("Public website desktop & mobile", () => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile-360", width: 360, height: 800 },
  ]) {
    test(`renders all public routes cleanly at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      for (const route of PUBLIC_ROUTES) {
        const res = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(res?.status()).toBeLessThan(400);
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoOverflow(page, `${route} at ${viewport.name}`);
      }

      expect(errors).toEqual([]);
    });
  }
});

test.describe("Auth gates", () => {
  test("unauthenticated /admin and /portal show sign-in gate", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Sign in to continue/i })).toBeVisible();
    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Sign in to continue/i })).toBeVisible();
  });
});

test.describe("Authenticated admin & portal mobile-first journeys", () => {
  test("admin and portal routes load with real Postgres data and no mobile overflow", async ({ page, context }) => {
    test.setTimeout(90_000);
    const hasAdminSession = await addLocalAdminCookie(
      context,
      process.env.E2E_BASE_URL || "http://127.0.0.1:3100",
    );
    test.skip(
      !hasAdminSession,
      "Local-only: run node --env-file=.env.local scripts/local-session.mjs to create an admin session",
    );

    await page.setViewportSize({ width: 360, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const route of [...ADMIN_ROUTES, ...PORTAL_ROUTES]) {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBeLessThan(400);
      await expectNoOverflow(page, `${route} at 360px`);
    }

    // Verify AI content editor mobile tabs exist on /admin/content
    await page.goto("/admin/content", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Publish/i }).first()).toBeVisible();

    // Verify mailing page has Copy for HubSpot, not fake send
    await page.goto("/admin/mailing", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/HubSpot/i).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
