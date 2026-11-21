import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * User-perceived visual parallax contract (docs/PARALLAX-FIX-MISSION.md,
 * frozen as D1/D3/D4/D7 in docs/PARALLAX-DECISIONS.md).
 *
 * These tests prove what a human sees, not implementation details:
 *   a. `.twaz-desert` is a fixed full-viewport backdrop (position fixed,
 *      inset 0, z-index 0, pointer-events none) that stays attached while the
 *      page scrolls far past the hero.
 *   b. The terrain sits BEHIND page content (elementFromPoint over a section
 *      resolves to content, never to the desert scene).
 *   c. Terrain layers travel SUBSTANTIALLY across the whole document — cacti
 *      >= 260px, foreground >= 220px, far ridge >= 55px total between scroll
 *      0% and 80% (~80% of the frozen D3 travels 520/440/140, minus
 *      tolerance) — and movement is monotonic across 0 / 40 / 80%.
 *   c2. Screenshots at scroll 0 / 40 / 80% (testInfo.outputPath): image bytes
 *      differ pairwise and a sampled pixel diff over the backdrop region is
 *      clearly non-zero (in-browser OffscreenCanvas — no new dependencies).
 *   d. prefers-reduced-motion: reduce → completely static landscape.
 *   e. 360x640: no horizontal overflow, cacti attached, copy legible.
 *
 * The old architecture (backdrop inside the hero, first-viewport progress,
 * travels <= 140px) must FAIL this suite; do not weaken thresholds to go green.
 */

/** Frozen perceptibility thresholds (D3 minus ~20% scroll tolerance). */
const MIN_TOTAL_TRAVEL = { cacti: 260, foreground: 220, far: 55 } as const;

const LAYERS = ["far", "foreground", "cacti"] as const;
type LayerName = (typeof LAYERS)[number];

const DESERT = ".twaz-desert";
const layerOf = (name: LayerName) => `${DESERT} [data-desert-layer="${name}"]`;

const STOPS = [
  { fraction: 0, label: "0" },
  { fraction: 0.4, label: "40" },
  { fraction: 0.8, label: "80" },
] as const;

/** Auto-retrying layout check — same approach as tests/e2e/landing.spec.ts. */
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

/** Jump to `fraction` of the document scroll range and let two frames settle. */
async function scrollToFraction(page: Page, fraction: number): Promise<number> {
  const target = await page.evaluate((f) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.round(max * f);
  }, fraction);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), target);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.evaluate(() => window.scrollY);
}

/** translateY (px) of a named desert layer's computed transform matrix. */
async function layerTranslateY(page: Page, name: LayerName): Promise<number> {
  return page.evaluate((layerName) => {
    const node = document.querySelector(`[data-desert-layer="${layerName}"]`);
    if (!node) return Number.NaN;
    const matrix = window.getComputedStyle(node).transform;
    if (!matrix || matrix === "none") return 0;
    const match = matrix.match(/matrix\((.+)\)/);
    if (!match) return 0;
    const values = match[1].split(",").map((v) => Number.parseFloat(v.trim()));
    return values.length >= 6 ? values[5] : 0;
  }, name);
}

const travel = (from: number, to: number) => Math.abs(to - from);

type PixelDiff = { samples: number; differing: number; error: string | null };

/**
 * Decode two PNG buffers in the browser (Blob → createImageBitmap →
 * OffscreenCanvas → getImageData) and count differing pixels on a grid sample.
 * Uses only platform APIs — no new dependencies.
 */
async function pngPixelDiff(
  page: Page,
  a: Buffer,
  b: Buffer,
): Promise<PixelDiff> {
  return (await page.evaluate(
    async ({ a64, b64 }): Promise<PixelDiff> => {
      const decode = async (b64: string): Promise<ImageData> => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      try {
        const [ia, ib] = [await decode(a64), await decode(b64)];
        if (ia.width !== ib.width || ia.height !== ib.height) {
          return { samples: 0, differing: 0, error: "size-mismatch" };
        }
        const step = Math.max(8, Math.floor(Math.min(ia.width, ia.height) / 40));
        let samples = 0;
        let differing = 0;
        for (let y = 0; y < ia.height; y += step) {
          for (let x = 0; x < ia.width; x += step) {
            samples += 1;
            const i = (y * ia.width + x) * 4;
            const delta = Math.max(
              Math.abs(ia.data[i] - ib.data[i]),
              Math.abs(ia.data[i + 1] - ib.data[i + 1]),
              Math.abs(ia.data[i + 2] - ib.data[i + 2]),
            );
            if (delta >= 8) differing += 1;
          }
        }
        return { samples, differing, error: null };
      } catch (error) {
        return { samples: 0, differing: 0, error: String(error) };
      }
    },
    { a64: a.toString("base64"), b64: b.toString("base64") },
  )) as PixelDiff;
}

/** Load the landing page and wait for content + backdrop to be rendered. */
async function openLanding(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(DESERT)).toBeAttached();
}

test.describe("Visual parallax — fixed desert backdrop (docs/PARALLAX-DECISIONS.md D1/D3/D4/D7)", () => {
  test("a. backdrop is fixed, full-viewport, behind content, attached past the hero", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLanding(page);

    // Frozen D1 computed style on the backdrop root.
    const style = await page.locator(DESERT).first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        position: s.position,
        top: s.top,
        left: s.left,
        right: s.right,
        bottom: s.bottom,
        zIndex: s.zIndex,
        pointerEvents: s.pointerEvents,
      };
    });
    expect(style.position, "D1: backdrop must be position fixed").toBe("fixed");
    expect(style.top, "D1: backdrop inset top").toBe("0px");
    expect(style.left, "D1: backdrop inset left").toBe("0px");
    expect(style.right, "D1: backdrop inset right").toBe("0px");
    expect(style.bottom, "D1: backdrop inset bottom").toBe("0px");
    expect(style.zIndex, "D1: backdrop z-index").toBe("0");
    expect(style.pointerEvents, "D1: backdrop must not intercept input").toBe("none");

    // Still attached — and still fixed — after scrolling 80% of the document.
    await scrollToFraction(page, 0.8);
    await expect(page.locator(DESERT)).toBeAttached();
    const styleDeep = await page
      .locator(DESERT)
      .first()
      .evaluate((el) => window.getComputedStyle(el).position);
    expect(styleDeep, "backdrop must stay fixed at 80% scroll").toBe("fixed");

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const box = await page.locator(DESERT).first().boundingBox();
    expect(box, "backdrop must be laid out at 80% scroll").not.toBeNull();
    expect(
      Math.abs(box!.y),
      `backdrop top must stay ~0 while the page scrolls (measured ${box!.y})`,
    ).toBeLessThanOrEqual(2);
    expect(box!.height, "backdrop must still cover the viewport").toBeGreaterThanOrEqual(
      viewportHeight * 0.9,
    );

    // D1's other half: the page content wrapper stacks ABOVE the backdrop.
    const contentZ = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return { found: false, zIndex: "" };
      let node: HTMLElement | null = main;
      while (node) {
        const s = window.getComputedStyle(node);
        if (s.position !== "static" && s.zIndex !== "auto") {
          return { found: true, zIndex: s.zIndex };
        }
        node = node.parentElement;
      }
      return { found: false, zIndex: "" };
    });
    expect(contentZ.found, "main content must have a positioned stacking wrapper").toBe(true);
    expect(
      Number(contentZ.zIndex),
      `content wrapper z-index (${contentZ.zIndex}) must stack above the backdrop (0)`,
    ).toBeGreaterThanOrEqual(1);

    expect(errors, "no uncaught page errors").toEqual([]);
  });

  test("b. elementFromPoint over page content resolves to content, not the desert scene", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLanding(page);
    await scrollToFraction(page, 0.8);

    // Sample a section heading on screen at 80% scroll (fallback: viewport
    // centre). The hit target must never be the desert scene/terrain.
    const probe = await page.evaluate(() => {
      const vh = window.innerHeight;
      let point: { x: number; y: number; label: string } | null = null;
      for (const heading of [...document.querySelectorAll("main h2, main h3")]) {
        const r = heading.getBoundingClientRect();
        if (r.width > 0 && r.top < vh * 0.75 && r.bottom > vh * 0.25) {
          point = {
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + Math.min(r.height / 2, 12)),
            label: `heading "${(heading.textContent || "").trim().slice(0, 60)}"`,
          };
          break;
        }
      }
      if (!point) point = { x: Math.round(window.innerWidth / 2), y: Math.round(vh / 2), label: "viewport centre" };
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        label: point.label,
        point,
        hitTag: hit ? hit.tagName.toLowerCase() : null,
        inBackdrop: hit ? Boolean(hit.closest(".twaz-desert")) : false,
        attached: Boolean(hit && hit.isConnected),
      };
    });

    expect(probe.hitTag, `hit target over ${probe.label} must exist`).not.toBeNull();
    expect(
      probe.inBackdrop,
      `elementFromPoint at ${JSON.stringify(probe.point)} (${probe.label}) must resolve to page content, not the desert scene`,
    ).toBe(false);
    expect(probe.attached, "hit target must be an attached DOM node").toBe(true);

    expect(errors, "no uncaught page errors").toEqual([]);
  });

  test("c. terrain layers travel substantially across the whole document (cacti>=260, foreground>=220, far>=55)", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLanding(page);

    const readings: Array<{
      label: string;
      scrollY: number;
      progress: string;
      y: Record<LayerName, number>;
      screenshot: string;
    }> = [];

    for (const stop of STOPS) {
      const scrollY = await scrollToFraction(page, stop.fraction);
      const y = { far: 0, foreground: 0, cacti: 0 } as Record<LayerName, number>;
      for (const layer of LAYERS) y[layer] = await layerTranslateY(page, layer);
      const progress = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--progress"),
      );
      const screenshot = testInfo.outputPath(`scroll-${stop.label}.png`);
      await page.screenshot({ path: screenshot });
      readings.push({ label: stop.label, scrollY, progress, y, screenshot });
    }

    await writeFile(
      testInfo.outputPath("measurements.json"),
      JSON.stringify(readings, null, 2),
    );

    // The page must actually be scrollable to the 80% stop.
    expect(readings[2].scrollY, "document must scroll well past the hero").toBeGreaterThan(400);

    for (const layer of LAYERS) {
      const [at0, at40, at80] = readings.map((r) => r.y[layer]);
      // Monotonic movement across 0 → 40% → 80%.
      expect(
        Math.abs(at40),
        `${layer}: |translateY| must grow from 0% to 40% scroll (${at0} → ${at40})`,
      ).toBeGreaterThan(Math.abs(at0));
      expect(
        Math.abs(at80),
        `${layer}: |translateY| must keep growing from 40% to 80% scroll (${at40} → ${at80})`,
      ).toBeGreaterThan(Math.abs(at40));
      // Substantial total travel — perceptible, not the old <= 140px nudge.
      const total = travel(at0, at80);
      expect(
        total,
        `${layer}: total travel between 0% and 80% scroll must be >= ${MIN_TOTAL_TRAVEL[layer]}px (measured ${total}px)`,
      ).toBeGreaterThanOrEqual(MIN_TOTAL_TRAVEL[layer]);
    }

    // D4: progress tracks the whole document, not the first viewport.
    const progressAt80 = Number(readings[2].progress);
    expect(
      progressAt80,
      "--progress at 80% document scroll must reflect the whole-document range",
    ).toBeGreaterThan(0.5);

    expect(errors, "no uncaught page errors").toEqual([]);
  });

  test("c2. screenshots at 0/40/80%: bytes differ and sampled pixels visibly differ", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLanding(page);

    const shots: Array<{ label: string; buffer: Buffer; file: string }> = [];

    for (const stop of STOPS) {
      await scrollToFraction(page, stop.fraction);

      // Clip to the backdrop region (viewport-relative bounding box) so the
      // diff samples the terrain area. The backdrop must be visible in the
      // viewport at every stop — the old hero-scoped backdrop is not.
      const viewport = await page.viewportSize();
      const box = await page.locator(DESERT).first().boundingBox();
      expect(
        box,
        `desert backdrop must be visible in the viewport at ${stop.label}% scroll (terrain is a fixed background)`,
      ).not.toBeNull();
      const x = Math.max(0, box!.x);
      const y = Math.max(0, box!.y);
      const width = Math.min(box!.x + box!.width, viewport!.width) - x;
      const height = Math.min(box!.y + box!.height, viewport!.height) - y;
      expect(width, "backdrop must have visible width at this stop").toBeGreaterThan(10);
      expect(height, "backdrop must have visible height at this stop").toBeGreaterThan(10);

      const file = testInfo.outputPath(`terrain-${stop.label}.png`);
      const buffer = (await page.screenshot({
        path: file,
        clip: { x, y, width, height },
      })) as Buffer;
      shots.push({ label: stop.label, buffer, file });
    }

    const [at0, at40, at80] = shots;

    // Bytes differ pairwise — no identical frames across stops.
    expect(at0.buffer.equals(at40.buffer), "scroll 0 vs 40% screenshots must differ").toBe(false);
    expect(at40.buffer.equals(at80.buffer), "scroll 40% vs 80% screenshots must differ").toBe(false);
    expect(at0.buffer.equals(at80.buffer), "scroll 0 vs 80% screenshots must differ").toBe(false);

    // Sampled pixel diff over the same backdrop region.
    const [diff40, diff80] = [await pngPixelDiff(page, at0.buffer, at40.buffer), await pngPixelDiff(page, at0.buffer, at80.buffer)];
    expect(diff40.error, `pixel diff 0 vs 40% decode: ${diff40.error}`).toBeNull();
    expect(diff80.error, `pixel diff 0 vs 80% decode: ${diff80.error}`).toBeNull();
    expect(
      diff40.differing / diff40.samples,
      `0 vs 40%: ${diff40.differing}/${diff40.samples} sampled pixels differ — terrain region must visibly move`,
    ).toBeGreaterThan(0.01);
    expect(
      diff80.differing / diff80.samples,
      `0 vs 80%: ${diff80.differing}/${diff80.samples} sampled pixels differ — terrain region must visibly move`,
    ).toBeGreaterThan(0.02);

    await writeFile(
      testInfo.outputPath("pixel-diff.json"),
      JSON.stringify({ at40: diff40, at80: diff80 }, null, 2),
    );
  });

  test.describe("d. prefers-reduced-motion: reduce", () => {
    test.use({ reducedMotion: "reduce" });

    test("landscape is completely static while the page scrolls", async ({ page }, testInfo) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await openLanding(page);

      const seen: Array<Record<LayerName, number>> = [];
      for (const stop of STOPS) {
        await scrollToFraction(page, stop.fraction);
        const y = { far: 0, foreground: 0, cacti: 0 } as Record<LayerName, number>;
        for (const layer of LAYERS) y[layer] = await layerTranslateY(page, layer);
        seen.push(y);
      }

      for (const layer of LAYERS) {
        const [at0, , at80] = seen.map((s) => s[layer]);
        expect(
          travel(at0, at80),
          `${layer} must not move under prefers-reduced-motion: reduce (moved ${travel(at0, at80)}px)`,
        ).toBe(0);
      }

      // No scroll-linked custom property may be written at all (D4).
      expect(
        await page.evaluate(() => document.documentElement.style.getPropertyValue("--progress")),
        "--progress must stay unwritten under reduced motion",
      ).toBe("");
      expect(
        await page.evaluate(() => document.documentElement.style.getPropertyValue("--scroll-y")),
        "--scroll-y must stay unwritten under reduced motion",
      ).toBe("");

      await page.screenshot({ path: testInfo.outputPath("reduced-motion.png") });
      expect(errors, "no uncaught page errors").toEqual([]);
    });
  });

  test.describe("e. mobile 360x640", () => {
    test.use({ viewport: { width: 360, height: 640 } });

    test("no horizontal overflow, cacti attached, copy legible", async ({ page }, testInfo) => {
      const errors = collectErrors(page);
      await openLanding(page);

      await expect(page.locator(layerOf("cacti"))).toBeAttached();

      // Copy must be legible: visible, on-screen horizontally, readable size.
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      const h1Box = await h1.boundingBox();
      expect(h1Box, "h1 must be laid out").not.toBeNull();
      expect(h1Box!.x, "h1 must start inside the 360px viewport").toBeGreaterThanOrEqual(0);
      expect(
        h1Box!.x + h1Box!.width,
        "h1 must not extend past the 360px viewport",
      ).toBeLessThanOrEqual(361);
      const h1Font = await h1.evaluate((el) => Number.parseFloat(window.getComputedStyle(el).fontSize));
      expect(h1Font, "h1 font size must stay legible on mobile").toBeGreaterThanOrEqual(16);

      await expectNoOverflow(page, "landing at 360px, scroll 0");
      await scrollToFraction(page, 0.8);
      await expectNoOverflow(page, "landing at 360px, scroll 80%");
      await expect(page.locator(layerOf("cacti"))).toBeAttached();

      await page.screenshot({ path: testInfo.outputPath("mobile-360.png") });
      expect(errors, "no uncaught page errors").toEqual([]);
    });
  });
});
