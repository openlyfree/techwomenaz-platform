import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// vinext resolves `next/*` at build time; the plain vitest config does not, so
// provide a minimal anchor stub for static rendering of Link-based pages.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import NotFound from "../../app/not-found";
import GlobalError from "../../app/global-error";
import Loading from "../../app/loading";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";

const ORIGIN = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

describe("shell pages", () => {
  describe("not-found", () => {
    const html = renderToStaticMarkup(React.createElement(NotFound));

    it("shows a clear, dignified Page not found heading", () => {
      expect(html).toContain("Page not found");
    });

    it("offers recovery links to home, about, events and join", () => {
      for (const href of ["/", "/about", "/events", "/join"]) {
        expect(html).toContain(`href="${href}"`);
      }
    });

    it("renders exactly one h1", () => {
      expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    });
  });

  describe("global-error", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(GlobalError, { error: new Error("SECRET_STACK_TRACE_9f3a"), reset }),
    );

    it("shows a friendly recovery message", () => {
      expect(html.toLowerCase()).toContain("something went wrong");
    });

    it("never leaks the raw error message or stack details", () => {
      expect(html).not.toContain("SECRET_STACK_TRACE_9f3a");
      expect(html).not.toContain("Error:");
    });

    it("offers a Try again control and a link home", () => {
      expect(html).toContain("Try again");
      expect(html).toContain('href="/"');
    });
  });

  describe("loading", () => {
    const html = renderToStaticMarkup(React.createElement(Loading));

    it("renders an accessible status region", () => {
      expect(html).toContain('role="status"');
    });

    it("uses the shared Loading styles", () => {
      expect(html).toContain("loading-state");
    });
  });
});

describe("metadata routes", () => {
  describe("robots", () => {
    const rule = robots().rules;
    const policy = Array.isArray(rule) ? rule[0] : rule;
    const toList = (value: string | string[] | undefined) =>
      value === undefined ? [] : Array.isArray(value) ? value : [value];

    it("disallows the private admin, portal and API paths", () => {
      expect(toList(policy.disallow)).toEqual(expect.arrayContaining(["/admin", "/portal", "/api"]));
    });

    it("does not blanket-disallow the whole site", () => {
      expect(toList(policy.disallow)).not.toContain("/");
    });

    it("allows the public paths", () => {
      expect(toList(policy.allow)).toEqual(
        expect.arrayContaining(["/about", "/events", "/mentorship", "/contact", "/join", "/login"]),
      );
    });

    it("advertises the sitemap using APP_ORIGIN with a localhost fallback", () => {
      expect(robots().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    });
  });

  describe("sitemap", () => {
    it("lists every public route", () => {
      const paths = sitemap().map((entry) => new URL(entry.url).pathname);
      expect(paths).toEqual(
        expect.arrayContaining(["/", "/about", "/events", "/mentorship", "/contact", "/join", "/login"]),
      );
    });

    it("sets a lastModified date on every entry", () => {
      for (const entry of sitemap()) {
        expect(entry.lastModified).toBeInstanceOf(Date);
      }
    });
  });
});

describe("icon.svg", () => {
  it("is a desert-palette TW monogram served from the app root", () => {
    const svg = readFileSync(resolve(process.cwd(), "app/icon.svg"), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("TW");
    expect(svg.toLowerCase()).toContain("#c46a2b");
    expect(svg.toLowerCase()).toContain("#2e4057");
  });
});
