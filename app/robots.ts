import type { MetadataRoute } from "next";

// Keep the sitemap origin relative-safe: prefer the configured origin, fall
// back to a harmless localhost value until the demo is deployed officially.
const APP_ORIGIN = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

// Homepage "/" is allowed by default; listing a catch-all Allow would let
// first-match-wins crawlers ignore the private-path Disallow rules below.
const PUBLIC_PATHS = ["/about", "/events", "/mentorship", "/contact", "/join", "/login"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: PUBLIC_PATHS,
      disallow: ["/admin", "/portal", "/api"],
    },
    sitemap: `${APP_ORIGIN}/sitemap.xml`,
  };
}
