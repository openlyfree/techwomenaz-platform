"use client";

import { useEffect, useRef } from "react";

export interface ScrollProgress {
  scrollY: number;
  progress: number;
}

/** Clamp a raw value to the inclusive 0..1 range. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Normalise a scroll offset against the distance being scrolled. */
export function computeProgress(scrollY: number, scrollRange: number): number {
  if (!Number.isFinite(scrollRange) || scrollRange <= 0) return 0;
  return clamp01(scrollY / scrollRange);
}

const SCROLL_Y_VAR = "--scroll-y";
const PROGRESS_VAR = "--progress";

/**
 * Passive scroll + requestAnimationFrame progress reader for the fixed backdrop.
 *
 * Progress is measured across the WHOLE document — `scrollY / (scrollHeight -
 * innerHeight)` — so the terrain keeps travelling on every screen, not just the
 * first viewport. Values are written to CSS custom properties on the document
 * root (and to a stable snapshot object that is mutated in place). No React
 * state is set per frame, so scrolling never re-renders the tree; the GPU
 * transforms in desert-backdrop.css read `--progress` directly.
 */
export function useScrollProgress(): ScrollProgress {
  const snapshot = useRef<ScrollProgress>({ scrollY: 0, progress: 0 });

  useEffect(() => {
    const root = document.documentElement;
    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;

    const clear = () => {
      root.style.removeProperty(SCROLL_Y_VAR);
      root.style.removeProperty(PROGRESS_VAR);
      snapshot.current.scrollY = 0;
      snapshot.current.progress = 0;
    };

    // Reduced motion: no listener, no rAF, no scroll-linked properties at all.
    if (motionQuery?.matches) {
      clear();
      return;
    }

    let frame = 0;

    const sample = () => {
      frame = 0;
      const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
      // Document-wide range (D4): scrollHeight - innerHeight, guarded at >= 1px.
      const scrollHeight = document.documentElement.scrollHeight;
      const range = Math.max(1, scrollHeight - window.innerHeight);
      const progress = computeProgress(scrollY, range);

      snapshot.current.scrollY = scrollY;
      snapshot.current.progress = progress;
      root.style.setProperty(SCROLL_Y_VAR, `${scrollY}px`);
      root.style.setProperty(PROGRESS_VAR, progress.toFixed(4));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sample);
    };

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        window.removeEventListener("scroll", schedule);
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        clear();
      } else {
        window.addEventListener("scroll", schedule, { passive: true });
        schedule();
      }
    };

    window.addEventListener("scroll", schedule, { passive: true });
    motionQuery?.addEventListener?.("change", onMotionPreferenceChange);
    schedule();

    return () => {
      window.removeEventListener("scroll", schedule);
      motionQuery?.removeEventListener?.("change", onMotionPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty(SCROLL_Y_VAR);
      root.style.removeProperty(PROGRESS_VAR);
    };
  }, []);

  return snapshot.current;
}
