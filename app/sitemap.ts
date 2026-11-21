import type { MetadataRoute } from "next";

const APP_ORIGIN = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

const PUBLIC_PATHS = ["/", "/about", "/events", "/mentorship", "/contact", "/join", "/login"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${APP_ORIGIN}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
