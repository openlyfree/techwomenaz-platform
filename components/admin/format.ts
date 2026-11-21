/** Presentation helpers shared by staff dashboard pages. No React, no API. */

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

export function formatShortDate(iso: string, fallback = "—"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(iso: string, fallback = "—"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** SVG polyline points for a small signup sparkline, bounded to width x height. */
export function trendPoints(trend: { date: string; count: number }[], width: number, height: number): string {
  if (!trend.length) return "";
  const max = Math.max(1, ...trend.map((point) => Number.isFinite(point.count) ? point.count : 0));
  return trend
    .map((point, index) => {
      const x = trend.length === 1 ? 0 : (index / (trend.length - 1)) * width;
      const y = height - (Math.max(0, point.count) / max) * height;
      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(" ");
}

export function safePercent(part: number, total: number): number {
  if (!total || !Number.isFinite(total) || !Number.isFinite(part)) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

/** Safe, actionable text for API failures; never leaks raw objects or stacks. */
export function errorText(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Something went wrong. Please try again.";
}
