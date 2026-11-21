import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteRenderer } from "../../components/site/SiteRenderer";
import type { SiteDocument } from "../../lib/contracts";

describe("public renderer accessibility", () => {
  it("provides one primary heading when only a mission section is published", () => {
    const document: SiteDocument = {
      version: 1,
      theme: "desert",
      sections: [{ id: "mission-only", type: "mission", title: "Our mission", body: "A synthetic mission statement.", enabled: true }],
    };
    const html = renderToStaticMarkup(React.createElement(SiteRenderer, { document }));
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(html).toContain("Our mission");
  });
});
