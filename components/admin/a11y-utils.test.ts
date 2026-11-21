import { describe, expect, it } from "vitest";
import { describedBy, errorId, fieldId, touchTargetClass } from "./a11y-utils";

describe("fieldId", () => {
  it("normalizes a field name into a stable, DOM-safe id", () => {
    expect(fieldId("Title")).toBe("field-title");
    expect(fieldId("  Registration URL  ")).toBe("field-registration-url");
    expect(fieldId("registerUrl")).toBe("field-registerurl");
  });

  it("is deterministic and never empty", () => {
    expect(fieldId("Title")).toBe(fieldId("title"));
    expect(fieldId("###")).toBe("field-unnamed");
  });

  it("gives distinct names distinct ids", () => {
    expect(fieldId("location")).not.toBe(fieldId("registerUrl"));
  });
});

describe("errorId", () => {
  it("derives a matching error id from the field id", () => {
    expect(errorId("title")).toBe("field-title-error");
    expect(errorId("description")).toBe(fieldId("description") + "-error");
  });
});

describe("describedBy", () => {
  it("joins truthy ids into a space-separated value", () => {
    expect(describedBy(["a", "b"])).toBe("a b");
  });

  it("skips missing, empty and false ids", () => {
    expect(describedBy(["a", undefined, null, false, "", "b"])).toBe("a b");
  });

  it("returns undefined when nothing remains", () => {
    expect(describedBy([])).toBeUndefined();
    expect(describedBy([undefined, false, ""])).toBeUndefined();
  });
});

describe("touchTargetClass", () => {
  it("guarantees 44px minimum targets and a visible focus ring", () => {
    expect(touchTargetClass).toContain("min-h-[44px]");
    expect(touchTargetClass).toContain("min-w-[44px]");
    expect(touchTargetClass).toContain("focus-visible:outline");
  });
});
