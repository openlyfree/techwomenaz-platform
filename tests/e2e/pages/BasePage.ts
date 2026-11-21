import { expect, type Locator, type Page } from "@playwright/test";

/** Shared navigation, assertion, and artifact helpers for all page objects. */
export abstract class BasePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
  }

  async goto(path: string) {
    const response = await this.page.goto(path, { waitUntil: "networkidle" });
    expect(response, `No response received for ${path}`).not.toBeNull();
    expect(response!.status(), `Unexpected HTTP status for ${path}`).toBeLessThan(400);
    return this;
  }

  async expectHeading(text?: RegExp | string) {
    await expect(this.heading.first()).toBeVisible();
    if (text) await expect(this.heading.first()).toContainText(text);
    return this;
  }

  async expectNoHorizontalOverflow(label: string) {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `Horizontal overflow on ${label}`).toBe(false);
    return this;
  }

  /** Attach before navigating. Assert with `expectNoPageErrors` at the end. */
  collectPageErrors(): string[] {
    const errors: string[] = [];
    this.page.on("pageerror", (error) => errors.push(error.message));
    return errors;
  }

  async expectNoPageErrors(errors: string[]) {
    expect(errors).toEqual([]);
    return this;
  }

  screenshot(name: string) {
    return this.page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  }
}
