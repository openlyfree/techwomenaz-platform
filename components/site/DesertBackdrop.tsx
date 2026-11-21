"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { useScrollProgress } from "./useScrollProgress";
import "./desert-backdrop.css";

export interface DesertBackdropProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Maximum upward travel, in px, for each stacked layer over the whole document
 * scroll. Single source of truth: mirrored as fallbacks in desert-backdrop.css.
 * Sky/sun move least; foreground/cacti travel most.
 */
export const DESERT_LAYER_TRAVEL = {
  frame: 0,
  sky: 20,
  sun: 45,
  far: 140,
  mid: 240,
  near: 340,
  foreground: 440,
  cacti: 520,
} as const;

/** Leftward horizontal drift, in px at full document scroll (D3). */
export const DESERT_LAYER_DRIFT = {
  frame: 0,
  sky: 0,
  sun: 0,
  far: 0,
  mid: 0,
  near: 0,
  foreground: 24,
  cacti: 36,
} as const;

export type DesertLayerName = keyof typeof DESERT_LAYER_TRAVEL;

// Exact path data, fills, gradient and cacti shapes from docs/LANDING-MISSION.md (FROZEN).
const ARCH_CLIP = "M10 465 V190 A170 170 0 0 1 350 190 V465 Z";
const ARCH_OUTLINE = "M2 470 V190 A178 178 0 0 1 358 190 V470";

const RIDGES: ReadonlyArray<{ name: DesertLayerName; fill: string; d: string }> = [
  {
    name: "far",
    fill: "#F6A766",
    d: "M0 300 C60 270 100 285 150 262 C200 240 250 275 300 258 C330 248 350 255 360 252 V470 H0Z",
  },
  {
    name: "mid",
    fill: "#F28A3E",
    d: "M0 338 C70 312 120 330 180 306 C240 284 300 320 360 300 V470 H0Z",
  },
  {
    name: "near",
    fill: "#F07828",
    d: "M0 382 C80 360 150 378 220 356 C280 338 330 360 360 352 V470 H0Z",
  },
  {
    name: "foreground",
    fill: "#D9611A",
    d: "M0 420 C90 404 180 422 260 406 C310 396 340 404 360 400 V470 H0Z",
  },
];

type LayerStyle = CSSProperties & {
  "--layer-travel": number;
  "--layer-drift": number;
};

interface LayerProps {
  name: DesertLayerName;
  clipId: string;
  children: ReactNode;
}

function layerStyle(name: DesertLayerName): LayerStyle {
  return {
    "--layer-travel": DESERT_LAYER_TRAVEL[name],
    "--layer-drift": DESERT_LAYER_DRIFT[name],
  };
}

/** A single, full-bleed parallax SVG layer (except `frame`, which holds the defs). */
function Layer({ name, clipId, children }: LayerProps) {
  return (
    <svg
      className={`twaz-desert__layer twaz-desert__layer--${name}`}
      data-desert-layer={name}
      viewBox="0 0 360 470"
      preserveAspectRatio="none"
      focusable="false"
      style={layerStyle(name)}
    >
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </svg>
  );
}

/**
 * Fixed, full-viewport TechWomenAZ desert landscape. Scene-only render: no
 * content wrapper, so page content stacks above via `relative z-[1]`.
 * Parallax is driven entirely by `useScrollProgress()` writing `--progress` to
 * the document root; this component never re-renders on scroll.
 */
export function DesertBackdrop({ className }: DesertBackdropProps) {
  useScrollProgress();

  // Unique per-instance ids keep the clipped layers valid if the backdrop is
  // rendered more than once.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `twaz-arch-${uid}`;
  const skyId = `twaz-sky-${uid}`;

  return (
    <div className={className ? `twaz-desert ${className}` : "twaz-desert"} aria-hidden="true">
      <div className="twaz-desert__scene">
        {/* Static frame + shared definitions (no travel). */}
        <svg
          className="twaz-desert__layer twaz-desert__layer--frame"
          data-desert-layer="frame"
          viewBox="0 0 360 470"
          preserveAspectRatio="none"
          focusable="false"
          style={layerStyle("frame")}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={ARCH_CLIP} />
            </clipPath>
            <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FCE9D8" />
              <stop offset=".55" stopColor="#F9CFA6" />
              <stop offset="1" stopColor="#F5AE72" />
            </linearGradient>
          </defs>
          <path
            d={ARCH_OUTLINE}
            fill="none"
            stroke="#F07828"
            strokeWidth="1.4"
            opacity=".7"
          />
        </svg>

        <Layer name="sky" clipId={clipId}>
          <rect width="360" height="470" fill={`url(#${skyId})`} />
        </Layer>

        <Layer name="sun" clipId={clipId}>
          <circle cx="180" cy="250" r="78" fill="#FBEBDD" opacity=".9" />
        </Layer>

        {RIDGES.map((ridge) => (
          <Layer key={ridge.name} name={ridge.name} clipId={clipId}>
            <path d={ridge.d} fill={ridge.fill} />
          </Layer>
        ))}

        <Layer name="cacti" clipId={clipId}>
          <g fill="#22395A">
            <rect x="232" y="232" width="20" height="210" rx="10" />
            <path d="M232 340 h-22 a10 10 0 0 1 -10 -10 v-46 a10 10 0 0 1 20 0 v36 h12Z" />
            <path d="M252 312 h22 a10 10 0 0 0 10 -10 v-52 a10 10 0 0 0 -20 0 v42 h-12Z" />
            <rect x="105" y="296" width="15" height="150" rx="7.5" />
            <path d="M105 372 h-15 a7.5 7.5 0 0 1 -7.5 -7.5 v-32 a7.5 7.5 0 0 1 15 0 v25 h7.5Z" />
            <path d="M120 352 h15 a7.5 7.5 0 0 0 7.5 -7.5 v-28 a7.5 7.5 0 0 0 -15 0 v21 h-7.5Z" />
          </g>
        </Layer>
      </div>
    </div>
  );
}

export default DesertBackdrop;
