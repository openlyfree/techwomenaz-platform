import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

/** Page object for the public marketing/content pages. */
export class PublicPage extends BasePage {
  readonly signInLink: Locator;

  constructor(page: Page) {
    super(page);
    this.signInLink = page.getByRole("link", { name: /Sign in to continue/i });
  }

  async open(path: string) {
    await this.goto(path);
    await this.expectHeading();
    return this;
  }
}
