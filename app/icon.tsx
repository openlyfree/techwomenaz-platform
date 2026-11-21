// Desert-arch favicon in the TechWomenAZ palette. Served from the app root so
// no binary asset is required.
export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#F8F3EE"/>
  <path d="M5 27 V17 a11 11 0 0 1 22 0 V27" fill="none" stroke="#DE6219" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 27 V19 a6 6 0 0 1 12 0 V27" fill="none" stroke="#22395A" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
