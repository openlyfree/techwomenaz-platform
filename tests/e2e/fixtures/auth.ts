import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

export interface SessionCookie {
  name: string;
  value: string;
  url: string;
}

/**
 * Reuse the local admin session produced by the dev seed/sign-in script.
 * Returns null when no session exists, so callers can skip gracefully.
 */
export function loadLocalAdminCookie(baseURL: string): SessionCookie | null {
  try {
    const dir = "/tmp/opencode";
    const files = readdirSync(dir)
      .filter((file) => file.startsWith("techwomenaz-local-session-") && file.endsWith(".json"))
      .sort();

    for (const file of files) {
      const data = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as {
        role?: string;
        cookie?: string;
        cookieName?: string;
      };

      if (data.role === "admin" && data.cookie && data.cookieName) {
        const token = data.cookie.split(";")[0]?.split("=").slice(1).join("=");
        if (token) return { name: data.cookieName, value: token, url: baseURL };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function addLocalAdminCookie(context: BrowserContext, baseURL: string): Promise<boolean> {
  const cookie = loadLocalAdminCookie(baseURL);
  if (!cookie) return false;
  await context.addCookies([cookie]);
  return true;
}
