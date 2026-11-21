import { describe, expect, it } from "vitest";
import { defaultSiteDocument, parseSiteDocument } from "../../server/content-utils";
import { suggestContent } from "../../server/ai";

describe("untrusted CMS and AI documents", () => {
  it("rejects duplicate section ids before they reach id-based editing and React keys", () => {
    const document = defaultSiteDocument();
    const duplicate = { ...document, sections: [document.sections[0], document.sections[0]] };
    expect(() => parseSiteDocument(duplicate)).toThrow(/unique|duplicate/i);
  });

  it("rejects duplicate section ids returned by Workers AI", async () => {
    const current = defaultSiteDocument(3);
    const duplicated = { ...current, sections: [current.sections[0], current.sections[0]] };
    const ai = {
      run: async () => ({ response: JSON.stringify({ document: duplicated, summary: "duplicate ids" }) }),
    };
    await expect(suggestContent(ai, current, "Duplicate a section", undefined)).rejects.toThrow(/invalid document|unique|duplicate/i);
  });
});
