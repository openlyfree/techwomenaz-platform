import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./BasePage";

/** Page object for the sign-in page (password and email-link modes). */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly emailLinkTab: Locator;
  readonly passwordTab: Locator;
  readonly signInButton: Locator;
  readonly requestLinkButton: Locator;
  readonly statusMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel("Email address");
    this.passwordInput = page.getByLabel("Password");
    this.emailLinkTab = page.getByRole("tab", { name: /Email link/i });
    this.passwordTab = page.getByRole("tab", { name: /Email & password/i });
    this.signInButton = page.getByRole("button", { name: "Sign in", exact: true });
    this.requestLinkButton = page.getByRole("button", { name: /Email me a sign-in link/i });
    this.statusMessage = page.getByRole("status");
  }

  async open() {
    await this.goto("/login");
    return this;
  }

  async requestLink(email: string) {
    await this.emailLinkTab.click();
    await this.emailInput.fill(email);
    await this.requestLinkButton.click();
    return this;
  }

  async signInWithPassword(email: string, password: string) {
    await this.passwordTab.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    return this;
  }

  async expectFieldError(field: "email" | "password", message: RegExp | string) {
    // The page also renders a form-level alert; target the field error by its id.
    await expect(this.page.locator(`#login-${field}-error`)).toContainText(message);
    return this;
  }
}
