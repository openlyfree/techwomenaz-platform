import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteRenderer } from "./SiteRenderer";
import { getDefaultSiteContent } from "./content";

describe("SiteRenderer", () => {
  it("renders published sections with sourced events, team, partners and past labels", () => {
    const site = getDefaultSiteContent();
    const html = renderToStaticMarkup(
      <SiteRenderer
        document={site.document}
        events={site.events}
        team={site.team}
        partners={site.partners}
      />,
    );
    expect(html).toContain("Empowering");
    expect(html).toContain("TWAZ Finance Series");
    expect(html).toContain("Past event");
    expect(html).toContain("Melissa Drake");
    expect(html).toContain("High Rock Accounting");
    expect(html).toContain("https://givebutter.com/VStKv8");
    expect(html).not.toContain("Hidden from public site");
  });

  it("keeps disabled sections out of public output but shows them in preview", () => {
    const site = getDefaultSiteContent();
    const document = {
      ...site.document,
      sections: site.document.sections.map((section) =>
        section.id === "team" ? { ...section, enabled: false } : section,
      ),
    };
    const publicHtml = renderToStaticMarkup(<SiteRenderer document={document} team={site.team} />);
    expect(publicHtml).not.toContain("Melissa Drake");

    const previewHtml = renderToStaticMarkup(
      <SiteRenderer document={document} team={site.team} preview />,
    );
    expect(previewHtml).toContain("Melissa Drake");
    expect(previewHtml).toContain("Hidden from public site");
  });

  it("applies the document theme to the renderer root", () => {
    const site = getDefaultSiteContent();
    const desert = renderToStaticMarkup(<SiteRenderer document={site.document} />);
    expect(desert).toContain('data-theme="desert"');
    expect(desert).toContain("--twaz-accent:#DE6219");

    const navy = renderToStaticMarkup(
      <SiteRenderer document={{ ...site.document, theme: "navy" }} />,
    );
    expect(navy).toContain('data-theme="navy"');
    expect(navy).toContain("--twaz-accent:#22395A");
    expect(navy).toContain("--twaz-arch:#E9A872");
  });

  it("renders a truthful empty state when no events are supplied", () => {
    const site = getDefaultSiteContent();
    const html = renderToStaticMarkup(
      <SiteRenderer document={site.document} events={[]} team={[]} partners={[]} />,
    );
    expect(html).toContain("New events are on the way");
    expect(html).toContain("Our team information is not available right now.");
  });
});
