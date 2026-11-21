import { expect, test, type Page } from "@playwright/test";

/**
 * Landing-page QA journeys (docs/LANDING-MISSION.md).
 *
 * Selectors live inline because the terrain layers are decorative SVG paths
 * with no semantic role; they are identified by the exact source fills frozen
 * in the mission doc (lead-approved, no data-testid needed). Copy/CTA use
 * semantic roles per tests/e2e/README.md.
 */

const RIDGE_FILL = {
  far: "#F6A766",
  mid: "#F28A3E",
  near: "#F07828",
  foreground: "#D9611A",
  cacti: "#22395A",
} as const;
type RidgeName = keyof typeof RIDGE_FILL;
const RIDGES = Object.keys(RIDGE_FILL) as RidgeName[];

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "mobile-360", width: 360, height: 800 },
] as const;

/** Auto-retrying layout check — same approach as platform.spec.ts. */
async function expectNoOverflow(page: Page, label: string) {
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { message: `Horizontal overflow on ${label}` },
    )
    .toBeLessThanOrEqual(1);
}

/** Collect uncaught page errors for a final empty-list assertion. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Computed transform of the layer that owns `selector`. The scroll transform
 * sits on each layer's wrapping <svg>, so walk up from the filled path to the
 * first ancestor-or-self whose transform is not "none".
 */
function readLayerTransform(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    let node: Element | null = document.querySelector(sel);
    while (node) {
      const transform = window.getComputedStyle(node).transform;
      if (transform && transform !== "none") return transform;
      node = node.parentElement;
    }
    return "none";
  }, selector);
}

/** Extract the translateY component from a computed matrix(...). */
function matrixTranslateY(transform: string): number {
  const match = transform.match(/matrix\((.+)\)/);
  if (!match) return 0;
  const values = match[1].split(",").map((value) => Number.parseFloat(value.trim()));
  return values.length >= 6 ? values[5] : 0;
}

function ridgeSelector(ridge: RidgeName): string {
  return `[fill="${RIDGE_FILL[ridge]}"]`;
}

test.describe("Landing hero — desert terrain (docs/LANDING-MISSION.md)", () => {
  for (const viewport of VIEWPORTS) {
    test(`hero copy, CTA, scrim and no horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Headline and primary CTA visible and readable over the terrain.
      const headline = page.getByRole("heading", { level: 1 });
      await expect(headline).toBeVisible();
      await expect(headline).toContainText(/find your people/i);

      const cta = page.getByRole("link", { name: "Find your people" }).last();
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/join");

      // Every frozen terrain layer is present behind the copy.
      for (const ridge of RIDGES) {
        await expect(page.locator(ridgeSelector(ridge)).first()).toBeAttached();
      }

      // A scrim paints between the terrain (z:0) and the copy.
      const scrim = page.locator(".twaz-hero__scrim");
      await expect(scrim).toBeAttached();
      expect(await scrim.evaluate((el) => getComputedStyle(el).backgroundImage)).not.toBe("none");
      const sceneZ = await page
        .locator(".twaz-desert__scene")
        .evaluate((el) => Number(getComputedStyle(el).zIndex));
      const scrimZ = await scrim.evaluate((el) => Number(getComputedStyle(el).zIndex));
      expect(scrimZ, "scrim must stack above the terrain scene").toBeGreaterThan(sceneZ);

      await expectNoOverflow(page, `/ at ${viewport.name}`);
      expect(errors).toEqual([]);
    });
  }

  test.describe("scroll-linked parallax", () => {
    for (const viewport of VIEWPORTS) {
      test(`terrain layers travel at different speeds while scrolling at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const errors = collectErrors(page);
        await page.goto("/", { waitUntil: "domcontentloaded" });

        const before = {} as Record<RidgeName, string>;
        const after = {} as Record<RidgeName, string>;
        for (const ridge of RIDGES) {
          await expect(page.locator(ridgeSelector(ridge)).first()).toBeAttached();
          before[ridge] = await readLayerTransform(page, ridgeSelector(ridge));
        }

        await page.mouse.wheel(0, 600);
        const foreground = ridgeSelector("foreground");
        await expect
          .poll(() => readLayerTransform(page, foreground), {
            message: "foreground layer never moved on scroll",
          })
          .not.toBe(before.foreground);

        for (const ridge of RIDGES) {
          after[ridge] = await readLayerTransform(page, ridgeSelector(ridge));
        }

        for (const ridge of RIDGES) {
          expect(after[ridge], `${ridge} layer must move on scroll`).not.toBe(before[ridge]);
          expect(after[ridge], `${ridge} layer must be transform-linked, not static`).not.toBe("none");
        }

        // Every layer transforms differently from every other layer.
        const distinct = new Set(RIDGES.map((ridge) => after[ridge]));
        expect(distinct.size, `layers must transform differently: ${JSON.stringify(after)}`).toBe(
          RIDGES.length,
        );

        // Speed ordering per the frozen travel table (sky < far < mid < near < fg < cacti).
        expect(Math.abs(matrixTranslateY(after.cacti))).toBeGreaterThan(
          Math.abs(matrixTranslateY(after.foreground)),
        );
        expect(Math.abs(matrixTranslateY(after.foreground))).toBeGreaterThan(
          Math.abs(matrixTranslateY(after.near)),
        );
        expect(Math.abs(matrixTranslateY(after.near))).toBeGreaterThan(
          Math.abs(matrixTranslateY(after.mid)),
        );
        expect(Math.abs(matrixTranslateY(after.mid))).toBeGreaterThan(
          Math.abs(matrixTranslateY(after.far)),
        );

        expect(errors).toEqual([]);
      });
    }
  });

  test.describe("prefers-reduced-motion: reduce", () => {
    test.use({ reducedMotion: "reduce" });

    test("parallax is fully disabled — static landscape, no scroll-linked transforms", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const errors = collectErrors(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Copy remains visible; only movement is disabled.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const before = {} as Record<RidgeName, string>;
      for (const ridge of RIDGES) {
        before[ridge] = await readLayerTransform(page, ridgeSelector(ridge));
      }

      await page.mouse.wheel(0, 600);
      // Give any (forbidden) scroll-linked update two frames to appear.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      for (const ridge of RIDGES) {
        const moved = await readLayerTransform(page, ridgeSelector(ridge));
        expect(moved, `${ridge} layer must not move under prefers-reduced-motion`).toBe(
          before[ridge],
        );
      }

      // The hook must not write scroll-linked custom properties at all.
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--progress"))).toBe("");
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--scroll-y"))).toBe("");
      expect(errors).toEqual([]);
    });
  });
});
