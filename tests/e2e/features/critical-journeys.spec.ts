import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { PublicPage } from "../pages/PublicPage";

const PUBLIC_ROUTES = ["/", "/about", "/events", "/contact"];

test.describe("Public site smoke", () => {
  test("key routes render a heading without runtime errors or mobile overflow", async ({ page }) => {
    const publicPage = new PublicPage(page);
    const errors = publicPage.collectPageErrors();

    await page.setViewportSize({ width: 360, height: 800 });

    for (const route of PUBLIC_ROUTES) {
      await publicPage.open(route);
      await publicPage.expectNoHorizontalOverflow(route);
    }

    await publicPage.expectNoPageErrors(errors);
    await publicPage.screenshot("public-site-smoke");
  });
});

test.describe("Sign-in", () => {
  test("email-link mode rejects an invalid email before calling the API", async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.requestLink("not-an-email");
    await login.expectFieldError("email", /Enter the email address you used/i);
  });

  test("password mode requires a valid email and a password", async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.signInWithPassword("not-an-email", "");
    await login.expectFieldError("email", /Enter the email address you used/i);
    await login.expectFieldError("password", /Enter your password/i);
  });
});
