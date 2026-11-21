import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteRenderer } from "./SiteRenderer";
import { getDefaultSiteContent } from "./content";

describe("SiteRenderer accessibility / mobile", () => {
  it("gives inline SVG defs unique ids when the renderer appears more than once", () => {
    const site = getDefaultSiteContent();
    // Two renderers in one tree is a real case: staff content editor shows a
    // draft preview next to the published preview (and admin can nest both).
    const html = renderToStaticMarkup(
      <>
        <SiteRenderer document={site.document} />
        <SiteRenderer document={site.document} />
      </>,
    );

    const clipIds = [...html.matchAll(/id="([^"]*arch-clip[^"]*)"/g)].map((m) => m[1]!);
    const skyIds = [...html.matchAll(/id="([^"]*sky[^"]*)"/g)].map((m) => m[1]!);

    expect(clipIds).toHaveLength(2);
    expect(skyIds).toHaveLength(2);
    // Duplicate ids are invalid HTML and make url(#...) references ambiguous.
    expect(new Set(clipIds).size).toBe(2);
    expect(new Set(skyIds).size).toBe(2);

    // Every url(#...) reference must point at a defined, unique id.
    const refs = [...html.matchAll(/url\(#([^)]*)\)/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect([...clipIds, ...skyIds]).toContain(ref);
    }
    expect(new Set(refs).size).toBe(refs.length);
  });
});
