"use client";

import { DesertBackdrop } from "./DesertBackdrop";

/**
 * Scoped styles for the landing-page parallax host. The fixed landscape is
 * mounted once by this component; these overrides keep the published sections
 * readable while letting the terrain show faintly through neutral surfaces.
 * Kept here (not in globals.css) because globals.css is controller-owned.
 */
const PARALLAX_HOST_STYLES = `
.twaz-parallax-host [data-theme] {
  background-color: transparent !important;
}
.twaz-parallax-host section.bg-\\[\\#F8F3EE\\],
.twaz-parallax-host section.bg-\\[\\#EFE4DD\\] {
  background-color: rgba(248, 243, 238, 0.88) !important;
}
`;

/**
 * One global, fixed full-viewport desert landscape plus the scoping styles
 * that let page content sit above it. Mounted first inside <main> so the
 * terrain is present even while SiteLoading is showing.
 */
export function SiteBackdropMount() {
  return (
    <>
      <style>{PARALLAX_HOST_STYLES}</style>
      <DesertBackdrop />
    </>
  );
}

export default SiteBackdropMount;
