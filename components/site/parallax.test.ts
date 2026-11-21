import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the frozen scroll-hook contract (docs/PARALLAX-DECISIONS.md
 * D4, per docs/PARALLAX-FIX-MISSION.md):
 *
 *   useScrollProgress(): { scrollY: number; progress: number }
 *   - passive scroll listener + requestAnimationFrame
 *   - progress spans the WHOLE document:
 *       range = documentElement.scrollHeight - window.innerHeight
 *     (mock document: scrollHeight 2400, innerHeight 800 -> range 1600) —
 *     not just the first viewport, so the terrain keeps moving on every screen
 *   - per-frame values are written to CSS custom properties (`--scroll-y`,
 *     `--progress`) on the document root — never to React state, so scrolling
 *     must not re-render the tree
 *   - prefers-reduced-motion: reduce -> no listener, no rAF, no scroll-linked values
 *
 * Runs in the `node` environment declared by components/site/vitest.config.ts:
 * the hook is exercised directly against a mocked window/document/rAF, and
 * React's useEffect/useRef are replaced by a minimal synchronous harness. Any
 * attempt to introduce per-frame state (useState/useReducer) would throw
 * React's "Invalid hook call" against the real (unmocked) React and fail the
 * suite — the mock architecture itself enforces the no-state contract.
 */

// Minimal React runtime swap, shared with the vi.mock factory below.
const reactMock = vi.hoisted(() => ({
  runtime: null as null | {
    takeRef: (initial: unknown) => { current: unknown };
    queueEffect: (fn: () => void | (() => void)) => void;
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRef: (initial: unknown) =>
      reactMock.runtime ? reactMock.runtime.takeRef(initial) : { current: initial },
    useEffect: (fn: () => void | (() => void)) => {
      if (reactMock.runtime) reactMock.runtime.queueEffect(fn);
    },
  };
});

// Non-literal dynamic import specifier (per lead): keeps `npm run typecheck`
// decoupled from the module's arrival; vite resolves it at test runtime.
type HookModule = typeof import("./useScrollProgress");
const HOOK_MODULE_PATH = "./useScroll" + "Progress";
let mod!: HookModule;
beforeAll(async () => {
  mod = (await import(HOOK_MODULE_PATH)) as HookModule;
});

/* ------------------------------------------------------------------ */
/* Mocked scroll / rAF environment                                     */
/* ------------------------------------------------------------------ */

interface ListenerRecord {
  fn: (event?: unknown) => void;
  options?: AddEventListenerOptions | boolean;
}

function installEnv(options: { reduced?: boolean } = {}) {
  const listeners = new Map<string, Set<ListenerRecord>>();
  const removed = new Array<{ type: string; fn: (event?: unknown) => void }>();
  const written = new Array<{ property: string; value: string }>();
  const removedProperties = new Array<string>();
  const rafQueue = new Array<{ id: number; cb: (time: number) => void }>();
  const counts = { rafScheduled: 0 };
  let rafId = 0;
  const mediaListeners = new Array<(event: { matches: boolean }) => void>();

  const windowLike = {
    scrollY: 0,
    pageYOffset: 0,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(type: string, fn: (event?: unknown) => void, opts?: AddEventListenerOptions | boolean) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add({ fn, options: opts });
    },
    removeEventListener(type: string, fn: (event?: unknown) => void) {
      removed.push({ type, fn });
      const set = listeners.get(type);
      if (!set) return;
      for (const record of [...set]) if (record.fn === fn) set.delete(record);
    },
    requestAnimationFrame(cb: (time: number) => void) {
      counts.rafScheduled += 1;
      const id = (rafId += 1);
      rafQueue.push({ id, cb });
      return id;
    },
    cancelAnimationFrame(id: number) {
      const index = rafQueue.findIndex((entry) => entry.id === id);
      if (index >= 0) rafQueue.splice(index, 1);
    },
    matchMedia(query: string) {
      const list = {
        matches: Boolean(options.reduced) && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener(_type: string, cb: (event: { matches: boolean }) => void) {
          mediaListeners.push(cb);
        },
        removeEventListener(_type: string, cb: (event: { matches: boolean }) => void) {
          const index = mediaListeners.indexOf(cb);
          if (index >= 0) mediaListeners.splice(index, 1);
        },
        addListener(cb: (event: { matches: boolean }) => void) {
          mediaListeners.push(cb);
        },
        removeListener(cb: (event: { matches: boolean }) => void) {
          const index = mediaListeners.indexOf(cb);
          if (index >= 0) mediaListeners.splice(index, 1);
        },
        dispatchEvent: () => false,
        onchange: null,
      };
      return list;
    },
  };

  const rootStyle = {
    setProperty(property: string, value: string) {
      written.push({ property, value });
    },
    removeProperty(property: string) {
      removedProperties.push(property);
    },
  };
  const documentLike = {
    documentElement: { style: rootStyle, scrollHeight: 2400, clientHeight: 800 },
    body: { scrollHeight: 2400 },
  };

  Object.assign(globalThis, {
    window: windowLike,
    document: documentLike,
    requestAnimationFrame: windowLike.requestAnimationFrame,
    cancelAnimationFrame: windowLike.cancelAnimationFrame,
    matchMedia: windowLike.matchMedia,
  });

  return {
    listeners,
    removed,
    written,
    removedProperties,
    counts,
    /** Simulate a scroll event after moving the viewport to `y` px. */
    scroll(y: number) {
      windowLike.scrollY = y;
      windowLike.pageYOffset = y;
      for (const record of [...(listeners.get("scroll") ?? [])]) record.fn({ type: "scroll" });
    },
    /** Run (and clear) everything queued on requestAnimationFrame. */
    flushRaf() {
      const queued = rafQueue.splice(0);
      for (const entry of queued) entry.cb(16);
    },
    /** Fire the matchMedia "change" listeners (reduced-motion toggling). */
    emitMotionPreference(matches: boolean) {
      for (const cb of [...mediaListeners]) cb({ matches });
    },
  };
}

type ScrollEnv = ReturnType<typeof installEnv>;
let env!: ScrollEnv;

function clearInjectedGlobals() {
  const globals = globalThis as Record<string, unknown>;
  delete globals.window;
  delete globals.document;
  delete globals.requestAnimationFrame;
  delete globals.cancelAnimationFrame;
  delete globals.matchMedia;
}

/** Mount the hook once with a synchronous useEffect/useRef harness. */
function mountHook<T>(hookFn: () => T) {
  const refs = new Array<{ current: unknown }>();
  const cleanups = new Array<() => void>();
  const pendingEffects = new Array<() => void | (() => void)>();
  const stats = { effectRuns: 0 };
  let cursor = 0;

  reactMock.runtime = {
    takeRef(initial) {
      const slot = cursor++;
      if (!refs[slot]) refs[slot] = { current: initial };
      return refs[slot] as { current: unknown };
    },
    queueEffect(fn) {
      pendingEffects.push(fn);
    },
  };

  const run = () => {
    cursor = 0;
    pendingEffects.length = 0;
    const result = hookFn();
    const queued = pendingEffects.splice(0);
    stats.effectRuns += queued.length;
    for (const effect of queued) {
      const cleanup = effect();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
    return result;
  };

  const result = run();
  return {
    result,
    effectRuns: () => stats.effectRuns,
    unmount() {
      for (const cleanup of cleanups.reverse()) cleanup();
      cleanups.length = 0;
    },
  };
}

beforeEach(() => {
  env = installEnv();
});

afterEach(() => {
  reactMock.runtime = null;
  clearInjectedGlobals();
});

function lastWrite(name: string): string | undefined {
  for (let i = env.written.length - 1; i >= 0; i -= 1) {
    if (env.written[i].property === name) return env.written[i].value;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Pure scroll math (exported for exactly this purpose)                */
/* ------------------------------------------------------------------ */

/**
 * The mock document spans 2400px with an 800px viewport, so the frozen
 * whole-document scroll range (D4) is 2400 - 800 = 1600px.
 */
const DOCUMENT_RANGE = 1600;

describe("useScrollProgress math", () => {
  it("clamp01 pins values to [0, 1] and treats non-finite input as 0", () => {
    expect(mod.clamp01(-1)).toBe(0);
    expect(mod.clamp01(0)).toBe(0);
    expect(mod.clamp01(0.42)).toBe(0.42);
    expect(mod.clamp01(1)).toBe(1);
    expect(mod.clamp01(7)).toBe(1);
    expect(mod.clamp01(Number.NaN)).toBe(0);
    // Frozen contract: any non-finite input (including ±Infinity) maps to 0.
    expect(mod.clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(mod.clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("computeProgress normalizes scrollY over the whole-document scroll range (D4)", () => {
    expect(mod.computeProgress(0, DOCUMENT_RANGE)).toBe(0);
    expect(mod.computeProgress(400, DOCUMENT_RANGE)).toBe(0.25);
    expect(mod.computeProgress(600, DOCUMENT_RANGE)).toBe(0.375);
    expect(mod.computeProgress(800, DOCUMENT_RANGE)).toBe(0.5);
    expect(mod.computeProgress(1600, DOCUMENT_RANGE)).toBe(1);
    expect(mod.computeProgress(4000, DOCUMENT_RANGE)).toBe(1);
    expect(mod.computeProgress(100, 0)).toBe(0);
    expect(mod.computeProgress(100, -5)).toBe(0);
    expect(mod.computeProgress(Number.NaN, DOCUMENT_RANGE)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Runtime contract against a mocked scroll/rAF environment            */
/* ------------------------------------------------------------------ */

describe("useScrollProgress runtime contract", () => {
  it("returns a live { scrollY, progress } snapshot measured over the whole document (D4)", () => {
    const runtime = mountHook(() => mod.useScrollProgress());
    env.flushRaf(); // settle the mount-time sample

    expect(runtime.result).toEqual({ scrollY: 0, progress: 0 });

    env.scroll(600);
    env.flushRaf();
    expect(runtime.result.scrollY).toBe(600);
    // Whole-document range (mock: scrollHeight 2400 - innerHeight 800 = 1600),
    // NOT the first viewport.
    expect(runtime.result.progress).toBeCloseTo(0.375, 5);

    env.scroll(1600);
    env.flushRaf();
    expect(runtime.result.progress).toBe(1); // full document scrolled

    env.scroll(4000);
    env.flushRaf();
    expect(runtime.result.scrollY).toBe(4000);
    expect(runtime.result.progress).toBe(1); // clamped past the document end
  });

  it("registers exactly one passive scroll listener", () => {
    mountHook(() => mod.useScrollProgress());
    const scrollListeners = [...(env.listeners.get("scroll") ?? [])];

    expect(scrollListeners).toHaveLength(1);
    const options = scrollListeners[0].options;
    const passive = typeof options === "boolean" ? options : options?.passive;
    expect(passive, "scroll listener must be registered with { passive: true }").toBe(true);
  });

  it("writes --scroll-y/--progress per rAF frame and coalesces scroll bursts into one frame", () => {
    mountHook(() => mod.useScrollProgress());
    env.flushRaf(); // settle the mount-time sample

    const writesBefore = env.written.length;
    const rafBefore = env.counts.rafScheduled;

    for (let frame = 1; frame <= 10; frame += 1) {
      env.scroll(frame * 100);
      env.flushRaf();
    }

    // Exactly one rAF per scroll frame.
    expect(env.counts.rafScheduled - rafBefore).toBe(10);

    // One --scroll-y + one --progress write per frame, values tracking scroll.
    const recent = env.written.slice(writesBefore);
    expect(recent.filter((w) => w.property === "--scroll-y")).toHaveLength(10);
    expect(recent.filter((w) => w.property === "--progress")).toHaveLength(10);
    expect(lastWrite("--scroll-y")).toBe("1000px");
    // Whole-document range: 1000 / 1600 = 0.625 (D4).
    expect(Number(lastWrite("--progress"))).toBeCloseTo(0.625, 5);

    // Three scroll events inside one frame -> still a single scheduled rAF.
    const rafBeforeBurst = env.counts.rafScheduled;
    env.scroll(1100);
    env.scroll(1200);
    env.scroll(1300);
    expect(env.counts.rafScheduled - rafBeforeBurst).toBe(1);
    env.flushRaf();
    expect(lastWrite("--scroll-y")).toBe("1300px");
  });

  it("never re-renders on scroll: only CSS custom properties change per frame", () => {
    const runtime = mountHook(() => mod.useScrollProgress());
    env.flushRaf();

    const effectRunsAtStart = runtime.effectRuns();
    for (let frame = 1; frame <= 10; frame += 1) {
      env.scroll(frame * 100);
      env.flushRaf();
    }

    // Scrolling must not trigger any React effect re-run (a re-render would).
    expect(runtime.effectRuns()).toBe(effectRunsAtStart);

    // The only DOM writes are the two agreed custom properties on :root.
    const writtenProperties = [...new Set(env.written.map((w) => w.property))].sort();
    expect(writtenProperties).toEqual(["--progress", "--scroll-y"]);
  });

  it("prefers-reduced-motion: reduce — no listener, no rAF, no scroll-linked writes", () => {
    env = installEnv({ reduced: true });
    mountHook(() => mod.useScrollProgress());

    expect(env.listeners.get("scroll") ?? []).toHaveLength(0);

    const rafBefore = env.counts.rafScheduled;
    const writesBefore = env.written.length;
    env.scroll(600);
    env.flushRaf();
    env.scroll(1200);
    env.flushRaf();

    expect(env.counts.rafScheduled).toBe(rafBefore);
    expect(env.written.slice(writesBefore)).toHaveLength(0);
  });

  it("reacts to a reduced-motion change event: disables, then re-enables parallax", () => {
    mountHook(() => mod.useScrollProgress());
    env.flushRaf();

    env.scroll(600);
    env.flushRaf();
    expect(env.written.length).toBeGreaterThan(0);

    // Switch to reduce mid-session: listener detached, no further writes.
    env.emitMotionPreference(true);
    expect(env.listeners.get("scroll")?.size ?? 0).toBe(0);
    const writesAtDisable = env.written.length;
    env.scroll(900);
    env.flushRaf();
    expect(env.written.length).toBe(writesAtDisable);

    // Switch back: listener re-registered and updates resume.
    env.emitMotionPreference(false);
    expect(env.listeners.get("scroll")?.size).toBe(1);
    env.scroll(300);
    env.flushRaf();
    expect(lastWrite("--scroll-y")).toBe("300px");
  });

  it("removes its scroll listener and clears root properties on cleanup", () => {
    const runtime = mountHook(() => mod.useScrollProgress());
    env.flushRaf();
    env.scroll(200);
    env.flushRaf();

    runtime.unmount();

    expect(env.removed.some((r) => r.type === "scroll")).toBe(true);
    expect(env.removedProperties).toEqual(expect.arrayContaining(["--scroll-y", "--progress"]));
  });
});
