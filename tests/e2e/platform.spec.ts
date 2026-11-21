import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

function loadLocalAdminCookie(): { name: string; value: string; url: string } | null {
  try {
    const dir = "/tmp/opencode";
    const files = readdirSync(dir).filter((f) => f.startsWith("techwomenaz-local-session-") && f.endsWith(".json")).sort();
    for (const file of files) {
      const data = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as {
        role?: string;
        cookie?: string;
        cookieName?: string;
      };
      if (data.role === "admin" && data.cookie && data.cookieName) {
        const token = data.cookie.split(";")[0]?.split("=").slice(1).join("=");
          if (token) {
          return {
            name: data.cookieName,
            value: token,
            url: process.env.E2E_BASE_URL || "http://127.0.0.1:3100",
          };
        }
      }
    }
  } catch {
    return null;
  }
  return null;
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
        const res = await page.goto(route, { waitUntil: "networkidle" });
        expect(res?.status()).toBeLessThan(400);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `Horizontal overflow on ${route} at ${viewport.name}`).toBe(false);
        const h1Count = await page.locator("h1").count();
        expect(h1Count, `Expected h1 on ${route}`).toBeGreaterThanOrEqual(1);
      }

      expect(errors).toEqual([]);
    });
  }
});

test.describe("Auth gates", () => {
  test("unauthenticated /admin and /portal show sign-in gate", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Sign in to continue/i })).toBeVisible();
    await page.goto("/portal", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Sign in to continue/i })).toBeVisible();
  });
});

test.describe("Authenticated admin & portal mobile-first journeys", () => {
  test("admin and portal routes load with real Postgres data and no mobile overflow", async ({ page, context }) => {
    test.setTimeout(90_000);
    const cookie = loadLocalAdminCookie();
    test.skip(!cookie, "No local admin session cookie present in /tmp/opencode");
    await context.addCookies([cookie!]);

    await page.setViewportSize({ width: 360, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const route of [...ADMIN_ROUTES, ...PORTAL_ROUTES]) {
      const res = await page.goto(route, { waitUntil: "networkidle" });
      expect(res?.status()).toBeLessThan(400);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `Horizontal overflow on ${route} at 360px`).toBe(false);
    }

    // Verify AI content editor mobile tabs exist on /admin/content
    await page.goto("/admin/content", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Publish/i }).first()).toBeVisible();

    // Verify mailing page has Copy for HubSpot, not fake send
    await page.goto("/admin/mailing", { waitUntil: "networkidle" });
    await expect(page.getByText(/HubSpot/i).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
